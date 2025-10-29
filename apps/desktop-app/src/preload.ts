// src/preload.ts
// Aggregator preload: loads all window.* bridges and exposes auth helpers.
// We keep existing auth bridge and also pull in the side-effect bridges
// compiled as .cjs files.

// 1) Load side-effect bridges (CJS) so window.ir, window.runner, window.runtime are defined.
// These modules execute their contextBridge.exposeInMainWorld(...) calls.
import path from "path";
import fs from "fs";

function loadBridge(filename: string) {
  const candidates = [
    path.join(__dirname, "remote", filename),
    path.join(__dirname, "..", "dist", "remote", filename),
    path.join(__dirname, "..", "src", "remote", filename),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      require(candidate);
      return;
    } catch (err: any) {
      // Electron throws when a bridge tries to overwrite an existing property (e.g., runner).
      if (err?.message?.includes("Cannot bind an API on top of an existing property")) {
        return;
      }
      if (err?.code !== "MODULE_NOT_FOUND") {
        console.warn(`[preload] failed loading ${candidate}:`, err);
        return;
      }
    }
  }

  console.warn(`[preload] bridge ${filename} not found; tried`, candidates);
}

loadBridge("ir-bridge.cjs");
loadBridge("runtime-bridge.cjs");

// 2) Keep your existing OAuth helpers under window.electron
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  login: () => ipcRenderer.invoke("oauth-login"),             // GitHub
  loginGoogle: () => ipcRenderer.invoke("oauth-login-google") // Google
});
