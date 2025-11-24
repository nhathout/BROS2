import { contextBridge, ipcRenderer } from "electron";
import type { ExecResult } from "@bros2/runner";

function safeExpose(key: string, api: Record<string, unknown>) {
  try {
    contextBridge.exposeInMainWorld(key, api);
  } catch (err: any) {
    if (err?.message?.includes("Cannot bind an API on top of an existing property")) return;
    throw err;
  }
}

type RunnerBridge = {
  up(projectName: string): Promise<void>;
  exec(command: string): Promise<ExecResult>;
  down(): Promise<void>;
};

const runnerBridge: RunnerBridge = {
  up: (projectName: string) => ipcRenderer.invoke("runner:up", projectName),
  exec: (command: string) => ipcRenderer.invoke("runner:exec", command),
  down: () => ipcRenderer.invoke("runner:down")
};

safeExpose("runner", runnerBridge);
console.info("[preload] runner bridge loaded");
