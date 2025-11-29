// apps/desktop-app/src/types/global.d.ts

export {};

import type { ExecResult } from "@bros2/runner";
import type { WorkspaceDocument, WorkspaceSummary } from "../shared/workspace";

declare global {
  interface Window {
    runner: {
      up(projectName: string): Promise<void>;
      exec(command: string): Promise<ExecResult>;
      down(): Promise<void>;
    };
    ir: {
      build(graph: any): Promise<{ ir: any; issues: string[] }>;
      validate(ir: any): Promise<{ errors: any[]; warnings: any[] }>;
    };
    electron: {
      login: () => Promise<{ success: boolean; error?: string }>;
      loginGoogle?: () => Promise<{ success: boolean; error?: string }>;
    };
    runtime: {
      create(type: string, config?: any): string;
      start(id: string): void;
      stop(id: string): void;
      startAll(): void;
      stopAll(): void;
      list(): string[];
    };
    workspace: {
      list(): Promise<WorkspaceSummary[]>;
      create(options?: {
        name?: string;
        template?: Partial<WorkspaceDocument> | null;
        meta?: WorkspaceDocument["meta"];
      }): Promise<WorkspaceDocument>;
      load(id: string): Promise<WorkspaceDocument>;
      save(id: string, data: WorkspaceDocument): Promise<WorkspaceDocument>;
      storageList(): Promise<
        Array<{
          id: string;
          name: string;
          path: string;
          bytes: number;
        }>
      >;
    };
    folder: {
      list(): Promise<Array<{ name: string; path: string; fullPath: string }>>;
      create(name: string, parent?: string | null): Promise<{ name: string; path: string; fullPath: string }>;
      open(path: string): Promise<boolean>;
      rename(payload: { oldPath: string; newName: string }): Promise<{ name: string; path: string }>;
      trash(path: string): Promise<{ path: string }>;
    };
  }
}

declare module "*.mp4" {
  const src: string;
  export default src;
}
