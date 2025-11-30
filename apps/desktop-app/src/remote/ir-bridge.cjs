"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const runnerBridge = {
    up: (projectName) => electron_1.ipcRenderer.invoke("runner:up", projectName),
    exec: (command) => electron_1.ipcRenderer.invoke("runner:exec", command),
    down: () => electron_1.ipcRenderer.invoke("runner:down"),
};
const irBridge = {
    build: (graph) => electron_1.ipcRenderer.invoke("ir:build", graph),
    validate: (ir) => electron_1.ipcRenderer.invoke("ir:validate", ir),
};
const electronBridge = {
    login: () => electron_1.ipcRenderer.invoke("oauth-login"),
    loginGoogle: () => electron_1.ipcRenderer.invoke("oauth-login-google"),
};
function safeExpose(key, api) {
    try {
        electron_1.contextBridge.exposeInMainWorld(key, api);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.message) && err.message.includes("Cannot bind an API on top of an existing property")) {
            console.warn(`[ir-bridge] ${key} already defined, skipping.`);
            return;
        }
        throw err;
    }
}
safeExpose("runner", runnerBridge);
safeExpose("ir", irBridge);
safeExpose("electron", electronBridge);
console.info("[preload] runner + IR bridge loaded");
