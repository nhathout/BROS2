// apps/desktop-app/src/types/global.d.ts

export {};

import type { ExecResult } from "@bros/runner";

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
  }
}

declare module "*.mp4" {
  const src: string;
  export default src;
}

