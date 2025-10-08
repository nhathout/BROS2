import type { ExecResult, LogFn } from "./types.js";
export declare function ensureImage(image: string, log?: LogFn): Promise<void>;
export declare function composeUp(composeFilePath: string, projectName: string, log?: LogFn): Promise<void>;
export declare function composeDown(composeFilePath: string, projectName: string, log?: LogFn): Promise<void>;
export declare function execInContainer(containerName: string, command: string, log?: LogFn): Promise<ExecResult>;
