"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const runnerBridge = {
    up: (projectName) => electron_1.ipcRenderer.invoke("runner:up", projectName),
    exec: (command) => electron_1.ipcRenderer.invoke("runner:exec", command),
    down: () => electron_1.ipcRenderer.invoke("runner:down")
};
electron_1.contextBridge.exposeInMainWorld("runner", runnerBridge);
console.info("[preload] runner bridge loaded");
