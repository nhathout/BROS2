import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "fs-extra";
import { generateWorkspaceFromIR } from "./index.js";
import { createExampleIR } from "./verify.js";

const TEMPLATE_ROOT = path.join(process.cwd(), "packages", "templates", "ros2", "python");

async function runSmoke() {
  let runnerModule: typeof import("@bros2/runner") | undefined;
  try {
    runnerModule = await import("@bros2/runner");
  } catch {
    console.log("(skipped) @bros2/runner not available");
    return;
  }

  const { Runner } = runnerModule;
  if (!Runner) {
    console.log("(skipped) @bros2/runner has no Runner export");
    return;
  }

  const projectName = "hello_ros";
  const workspaceDir = path.join(os.homedir(), "BROS2", "Projects", projectName, "workspace");

  await fs.ensureDir(workspaceDir);
  const ir = createExampleIR();
  await generateWorkspaceFromIR(ir, {
    workspaceDir,
    templateRoot: TEMPLATE_ROOT
  });

  const runner = Runner.defaultProject(projectName);
  await runner.up();
  await runner.exec("colcon build --merge-install");
  await runner.exec('bash -lc "source install/setup.bash && ros2 launch bros2_launch main.launch.py"');

  console.log("🚀 Runner smoke test completed successfully.");
}

if (process.argv[1]) {
  const entryUrl = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryUrl) {
    runSmoke().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
  }
}
