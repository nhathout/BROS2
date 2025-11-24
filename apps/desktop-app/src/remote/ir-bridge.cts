import { contextBridge, ipcRenderer } from "electron";
import type { IR } from "@bros2/shared";
import type { BlockGraph } from "@bros2/ui";
import type { ValidationResult } from "@bros2/validation";
import type { ExecResult } from "@bros2/runner";

interface IRBridge {
  build(graph: BlockGraph): Promise<{ ir: IR; issues: string[] }>;
  validate(ir: IR): Promise<ValidationResult>;
}

const irBridge: IRBridge = {
  build: (graph: BlockGraph) => ipcRenderer.invoke("ir:build", graph),
  validate: (ir: IR) => ipcRenderer.invoke("ir:validate", ir),
};

type OAuthResponse = { success: boolean; token?: string; error?: string };

const electronBridge = {
  login: (): Promise<OAuthResponse> => ipcRenderer.invoke("oauth-login"),
  loginGoogle: (): Promise<OAuthResponse> => ipcRenderer.invoke("oauth-login-google"),
};

function safeExpose(key: string, api: Record<string, unknown>) {
  try {
    contextBridge.exposeInMainWorld(key, api);
  } catch (err: any) {
    if (err?.message?.includes("Cannot bind an API on top of an existing property")) return;
    throw err;
  }
}

safeExpose("runner", {
  up: (projectName: string) => ipcRenderer.invoke("runner:up", projectName),
  exec: (command: string) => ipcRenderer.invoke("runner:exec", command),
  down: () => ipcRenderer.invoke("runner:down"),
});
safeExpose("ir", irBridge as unknown as Record<string, unknown>);
safeExpose("electron", electronBridge as unknown as Record<string, unknown>);

console.info("[preload] runner + IR bridge loaded");
