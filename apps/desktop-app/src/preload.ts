// src/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  login: () => ipcRenderer.invoke("oauth-login"),          // GitHub
  loginGoogle: () => ipcRenderer.invoke("oauth-login-google"), // Google
});

