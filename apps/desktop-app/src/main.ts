import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as electron from "electron"; // ✅ NOTE: namespace import
import type { BrowserWindow } from "electron";
import type { NativeImage } from "electron";
import express from "express";
import dotenv from "dotenv";

import type { BlockGraph } from "@bros2/ui";
import type { IR } from "@bros2/shared";
import type { Runner as RunnerInstance } from "@bros2/runner";
import type { WorkspaceDocument, WorkspaceSummary } from "./shared/workspace";

const { app, ipcMain, shell, BrowserWindow: BrowserWindowCtor, nativeImage, session } = electron;

// --- Dynamic module loaders ---
type RunnerCtor = typeof import("@bros2/runner")["Runner"];
type BuildIrFn = typeof import("@bros2/ui")["buildIR"];
type ValidateIrFn = typeof import("@bros2/validation")["validateIR"];

let runner: RunnerInstance | null = null;
let runnerProjectKey: string | null = null;
let mainWindow: BrowserWindow | null = null;

let workspaceRoot: string | null = null;
let trashRoot: string | null = null;

const APP_ICON_CANDIDATES = [
  "bros-logo-icon.icns",
  "BROS2-logo.PNG",
  "bros-logo-icon.ico",
];
const REACT_DEVTOOLS_IDS = [
  // MV3 (new) React DevTools
  "nkigjnjahdpfgmkaammbpohkfccginfo",
  // MV2 (legacy) React DevTools
  "fmkadmapgofadopljbjfkapdkoienihi",
];

const resolveAppIconPath = (): string | undefined => {
  const roots = [process.resourcesPath, path.join(__dirname, "..", "..", "..", "assets", "logos")];
  for (const root of roots) {
    for (const filename of APP_ICON_CANDIDATES) {
      const candidate = path.join(root, filename);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
};

const getAppIcon = (): NativeImage | undefined => {
  const iconPath = resolveAppIconPath();
  if (!iconPath) {
    console.warn("[app] icon not found; using default Electron icon");
    return undefined;
  }
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    console.warn("[app] icon loaded but empty; path=", iconPath);
    return undefined;
  }
  return image;
};

const resolveReactDevtoolsFromChrome = async (): Promise<string | null> => {
  const explicit = process.env.REACT_DEVTOOLS_PATH;
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  const home = os.homedir();
  const candidates: string[] = [];

  const ids = REACT_DEVTOOLS_IDS;

  if (process.platform === "darwin") {
    for (const id of ids) {
      candidates.push(
        path.join(home, "Library", "Application Support", "Google", "Chrome", "Default", "Extensions", id)
      );
    }
  } else if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
    for (const id of ids) {
      candidates.push(
        path.join(localAppData, "Google", "Chrome", "User Data", "Default", "Extensions", id)
      );
    }
  } else {
    const configHome = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
    const linuxBases = ["google-chrome", "google-chrome-beta", "google-chrome-canary", "chromium"];
    for (const base of linuxBases) {
      for (const id of ids) {
        candidates.push(path.join(configHome, base, "Default", "Extensions", id));
      }
    }
  }

  for (const base of candidates) {
    try {
      const entries = await fs.promises.readdir(base, { withFileTypes: true });
      const versions = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      if (!versions.length) continue;
      versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      return path.join(base, versions[versions.length - 1]);
    } catch {
      continue;
    }
  }
  return null;
};

const installReactDevtools = async () => {
  if (process.env.NODE_ENV !== "development") return;
  try {
    const extensionPath = await resolveReactDevtoolsFromChrome();
    if (!extensionPath) {
      console.warn(
        "[devtools] React DevTools not found in Chrome profile. Install the React DevTools Chrome extension (MV3: nkigjnjahdpfgmkaammbpohkfccginfo or MV2: fmkadmapgofadopljbjfkapdkoienihi) and restart the app."
      );
      return;
    }

    const extensionsApi = session.defaultSession.extensions;
    if (!extensionsApi?.loadExtension || !extensionsApi?.getAllExtensions) {
      throw new Error("session.extensions APIs are unavailable");
    }

    const loaded = await extensionsApi.loadExtension(extensionPath, { allowFileAccess: true });
    const names = extensionsApi.getAllExtensions().map((ext: any) => ext?.name ?? ext);
    console.log("[devtools] React DevTools loaded:", loaded?.name ?? loaded, names);
  } catch (err) {
    console.error("[devtools] Failed to load React DevTools:", err);
  }
};

function resolveWorkspaceRoot(): string {
  if (workspaceRoot) return workspaceRoot;

  const candidates = [
    path.join(app.getPath("documents"), "BROS2", "workspaces"),
    path.join(app.getPath("userData"), "workspaces"),
  ];

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      workspaceRoot = candidate;
      if (candidate !== candidates[0]) {
        console.warn(
          `[workspace] Falling back to userData directory: ${candidate}. Documents directory was not accessible.`
        );
      }
      return workspaceRoot;
    } catch (err: any) {
      if (err?.code === "EACCES" || err?.code === "EPERM") {
        console.warn(
          `[workspace] Cannot access ${candidate} (permission denied). Trying next fallback.`
        );
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    "Unable to create workspace directory. Please check filesystem permissions."
  );
}

function resolveTrashRoot(): string {
  if (trashRoot) return trashRoot;

  const candidates = [
    path.join(app.getPath("documents"), "BROS2", "trash"),
    path.join(app.getPath("userData"), "trash"),
  ];

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      trashRoot = candidate;
      if (candidate !== candidates[0]) {
        console.warn(
          `[workspace] Falling back to userData trash directory: ${candidate}. Documents directory was not accessible.`
        );
      }
      return trashRoot;
    } catch (err: any) {
      if (err?.code === "EACCES" || err?.code === "EPERM") {
        console.warn(
          `[workspace] Cannot access ${candidate} (permission denied). Trying next fallback.`
        );
        continue;
      }
      throw err;
    }
  }

  throw new Error("Unable to create trash directory. Please check filesystem permissions.");
}

const sanitizeWorkspaceName = (value?: string | null) => {
  const cleaned = (value ?? "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  return cleaned || "Untitled Workspace";
};

const workspaceFileName = (name?: string | null, suffix?: number) => {
  const base = sanitizeWorkspaceName(name);
  return `${base}${suffix && suffix > 0 ? ` (${suffix})` : ""}.json`;
};

async function workspaceFilePathWithFolder(
  id: string,
  folder?: string | null,
  inTrash = false,
  name?: string | null
): Promise<string> {
  const base = inTrash ? resolveTrashRoot() : resolveWorkspaceRoot();
  const safeFolder = folder ? folder.split(path.sep).join(path.posix.sep) : "";
  const segments = safeFolder ? safeFolder.split("/") : [];
  const dir = path.join(base, ...segments);
  await fileSystem.mkdir(dir, { recursive: true });

  let counter = 0;
  while (true) {
    const candidateName = workspaceFileName(name, counter);
    const target = path.join(dir, candidateName);
    try {
      const stat = await fileSystem.stat(target);
      if (!stat.isFile()) {
        counter += 1;
        continue;
      }
      const raw = await fileSystem.readFile(target, "utf-8");
      const doc = JSON.parse(raw) as WorkspaceDocument;
      if (doc.id === id) return target;
    } catch (err: any) {
      if (err?.code === "ENOENT") return target;
      if (err?.name === "SyntaxError") {
        counter += 1;
        continue;
      }
      throw err;
    }
    counter += 1;
  }
}

async function listWorkspaceSummaries(): Promise<WorkspaceSummary[]> {
  const activeDir = resolveWorkspaceRoot();
  const trashDir = resolveTrashRoot();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const summaries: WorkspaceSummary[] = [];

  const scanDir = async (dir: string, isTrash: boolean, folderRel = "") => {
    const entries = await fileSystem.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const nextFolderRel = folderRel ? path.join(folderRel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        await scanDir(fullPath, isTrash, nextFolderRel);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const raw = await fileSystem.readFile(fullPath, "utf-8");
      try {
        const doc = JSON.parse(raw) as WorkspaceDocument;
        if (isTrash) {
          const trashedAt = doc.meta && (doc.meta as any).trashedAt;
          if (trashedAt) {
            const age = Date.now() - new Date(trashedAt).getTime();
            if (age > sevenDaysMs) {
              await fileSystem.unlink(fullPath);
              continue;
            }
          }
        }
        summaries.push({
          id: doc.id,
          name: doc.name,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          meta: {
            ...(doc.meta ?? {}),
            ...(folderRel ? { folder: folderRel } : {}),
            ...(isTrash ? { tags: Array.from(new Set([...(doc.meta?.tags ?? []), "trash"])) } : {}),
          },
        });
      } catch (err) {
        console.warn(`[workspace] Failed to parse ${entry.name}:`, err);
      }
    }
  };

  await scanDir(activeDir, false);
  await scanDir(trashDir, true);
  summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return summaries;
}

async function ensureUniqueWorkspaceName(
  desiredName: string | undefined,
  folder: string | null | undefined,
  currentId?: string
): Promise<string> {
  const base = sanitizeWorkspaceName(desiredName);
  const existing = await listWorkspaceSummaries();
  const folderKey = folder?.trim() ?? "";
  const names = new Set(
    existing
      .filter(
        (ws) =>
          !ws.meta?.tags?.includes?.("trash") &&
          (ws.meta?.folder ?? "") === folderKey &&
          ws.id !== currentId
      )
      .map((ws) => ws.name)
  );
  if (!names.has(base)) return base;
  let counter = 2;
  while (true) {
    const candidate = `${base} (${counter})`;
    if (!names.has(candidate)) return candidate;
    counter += 1;
  }
}

async function resolveWorkspaceFile(id: string): Promise<{ filePath: string; inTrash: boolean }> {
  const searchDirs = [
    { dir: resolveWorkspaceRoot(), inTrash: false },
    { dir: resolveTrashRoot(), inTrash: true },
  ];

  const findInDir = async (dir: string): Promise<string | null> => {
    const entries = await fileSystem.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await findInDir(full);
        if (found) return found;
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const raw = await fileSystem.readFile(full, "utf-8");
          const doc = JSON.parse(raw) as WorkspaceDocument;
          if (doc.id === id) return full;
        } catch {
          continue;
        }
      }
    }
    return null;
  };

  for (const { dir, inTrash } of searchDirs) {
    try {
      const found = await findInDir(dir);
      if (found) return { filePath: found, inTrash };
    } catch {
      continue;
    }
  }

  const fallback = path.join(resolveWorkspaceRoot(), workspaceFileName(id));
  return { filePath: fallback, inTrash: false };
}

dotenv.config();

// Lazy require: keep startup fast and avoid hard deps in dev
async function getRunnerCtor(): Promise<RunnerCtor> {
  const m = await import("@bros2/runner");
  return m.Runner;
}
async function getBuildIr(): Promise<BuildIrFn> {
  const m = await import("@bros2/ui");
  return m.buildIR;
}
async function getValidateIr(): Promise<ValidateIrFn> {
  const m = await import("@bros2/validation");
  return m.validateIR;
}

// --- Helpers ---
function resolvePreloadPath(): string {
  // Prefer source preload in dev so changes are picked up without rebuild; fall back to dist.
  const candidates = [
    path.join(__dirname, "preload.js"),
    path.join(__dirname, "..", "dist", "preload.js"),
    path.join(app.getAppPath(), "dist", "preload.js"),
    path.join(__dirname, "remote", "preload.cjs"),
    path.join(__dirname, "remote", "ir-bridge.cjs"), // legacy single-bridge fallback
    path.join(app.getAppPath(), "dist", "remote", "preload.cjs"),
    path.join(app.getAppPath(), "dist", "remote", "ir-bridge.cjs")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Cannot locate preload script. Ensure the desktop app is built.");
}

async function ensureRunner(projectName: string): Promise<RunnerInstance> {
  const trimmed = projectName.trim();
  const runnerClass = await getRunnerCtor();
  const candidate = runnerClass.defaultProject(trimmed);
  if (!runner || runnerProjectKey !== candidate.projectName) {
    runner = candidate;
    runnerProjectKey = candidate.projectName;
    return runner;
  }
  return runner!;
}

// --- Electron Window ---
function createWindow() {
  const preloadPath = resolvePreloadPath();
  mainWindow = new BrowserWindowCtor({
    width: 1000,
    height: 700,
    icon: resolveAppIconPath(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const prefs = mainWindow.webContents.getLastWebPreferences?.();
  console.info("[window] webPreferences", prefs);
  mainWindow.maximize();

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools(); // 👈 helps debug white screens

  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.on("ready", () => {
  if (process.platform === "darwin") {
    const appIcon = getAppIcon();
    if (appIcon && app.dock) app.dock.setIcon(appIcon);
  }
});

// --- IPC: Runner + IR ---
ipcMain.handle("runner:up", async (_event, projectName: string) => {
  const r = await ensureRunner(projectName);
  await r.up((msg: string) => console.info(`[runner] ${msg}`));
});

ipcMain.handle("runner:exec", async (_event, command: string) => {
  if (!command || !command.trim()) {
    throw new Error("runner:exec requires a non-empty command.");
  }
  if (!runner) throw new Error("Runner not initialized. Call runner.up(projectName) first.");
  return runner.exec(command, (msg: string) => console.info(`[runner] ${msg}`));
});

ipcMain.handle("runner:down", async () => {
  if (!runner) return;
  await runner.down((msg: string) => console.info(`[runner] ${msg}`));
  runner = null;
  runnerProjectKey = null;
});

ipcMain.handle("ir:build", async (_event, graph: BlockGraph) => {
  const buildIrFn = await getBuildIr();
  return buildIrFn(graph);
});

ipcMain.handle("ir:validate", async (_event, irData: IR) => {
  const validateIrFn = await getValidateIr();
  return validateIrFn(irData);
});

// --- IPC: Workspace storage ---
ipcMain.handle("workspace:list", async () => {
  try {
    return await listWorkspaceSummaries();
  } catch (err) {
    console.error("[workspace:list] failed:", err);
    throw err;
  }
});

ipcMain.handle("workspace:storageList", async () => {
  const activeDir = resolveWorkspaceRoot();
  const trashDir = resolveTrashRoot();
  const entries: Array<{ id: string; name: string; path: string; bytes: number }> = [];

  const scanDir = async (dir: string) => {
    const files = await fileSystem.readdir(dir);
    for (const fileName of files) {
      if (!fileName.endsWith(".json")) continue;
      const fullPath = path.join(dir, fileName);
      try {
        const stat = await fileSystem.stat(fullPath);
        const raw = await fileSystem.readFile(fullPath, "utf-8");
        const doc = JSON.parse(raw) as WorkspaceDocument;
        entries.push({
          id: doc.id,
          name: doc.name,
          path: fullPath,
          bytes: stat.size,
        });
      } catch (err) {
        console.warn("[workspace:storageList] failed to read", fullPath, err);
      }
    }
  };

  await scanDir(activeDir);
  await scanDir(trashDir);
  return entries;
});

ipcMain.handle("folder:list", async () => {
  const dir = resolveWorkspaceRoot();
  const folders: Array<{ name: string; path: string; fullPath: string }> = [];

  const scan = async (current: string, rel: string) => {
    const entries = await fileSystem.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(current, entry.name);
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      folders.push({ name: entry.name, path: relPath.replace(/\\/g, "/"), fullPath });
      await scan(fullPath, relPath);
    }
  };

  await scan(dir, "");
  return folders;
});

ipcMain.handle("folder:create", async (_event, payload: { name?: string; parent?: string | null } | string) => {
  const name =
    typeof payload === "string" ? payload.trim() : payload?.name?.trim();
  if (!name) throw new Error("Folder name is required");
  const parent =
    typeof payload === "string" ? "" : payload?.parent?.trim() ?? "";
  const segments = parent ? parent.split("/").filter(Boolean) : [];
  const dir = path.join(resolveWorkspaceRoot(), ...segments, name);
  await fileSystem.mkdir(dir, { recursive: true });
  const relPath = path.join(parent, name).replace(/\\/g, "/");
  return { name, path: relPath, fullPath: dir };
});

ipcMain.handle("folder:open", async (_event, folderPath: string) => {
  if (!folderPath) throw new Error("Folder path is required");
  await shell.openPath(folderPath);
  return true;
});

ipcMain.handle("folder:rename", async (_event, payload: { oldPath: string; newName: string }) => {
  const { oldPath, newName } = payload;
  if (!oldPath || !newName?.trim()) throw new Error("oldPath and newName are required");
  const base = path.dirname(oldPath);
  const target = path.join(base, newName.trim());
  await fileSystem.rename(oldPath, target);
  return { name: newName.trim(), path: target };
});

ipcMain.handle("folder:trash", async (_event, folderPath: string) => {
  if (!folderPath) throw new Error("Folder path is required");
  const folderName = path.basename(folderPath);
  const baseTarget = path.join(resolveTrashRoot(), folderName);
  await fileSystem.mkdir(resolveTrashRoot(), { recursive: true });

  // Avoid collisions by suffixing when a folder with the same name already exists in trash.
  let target = baseTarget;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fileSystem.stat(target);
      target = `${baseTarget}-${counter}`;
      counter += 1;
    } catch (err: any) {
      if (err?.code === "ENOENT") break;
      throw err;
    }
  }

  await fileSystem.mkdir(resolveTrashRoot(), { recursive: true });
  await fileSystem.rename(folderPath, target);
  return { path: target };
});

ipcMain.handle(
  "workspace:create",
  async (
    _event,
    payload: { name?: string; template?: Partial<WorkspaceDocument> | null; meta?: WorkspaceDocument["meta"] } = {}
  ) => {
    const dir = resolveWorkspaceRoot();
    const now = new Date().toISOString();
    const id = randomUUID();

    const template = payload?.template ?? null;

    const name = await ensureUniqueWorkspaceName(
      payload?.name?.trim() || template?.name?.trim() || "Untitled Workspace",
      payload?.meta?.folder ?? template?.meta?.folder ?? null
    );

    const baseDoc: WorkspaceDocument = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      nodes: template?.nodes ?? [],
      meta: template?.meta ?? payload?.meta ?? undefined,
    };

    const filePath = await workspaceFilePathWithFolder(id, baseDoc.meta?.folder ?? null, false, baseDoc.name);
    await fileSystem.writeFile(filePath, JSON.stringify(baseDoc, null, 2), "utf-8");
    return baseDoc;
  }
);

ipcMain.handle("workspace:load", async (_event, id: string) => {
  if (!id) throw new Error("workspace:load requires an id");
  const { filePath } = await resolveWorkspaceFile(id);
  const raw = await fileSystem.readFile(filePath, "utf-8");
  return JSON.parse(raw) as WorkspaceDocument;
});

ipcMain.handle(
  "workspace:save",
  async (_event, payload: { id: string; data: WorkspaceDocument }) => {
    const { id, data } = payload || ({} as { id: string; data: WorkspaceDocument });
    if (!id || !data) throw new Error("workspace:save requires an id and data payload");

    const hasTrashTag = (data.meta?.tags ?? []).includes("trash");
    const trashedAt =
      hasTrashTag ? (data.meta as any)?.trashedAt ?? new Date().toISOString() : (data.meta as any)?.trashedAt;

    const nextDoc: WorkspaceDocument = {
      ...data,
      id,
      updatedAt: new Date().toISOString(),
      meta: {
        ...(data.meta ?? {}),
        ...(hasTrashTag ? { tags: Array.from(new Set([...(data.meta?.tags ?? []), "trash"])) } : {}),
        ...(trashedAt && hasTrashTag ? { trashedAt } : {}),
        ...(!hasTrashTag ? { trashedAt: undefined } : {}),
      },
    };

    nextDoc.name = await ensureUniqueWorkspaceName(nextDoc.name, nextDoc.meta?.folder ?? null, id);

    const targetPath = await workspaceFilePathWithFolder(
      id,
      nextDoc.meta?.folder ?? null,
      hasTrashTag,
      nextDoc.name
    );
    const previousResolved = await resolveWorkspaceFile(id);
    const previousPath = previousResolved.filePath;

    await fileSystem.writeFile(targetPath, JSON.stringify(nextDoc, null, 2), "utf-8");

    if (previousPath !== targetPath) {
      try {
        await fileSystem.unlink(previousPath);
      } catch (err: any) {
        if (err?.code !== "ENOENT") {
          console.warn(`[workspace] failed to remove old workspace file at ${previousPath}`, err);
        }
      }
    }

    return nextDoc;
  }
);

// --- IPC: OAuth Login ---
ipcMain.handle("oauth-login", async () => {
  const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
  const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
  const REDIRECT_URI = "http://localhost:3000/github-callback";

  return new Promise((resolve) => {
    const authUrl =
      `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=read:user%20user:email`;

    shell.openExternal(authUrl);

    const appServer = express();
    const httpServer = appServer.listen(3000, () => {
      console.log("OAuth server listening on port 3000");
    });

    appServer.get("/github-callback", async (req, res) => {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send("Missing code");
        httpServer.close();
        return resolve({ success: false, error: "Missing OAuth code" });
      }

      try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI,
          }),
        });

        const tokenData = await tokenResponse.json() as { access_token?: string };
        console.log("GitHub Token:", tokenData);

        res.send("✅ GitHub login successful! You can close this window.");
        resolve({ success: true, token: tokenData.access_token });
      } catch (err) {
        console.error("GitHub OAuth error:", err);
        res.status(500).send("OAuth failed.");
        resolve({ success: false, error: (err as Error).message });
      } finally {
        httpServer.close();
      }
    });
  });
});

// --- IPC: Google OAuth Login ---
ipcMain.handle("oauth-login-google", async () => {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?...e_type=code&scope=openid%20email%20profile&access_type=offline`;

  shell.openExternal(authUrl);

  const appServer = express();
  const httpServer = appServer.listen(3000, () => {
    console.log("Google OAuth server listening on port 3000");
  });

  return new Promise((resolve) => {
    appServer.get("/google-callback", async (req, res) => {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send("Missing code");
        httpServer.close();
        return resolve({ success: false, error: "Missing OAuth code" });
      }

      try {
        // Exchange code for token (left as exercise to wire real Google token fetch)
        res.send("✅ Google login successful! You can close this window.");
        resolve({ success: true });
      } catch (err) {
        console.error("Google OAuth error:", err);
        res.status(500).send("OAuth failed.");
        resolve({ success: false, error: (err as Error).message });
      } finally {
        httpServer.close();
      }
    });
  });
});


// --- App lifecycle ---
app.whenReady().then(async () => {
  resolveWorkspaceRoot();
  createWindow(); // ensure a renderer exists before installing devtools
  await installReactDevtools();

  app.on("activate", () => {
    if (BrowserWindowCtor.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
const fileSystem = fs.promises;
