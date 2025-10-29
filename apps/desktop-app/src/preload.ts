// src/preload.ts
// Aggregator preload: loads all window.* bridges and exposes auth helpers.
// We keep existing auth bridge and also pull in the side-effect bridges
// compiled as .cjs files.

// 1) Load side-effect bridges (CJS) so window.ir, window.runner, window.runtime are defined.
// These modules execute their contextBridge.exposeInMainWorld(...) calls.
function loadBridge(filename: string) {
  const candidates = [
    `${__dirname}/remote/${filename}`,
    `${__dirname}/../dist/remote/${filename}`,
  ];

  for (const candidate of candidates) {
    try {
      require(candidate);
      return;
    } catch (err: any) {
      if (err?.code !== "MODULE_NOT_FOUND") {
        console.warn(`[preload] failed loading ${candidate}:`, err);
        return;
      }
    }
  }

  console.warn(`[preload] bridge ${filename} not found; tried`, candidates);
}

loadBridge("ir-bridge.cjs");
loadBridge("runner-bridge.cjs");
loadBridge("runtime-bridge.cjs");

// 2) Keep your existing OAuth helpers under window.electron
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  login: () => ipcRenderer.invoke("oauth-login"),             // GitHub
  loginGoogle: () => ipcRenderer.invoke("oauth-login-google") // Google
});
