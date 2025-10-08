import type Dockerode from "dockerode";
import type { LogFn } from "./types.js";
interface DemuxResult {
    stdout: string;
    stderr: string;
}
export declare function demuxExecStream(docker: Dockerode, stream: NodeJS.ReadableStream, log?: LogFn): Promise<DemuxResult>;
export {};
