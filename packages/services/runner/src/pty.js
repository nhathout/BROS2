import { PassThrough } from "node:stream";
export async function demuxExecStream(docker, stream, log) {
    const stdoutChunks = [];
    const stderrChunks = [];
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    stdout.on("data", (chunk) => {
        stdoutChunks.push(chunk);
        log?.(chunk.toString());
    });
    stderr.on("data", (chunk) => {
        stderrChunks.push(chunk);
        log?.(chunk.toString());
    });
    stdout.resume();
    stderr.resume();
    return new Promise((resolve, reject) => {
        let settled = false;
        const finalize = () => {
            if (settled)
                return;
            settled = true;
            resolve({
                stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
                stderr: Buffer.concat(stderrChunks).toString("utf-8")
            });
        };
        docker.modem.demuxStream(stream, stdout, stderr);
        const handleError = (error) => {
            if (settled)
                return;
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
