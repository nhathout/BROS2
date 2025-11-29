const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");

function safeExpose(key, api) {
  try {
    contextBridge.exposeInMainWorld(key, api);
  } catch (err) {
    if (err && err.message && err.message.includes("Cannot bind an API on top of an existing property")) {
      console.warn(`[preload] Skipping expose for ${key}; already defined.`);
      return;
    }
    throw err;
  }
}

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

safeExpose("electron", {
  login: () => ipcRenderer.invoke("oauth-login"),
  loginGoogle: () => ipcRenderer.invoke("oauth-login-google"),
});

safeExpose("workspace", {
  list: () => ipcRenderer.invoke("workspace:list"),
  create: (payload = {}) => ipcRenderer.invoke("workspace:create", payload),
  load: (id) => ipcRenderer.invoke("workspace:load", id),
  save: (id, data) => ipcRenderer.invoke("workspace:save", { id, data }),
  storageList: () => ipcRenderer.invoke("workspace:storageList"),
});

safeExpose("folder", {
  list: () => ipcRenderer.invoke("folder:list"),
  create: (name, parent = null) => ipcRenderer.invoke("folder:create", { name, parent }),
  open: (folderPath) => ipcRenderer.invoke("folder:open", folderPath),
  rename: (payload) => ipcRenderer.invoke("folder:rename", payload),
  trash: (folderPath) => ipcRenderer.invoke("folder:trash", folderPath),
});
