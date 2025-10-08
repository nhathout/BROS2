import { PassThrough } from "node:stream";
import type Dockerode from "dockerode";
import type { LogFn } from "./types.js";

interface DemuxResult {
  stdout: string;
  stderr: string;
}

export async function demuxExecStream(
  docker: Dockerode,
  stream: NodeJS.ReadableStream,
  log?: LogFn
): Promise<DemuxResult> {
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  const stdout = new PassThrough();
  const stderr = new PassThrough();

  stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
    log?.(chunk.toString());
  });

  stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
    log?.(chunk.toString());
  });

  stdout.resume();
  stderr.resume();

  return new Promise<DemuxResult>((resolve, reject) => {
    let settled = false;

    const finalize = () => {
      if (settled) return;
      settled = true;
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8")
      });
    };

    docker.modem.demuxStream(stream, stdout, stderr);

    const handleError = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    stream.on("error", handleError);
    stdout.on("error", handleError);
    stderr.on("error", handleError);

    stream.on("end", finalize);
    stream.on("close", finalize);
  });
}
