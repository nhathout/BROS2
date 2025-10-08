import type { ExecResult, LogFn, RunnerOptions } from "./types.js";
export declare class Runner {
    readonly projectName: string;
    readonly workspaceHostPath: string;
    readonly image: string;
    readonly containerName: string;
    private readonly projectId;
    private readonly composeFilePath;
    constructor(options: RunnerOptions);
    static defaultProject(projectName?: string): Runner;
    up(log?: LogFn): Promise<void>;
    exec(command: string, log?: LogFn): Promise<ExecResult>;
    down(log?: LogFn): Promise<void>;
}
export type { RunnerOptions, ExecResult, LogFn } from "./types.js";
