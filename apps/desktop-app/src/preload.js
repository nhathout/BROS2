const path = require("path");
const fs = require("fs");
const { contextBridge, ipcRenderer } = require("electron");

function loadBridge(filename) {
  const candidates = [
    path.join(__dirname, "remote", filename),
    path.join(__dirname, "..", "dist", "remote", filename),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      require(candidate);
      return;
    } catch (err) {
      if (err?.code !== "MODULE_NOT_FOUND") throw err;
    }
  }

  console.warn(`[preload] bridge ${filename} not found in`, candidates);
}

// Load side-effect bridges so window.runner, window.ir, and window.runtime exist.
loadBridge("ir-bridge.cjs");
loadBridge("runner-bridge.cjs");
loadBridge("runtime-bridge.cjs");

contextBridge.exposeInMainWorld("electron", {
  login: () => ipcRenderer.invoke("oauth-login"),
  loginGoogle: () => ipcRenderer.invoke("oauth-login-google"),
});
