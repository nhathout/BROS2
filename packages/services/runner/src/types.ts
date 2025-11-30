export type LogFn = (message: string) => void;

export interface RunnerOptions {
  projectName: string;
  workspaceHostPath: string;
  image?: string;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface PortMapping {
  host: number | string;
  container: number | string;
  protocol?: "tcp" | "udp";
}

export interface ComposeOptions {
  containerName: string;
  workspaceHostPath: string;
  image: string;
  ports?: PortMapping[];
}
