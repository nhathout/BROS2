import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import express from "express";
import dotenv from "dotenv";
import { Runner } from "@bros/runner";
import { buildIR } from "@bros/ui";
import { validateIR } from "@bros/validation";
// --- Setup ---
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Globals ---
let mainWindow = null;
let runner = null;
let runnerProjectKey = null;
// --- Helpers ---
function resolvePreloadPath() {
    const localPreload = path.join(__dirname, "remote", "ir-bridge.cjs");
    if (fs.existsSync(localPreload))
        return localPreload;
    const fallbackPreload = path.join(app.getAppPath(), "dist", "remote", "ir-bridge.cjs");
    if (fs.existsSync(fallbackPreload))
        return fallbackPreload;
    throw new Error("Cannot locate IR preload script. Run 'pnpm --filter ./apps/desktop-app build:main' first.");
}
function ensureRunner(projectName) {
    const trimmed = projectName.trim();
    const candidate = Runner.defaultProject(trimmed);
    if (!runner || runnerProjectKey !== candidate.projectName) {
        runner = candidate;
        runnerProjectKey = candidate.projectName;
        return runner;
    }
    return runner;
}
// --- Electron Window ---
function createWindow() {
    const preloadPath = resolvePreloadPath();
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (process.env.NODE_ENV === "development") {
        mainWindow.loadURL("http://localhost:5173");
    }
    else {
        mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }
}
// --- IPC: Runner + IR ---
ipcMain.handle("runner:up", async (_event, projectName) => {
    if (typeof projectName !== "string" || projectName.trim().length === 0) {
        throw new Error("runner:up requires a non-empty projectName.");
    }
    const instance = ensureRunner(projectName);
    await instance.up((msg) => console.info(`[runner] ${msg}`));
});
ipcMain.handle("runner:exec", async (_event, command) => {
    if (typeof command !== "string" || command.trim().length === 0) {
        throw new Error("runner:exec requires a non-empty command.");
    }
    if (!runner)
        throw new Error("Runner not initialized. Call runner.up(projectName) first.");
    return runner.exec(command, (msg) => console.info(`[runner] ${msg}`));
});
ipcMain.handle("runner:down", async () => {
    if (!runner)
        return;
    await runner.down((msg) => console.info(`[runner] ${msg}`));
    runner = null;
    runnerProjectKey = null;
});
ipcMain.handle("ir:build", async (_event, graph) => {
    return buildIR(graph);
});
ipcMain.handle("ir:validate", async (_event, irData) => {
    return validateIR(irData);
});
// --- IPC: OAuth Login ---
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/callback";
ipcMain.handle("oauth-login", async () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=read:user user:email`;
    shell.openExternal(authUrl);
    const appServer = express();
    const httpServer = appServer.listen(3000, () => {
        console.log("OAuth server listening on port 3000");
    });
    return new Promise((resolve) => {
        appServer.get("/callback", async (req, res) => {
            const code = req.query.code;
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
                        redirect_uri: REDIRECT_URI,
                    }),
                });
                const tokenData = (await tokenResponse.json());
                console.log("GitHub Token:", tokenData);
                res.send("✅ Login successful! You can close this window.");
                resolve({
                    success: true,
                    token: tokenData.access_token,
                });
            }
            catch (err) {
                console.error("OAuth error:", err);
                res.status(500).send("OAuth failed.");
                resolve({
                    success: false,
                    error: err.message,
                });
            }
            finally {
                httpServer.close();
            }
        });
    });
});
// --- App lifecycle ---
app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        app.quit();
});
