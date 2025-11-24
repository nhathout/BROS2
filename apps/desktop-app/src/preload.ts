// src/preload.ts
// Aggregator preload: loads all window.* bridges and exposes auth helpers.
// We keep existing auth bridge and also pull in the side-effect bridges
// compiled as .cjs files.

// 1) Load side-effect bridges (CJS) so window.ir, window.runner, window.runtime are defined.
// These modules execute their contextBridge.exposeInMainWorld(...) calls.
import "./remote/ir-bridge.cjs";
import "./remote/runner-bridge.cjs";
import "./remote/runtime-bridge.cjs";

// 2) Keep your existing OAuth helpers under window.electron
import { contextBridge, ipcRenderer } from "electron";
import type { WorkspaceDocument, WorkspaceSummary } from "./shared/workspace";

function safeExpose(key: string, api: Record<string, unknown>) {
  try {
    contextBridge.exposeInMainWorld(key, api);
  } catch (err: any) {
    if (err?.message?.includes("Cannot bind an API on top of an existing property")) {
      return;
    }
    throw err;
  }
}

safeExpose("electron", {
  login: () => ipcRenderer.invoke("oauth-login"),             // GitHub
  loginGoogle: () => ipcRenderer.invoke("oauth-login-google") // Google
});

safeExpose("workspace", {
  list: (): Promise<WorkspaceSummary[]> => ipcRenderer.invoke("workspace:list"),
  create: (
    payload?: {
      name?: string;
      template?: Partial<WorkspaceDocument> | null;
      meta?: WorkspaceDocument["meta"];
    }
  ): Promise<WorkspaceDocument> =>
    ipcRenderer.invoke("workspace:create", payload),
  load: (id: string): Promise<WorkspaceDocument> => ipcRenderer.invoke("workspace:load", id),
  save: (id: string, data: WorkspaceDocument): Promise<WorkspaceDocument> =>
    ipcRenderer.invoke("workspace:save", { id, data }),
});
