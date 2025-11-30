"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const runnerBridge = {
    up: (projectName) => electron_1.ipcRenderer.invoke("runner:up", projectName),
    exec: (command) => electron_1.ipcRenderer.invoke("runner:exec", command),
    down: () => electron_1.ipcRenderer.invoke("runner:down")
};
function safeExpose(key, api) {
    try {
        electron_1.contextBridge.exposeInMainWorld(key, api);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.message) && err.message.includes("Cannot bind an API on top of an existing property")) {
            console.warn(`[runner-bridge] ${key} already defined, skipping.`);
            return;
        }
        throw err;
    }
}
safeExpose("runner", runnerBridge);
console.info("[preload] runner bridge loaded");
