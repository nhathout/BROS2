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
electron_1.contextBridge.exposeInMainWorld("runner", runnerBridge);
electron_1.contextBridge.exposeInMainWorld("ir", irBridge);
electron_1.contextBridge.exposeInMainWorld("electron", electronBridge);
console.info("[preload] runner + IR bridge loaded");
