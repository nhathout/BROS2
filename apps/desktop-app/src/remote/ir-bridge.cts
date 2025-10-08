import { contextBridge, ipcRenderer } from "electron";
import type { ExecResult } from "@bros/runner";
import type { IR } from "@bros/shared";
import type { BlockGraph } from "@bros/ui";
import type { ValidationResult } from "@bros/validation";

interface RunnerBridge {
  up(projectName: string): Promise<void>;
  exec(command: string): Promise<ExecResult>;
  down(): Promise<void>;
}

interface IRBridge {
  build(graph: BlockGraph): Promise<{ ir: IR; issues: string[] }>;
  validate(ir: IR): Promise<ValidationResult>;
}

const runnerBridge: RunnerBridge = {
  up: (projectName: string) => ipcRenderer.invoke("runner:up", projectName),
  exec: (command: string) => ipcRenderer.invoke("runner:exec", command),
  down: () => ipcRenderer.invoke("runner:down"),
};

const irBridge: IRBridge = {
  build: (graph: BlockGraph) => ipcRenderer.invoke("ir:build", graph),
  validate: (ir: IR) => ipcRenderer.invoke("ir:validate", ir),
};

type OAuthResponse = { success: boolean; token?: string; error?: string };

const electronBridge = {
  login: (): Promise<OAuthResponse> => ipcRenderer.invoke("oauth-login"),
  loginGoogle: (): Promise<OAuthResponse> => ipcRenderer.invoke("oauth-login-google"),
};

contextBridge.exposeInMainWorld("runner", runnerBridge);
contextBridge.exposeInMainWorld("ir", irBridge);
contextBridge.exposeInMainWorld("electron", electronBridge);

console.info("[preload] runner + IR bridge loaded");
