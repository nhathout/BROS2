import { promises as fs } from "node:fs";
import path from "node:path";
function toPosixPath(input) {
    return input.split(path.sep).join("/");
}
function quote(value) {
    const escaped = value.replace(/"/g, '\\"');
    return `"${escaped}"`;
}
export async function writeComposeFile(options) {
    const { containerName, workspaceHostPath, image } = options;
    const composeDir = path.dirname(workspaceHostPath);
    await fs.mkdir(composeDir, { recursive: true });
    const composeFilePath = path.join(composeDir, "docker-compose.yml");
    const volumePath = quote(`${toPosixPath(workspaceHostPath)}:/workspace`);
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
        ""
    ].join("\n");
    try {
        const existing = await fs.readFile(composeFilePath, "utf-8");
        if (existing === content) {
            return composeFilePath;
        }
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    await fs.writeFile(composeFilePath, content, "utf-8");
    return composeFilePath;
}
