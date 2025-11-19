import type { WorkspaceDocument, WorkspaceSummary } from "../shared/workspace";

declare global {
  interface Window {
    electron: {
      login: () => Promise<any>;
      loginGoogle: () => Promise<any>;
    };
    workspace: {
      list: () => Promise<WorkspaceSummary[]>;
      create: (
        payload?: {
          name?: string;
          template?: Partial<WorkspaceDocument> | null;
          meta?: WorkspaceDocument["meta"];
        }
      ) => Promise<WorkspaceDocument>;
      load: (id: string) => Promise<WorkspaceDocument>;
      save: (id: string, data: WorkspaceDocument) => Promise<WorkspaceDocument>;
    };
  }
}

export {};
