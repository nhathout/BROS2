import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electron", {
    login: () => ipcRenderer.invoke("oauth-login"),
    loginGoogle: () => ipcRenderer.invoke("oauth-login-google"),
});
