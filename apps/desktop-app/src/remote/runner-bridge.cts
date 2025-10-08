import { contextBridge, ipcRenderer } from "electron";
import type { ExecResult } from "@bros/runner";

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

contextBridge.exposeInMainWorld("runner", runnerBridge);
console.info("[preload] runner bridge loaded");
