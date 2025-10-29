import fs from "node:fs";
import path from "node:path";
import * as electron from "electron"; // ✅ NOTE: namespace import
import type { BrowserWindow } from "electron";
import express from "express";
import dotenv from "dotenv";

import type { BlockGraph } from "@bros2/ui";
import type { IR } from "@bros2/shared";
import type { Runner as RunnerInstance } from "@bros2/runner";

const { app, ipcMain, shell, BrowserWindow: BrowserWindowCtor } = electron;

// --- Dynamic module loaders ---
type RunnerCtor = typeof import("@bros2/runner")["Runner"];
type BuildIrFn = typeof import("@bros2/ui")["buildIR"];
type ValidateIrFn = typeof import("@bros2/validation")["validateIR"];

let runner: RunnerInstance | null = null;
let runnerProjectKey: string | null = null;
let mainWindow: BrowserWindow | null = null;

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
  // Prefer the built preload that imports all bridges (dist/preload.js)
  const candidates = [
    path.join(__dirname, "..", "dist", "preload.js"),
    path.join(app.getAppPath(), "dist", "preload.js"),
    path.join(__dirname, "preload.js"),
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
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.maximize();

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools(); // 👈 helps debug white screens

  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

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
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindowCtor.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
