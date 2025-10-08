import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { composeDown, composeUp, ensureImage, execInContainer } from "./docker.js";
import { writeComposeFile } from "./compose.js";
const DEFAULT_IMAGE = "ros:humble";
const PROJECT_ROOT = path.join(os.homedir(), "BROS", "Projects");
function sanitizeProjectId(input) {
    const normalized = input.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized.length > 0 ? normalized : "default";
}
function sanitizeProjectDirName(input) {
    const trimmed = input.trim().toLowerCase();
    const replaced = trimmed.replace(/[^a-z0-9-_]/g, "_");
    const squashed = replaced.replace(/_+/g, "_");
    const cleaned = squashed.replace(/^_+/, "").replace(/_+$/, "");
    return cleaned.length > 0 ? cleaned : "default";
}
function wrapLog(log, scope) {
    if (!log)
        return undefined;
    return (message) => log(`[${scope}] ${message}`);
}
export class Runner {
    projectName;
    workspaceHostPath;
    image;
    containerName;
    projectId;
    composeFilePath;
    constructor(options) {
        this.projectName = options.projectName;
        this.projectId = sanitizeProjectId(options.projectName);
        this.workspaceHostPath = path.resolve(options.workspaceHostPath);
        this.image = options.image ?? DEFAULT_IMAGE;
        this.containerName = `bros_${this.projectId}`;
        this.composeFilePath = path.join(path.dirname(this.workspaceHostPath), "docker-compose.yml");
    }
    static defaultProject(projectName = "default") {
        const dirName = sanitizeProjectDirName(projectName);
        const projectDir = path.join(PROJECT_ROOT, dirName);
        const workspaceHostPath = path.join(projectDir, "workspace");
        fs.mkdirSync(workspaceHostPath, { recursive: true });
        return new Runner({ projectName: dirName, workspaceHostPath });
    }
    async up(log) {
        const composeLog = wrapLog(log, `${this.containerName}:compose`);
        const imageLog = wrapLog(log, `${this.containerName}:image`);
        await fsp.mkdir(this.workspaceHostPath, { recursive: true });
        await writeComposeFile({
            containerName: this.containerName,
            workspaceHostPath: this.workspaceHostPath,
            image: this.image
        });
        await ensureImage(this.image, imageLog);
        await composeUp(this.composeFilePath, this.projectId, composeLog);
        const smokeLog = wrapLog(log, `${this.containerName}:smoke`);
        smokeLog?.("Running ros2 --help smoke test...");
        const smoke = await this.exec("ros2 --help", smokeLog);
        if (smoke.code !== 0) {
            const errorOutput = smoke.stderr || smoke.stdout;
            throw new Error(`ROS 2 smoke test failed with code ${smoke.code}: ${errorOutput}`);
        }
    }
    async exec(command, log) {
        const execLog = wrapLog(log, `${this.containerName}:exec`);
        execLog?.(`Running command: ${command}`);
        const result = await execInContainer(this.containerName, command, execLog);
        execLog?.(`Command exited with code ${result.code}.`);
        return result;
    }
    async down(log) {
        try {
            await fsp.access(this.composeFilePath, fs.constants.F_OK);
        }
        catch (error) {
            if (error.code === "ENOENT") {
                return;
            }
            throw error;
        }
        await composeDown(this.composeFilePath, this.projectId, wrapLog(log, `${this.containerName}:compose`));
    }
}
