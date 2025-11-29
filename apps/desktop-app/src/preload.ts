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
  storageList: (): Promise<
    Array<{
      id: string;
      name: string;
      path: string;
      bytes: number;
    }>
  > => ipcRenderer.invoke("workspace:storageList"),
});

safeExpose("folder", {
  list: (): Promise<Array<{ name: string; path: string; fullPath: string }>> =>
    ipcRenderer.invoke("folder:list"),
  create: (name: string, parent?: string | null): Promise<{ name: string; path: string; fullPath: string }> =>
    ipcRenderer.invoke("folder:create", { name, parent }),
  open: (folderPath: string): Promise<boolean> => ipcRenderer.invoke("folder:open", folderPath),
  rename: (payload: { oldPath: string; newName: string }): Promise<{ name: string; path: string }> =>
    ipcRenderer.invoke("folder:rename", payload),
  trash: (folderPath: string): Promise<{ path: string }> => ipcRenderer.invoke("folder:trash", folderPath),
});
