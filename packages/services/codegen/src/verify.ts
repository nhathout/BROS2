import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import fs from "fs-extra";
import { execa } from "execa";
import type { IR } from "@bros2/shared";
import { generateWorkspaceFromIR } from "./index.js";

const TEMPLATE_ROOT = path.join(process.cwd(), "packages", "templates", "ros2", "python");

export async function checkPythonAndJinja2() {
  try {
    await execa("python3", ["-c", "import jinja2"], { stdio: "ignore" });
  } catch (error) {
    const message = [
      "Python 3 with jinja2 is required to run codegen verification.",
      "Verify python3 is on PATH and install jinja2 with `pip install jinja2`."
    ].join(" ");
    if (error instanceof Error) {
      error.message = `${message}\nCause: ${error.message}`;
      throw error;
    }
    throw new Error(message);
  }
}

export function createExampleIR(): IR {
  return {
    packages: [
      {
        name: "bros2_example_py",
        lang: "python",
        nodes: [
          {
            id: "talker",
            name: "talker",
            package: "bros2_example_py",
            executable: "talker",
            lang: "python",
            pubs: [
              {
                topic: "/chatter",
                type: "std_msgs/msg/String"
              }
            ]
          },
          {
            id: "listener",
            name: "listener",
            package: "bros2_example_py",
            executable: "listener",
            lang: "python",
            subs: [
              {
                topic: "/chatter",
                type: "std_msgs/msg/String"
              }
            ]
          }
        ]
      }
    ]
  };
}

async function assertExists(target: string, label: string) {
  if (!(await fs.pathExists(target))) {
    throw new Error(`Expected ${label} at ${target}`);
  }
}

async function assertAnyExists(candidates: string[], label: string) {
  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) return;
  }
  const searched = candidates.join(", ");
  throw new Error(`Expected ${label}. Checked: ${searched}`);
}

async function runVerify() {
  await checkPythonAndJinja2();

  const ir = createExampleIR();
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "bros2-codegen-"));
  try {
    const result = await generateWorkspaceFromIR(ir, {
      workspaceDir,
      templateRoot: TEMPLATE_ROOT
    });

    await assertExists(
      path.join(workspaceDir, "src", "bros2_example_py", "package.xml"),
      "package.xml"
    );
    await assertExists(
      path.join(workspaceDir, "src", "bros2_example_py", "setup.py"),
      "setup.py"
    );
    await assertAnyExists(
      [
        path.join(workspaceDir, "src", "bros2_example_py", "bros2_example_py", "talker.py"),
        path.join(workspaceDir, "src", "bros2_example_py", "bros2_example_py", "talker_pub.py")
      ],
      "talker executable"
    );
    await assertAnyExists(
      [
        path.join(workspaceDir, "src", "bros2_example_py", "bros2_example_py", "listener.py"),
        path.join(workspaceDir, "src", "bros2_example_py", "bros2_example_py", "listener_sub.py")
      ],
      "listener executable"
    );
    await assertExists(
      path.join(workspaceDir, "src", "bros2_launch", "launch", "main.launch.py"),
      "main launch file"
    );

    console.log(result.launchPreview.trim());
    console.log("pnpm -r build");
    console.log("pnpm --filter @bros2/codegen verify");
    console.log("pnpm --filter @bros2/codegen smoke:runner   # optional; requires Docker + @bros2/runner");
    console.log("✅ Codegen verify OK");
  } finally {
    await fs.remove(workspaceDir);
  }
}

if (process.argv[1]) {
  const entryUrl = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === entryUrl) {
    runVerify().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
  }
}
