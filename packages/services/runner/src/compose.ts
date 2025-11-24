import { promises as fs } from "node:fs";
import path from "node:path";
import { ComposeOptions, PortMapping } from "./types.js";

function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
}

function quote(value: string): string {
  const escaped = value.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function formatPort({ host, container, protocol }: PortMapping): string {
  const hostStr = typeof host === "number" ? host.toString(10) : host;
  const containerStr = typeof container === "number" ? container.toString(10) : container;
  const proto = protocol ? `/${protocol}` : "";
  return quote(`${hostStr}:${containerStr}${proto}`);
}

export async function writeComposeFile(options: ComposeOptions): Promise<string> {
  const { containerName, workspaceHostPath, image, ports } = options;
  const composeDir = path.dirname(workspaceHostPath);
  await fs.mkdir(composeDir, { recursive: true });

  const composeFilePath = path.join(composeDir, "docker-compose.yml");
  const volumePath = quote(`${toPosixPath(workspaceHostPath)}:/workspace`);
  const portSection = ports?.length
    ? ["    ports:", ...ports.map((port) => `      - ${formatPort(port)}`)]
    : [];

  const content = [
    "services:",
    `  ${containerName}:`,
    `    image: ${image}`,
    `    container_name: ${containerName}`,
    '    command: bash -lc "sleep infinity"',
    "    working_dir: /workspace",
    "    tty: true",
    "    volumes:",
    `      - ${volumePath}`,
    ...portSection,
    ""
  ].join("\n");

  try {
    const existing = await fs.readFile(composeFilePath, "utf-8");
    if (existing === content) {
      return composeFilePath;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await fs.writeFile(composeFilePath, content, "utf-8");
  return composeFilePath;
}
