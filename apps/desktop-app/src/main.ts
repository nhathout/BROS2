import fs from "node:fs";
import path from "node:path";
import * as electron from "electron"; // ✅ NOTE: namespace import
import type { BrowserWindow } from "electron";
import express from "express";
import dotenv from "dotenv";

import type { BlockGraph } from "@bros/ui";
import type { IR } from "@bros/shared";
import type { Runner as RunnerInstance } from "@bros/runner";

const { app, ipcMain, shell, BrowserWindow: BrowserWindowCtor } = electron;

// --- Dynamic module loaders ---
type RunnerCtor = typeof import("@bros/runner")["Runner"];
type BuildIrFn = typeof import("@bros/ui")["buildIR"];
type ValidateIrFn = typeof import("@bros/validation")["validateIR"];

let runnerCtor: RunnerCtor | null = null;
let buildIr: BuildIrFn | null = null;
let validateIr: ValidateIrFn | null = null;

async function getRunnerCtor(): Promise<RunnerCtor> {
  if (!runnerCtor) {
    const mod = await import("@bros/runner");
    runnerCtor = mod.Runner;
  }
  return runnerCtor;
}

async function getBuildIr(): Promise<BuildIrFn> {
  if (!buildIr) {
    const mod = await import("@bros/ui");
    buildIr = mod.buildIR;
  }
  return buildIr;
}

async function getValidateIr(): Promise<ValidateIrFn> {
  if (!validateIr) {
    const mod = await import("@bros/validation");
    validateIr = mod.validateIR;
  }
  return validateIr;
}

// --- Setup ---
dotenv.config();

// --- Globals ---

let mainWindow: BrowserWindow | null = null;
let runner: RunnerInstance | null = null;
let runnerProjectKey: string | null = null;

// --- Helpers ---
function resolvePreloadPath(): string {
  const localPreload = path.join(__dirname, "remote", "ir-bridge.cjs");
  if (fs.existsSync(localPreload)) return localPreload;

  const fallbackPreload = path.join(app.getAppPath(), "dist", "remote", "ir-bridge.cjs");
  if (fs.existsSync(fallbackPreload)) return fallbackPreload;

  throw new Error(
    "Cannot locate IR preload script. Run 'pnpm --filter ./apps/desktop-app build:main' first."
  );
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
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error("runner:up requires a non-empty projectName.");
  }
  const instance = await ensureRunner(projectName);
  await instance.up((msg: string) => console.info(`[runner] ${msg}`));
});

ipcMain.handle("runner:exec", async (_event, command: string) => {
  if (typeof command !== "string" || command.trim().length === 0) {
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
    const appServer = express();

    const httpServer = appServer.listen(3000, () => {
      console.log("GitHub OAuth server listening on port 3000");

      // ✅ Open login URL once server is ready
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=read:user user:email`;
      shell.openExternal(authUrl);
    });

    // 👇 now listening on /github-callback, not /callback
    appServer.get("/github-callback", async (req, res) => {
      const code = req.query.code as string;

      try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI, // 👈 must match exactly
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
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=http://localhost:3000/google-callback&response_type=code&scope=openid%20email%20profile&access_type=offline`;

  shell.openExternal(authUrl);

  const appServer = express();
  const httpServer = appServer.listen(3000, () => {
    console.log("Google OAuth server listening on port 3000");
  });

  return new Promise((resolve) => {
    appServer.get("/google-callback", async (req, res) => {
      const code = req.query.code as string;

      try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: "http://localhost:3000/google-callback",
            grant_type: "authorization_code",
          }),
        });

        const tokenData = await tokenResponse.json() as { access_token?: string };
        console.log("Google Token:", tokenData);

        res.send("✅ Google login successful! You can close this window.");
        resolve({ success: true, token: tokenData.access_token });
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
