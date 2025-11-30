export type WorkspaceNode = {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  meta?: Record<string, unknown>;
};

export type WorkspaceDocument = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: WorkspaceNode[];
  meta?: {
    description?: string;
    tags?: string[];
    icon?: string;
    type?: string;
    trashedAt?: string;
    folder?: string;
  };
};

export type WorkspaceSummary = Omit<WorkspaceDocument, "nodes">;
