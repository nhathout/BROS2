import Docker from "dockerode";
import { execa } from "execa";
import type { ExecResult, LogFn } from "./types.js";
import { demuxExecStream } from "./pty.js";

const docker = new Docker();

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: number }).statusCode === 404
  );
}

async function imageExists(image: string): Promise<boolean> {
  try {
    await docker.getImage(image).inspect();
    return true;
  } catch (error) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export async function ensureImage(image: string, log?: LogFn): Promise<void> {
  if (await imageExists(image)) {
    log?.(`Docker image ${image} already present.`);
    return;
  }

  log?.(`Pulling Docker image ${image}...`);
  const stream = await docker.pull(image);
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
  log?.(`Docker image ${image} ready.`);
}

export async function composeUp(
  composeFilePath: string,
  projectName: string,
  log?: LogFn
): Promise<void> {
  log?.(`Starting Docker Compose project ${projectName}...`);
  await execa("docker", [
    "compose",
    "-f",
    composeFilePath,
    "-p",
    projectName,
    "up",
    "-d"
  ]);
  log?.(`Docker Compose project ${projectName} is running.`);
}

export async function composeDown(
  composeFilePath: string,
  projectName: string,
  log?: LogFn
): Promise<void> {
  log?.(`Stopping Docker Compose project ${projectName}...`);
  await execa("docker", [
    "compose",
    "-f",
    composeFilePath,
    "-p",
    projectName,
    "down"
  ]);
  log?.(`Docker Compose project ${projectName} stopped.`);
}

export async function execInContainer(
  containerName: string,
  command: string,
  log?: LogFn
): Promise<ExecResult> {
  const container = docker.getContainer(containerName);

  try {
    const details = await container.inspect();
    if (details.State.Status !== "running") {
      throw new Error(`Container ${containerName} is not running (status: ${details.State.Status}).`);
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error(`Container ${containerName} not found. Did you call up()?`);
    }
    throw error;
  }

  const execCommand = [
    "bash",
    "-lc",
    `. /ros_entrypoint.sh 2>/dev/null || true; (${command}) | cat`
  ];

  const exec = await container.exec({
    Cmd: execCommand,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false
  });

  const stream = await exec.start({ hijack: true, stdin: false });
  const { stdout, stderr } = await demuxExecStream(docker, stream, log);
  const { ExitCode } = await exec.inspect();

  return {
    code: ExitCode ?? 0,
    stdout,
    stderr
  };
}
