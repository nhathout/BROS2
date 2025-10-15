// calls system Python to render Jinja2 templates

import { execa } from "execa";
import path from "node:path";
import fs from "node:fs";

/**
 * Thin wrapper around system Python + Jinja2.
 * We ship a tiny embedded Python script that:
 *  - loads the template file,
 *  - renders with a JSON context,
 *  - prints the result to stdout.
 *
 * Requires: python3 with 'jinja2' installed inside the host (NOT the ROS container).
 */
export async function renderTemplateJinja2(templatePath: string, context: unknown): Promise<string> {
  const py = `
import sys, json, os
from jinja2 import Environment, FileSystemLoader

template_path = sys.argv[1]
data = json.loads(sys.stdin.read())
tpl_dir = os.path.dirname(template_path)
tpl_name = os.path.basename(template_path)
env = Environment(loader=FileSystemLoader(tpl_dir), trim_blocks=True, lstrip_blocks=True)
tpl = env.get_template(tpl_name)
sys.stdout.write(tpl.render(**data))
`;
  // write a throwaway script to tmp (avoid long -c strings on Windows)
  const tmpScript = path.join(process.cwd(), ".tmp_codegen_render.py");
  fs.writeFileSync(tmpScript, py, "utf8");
  try {
    const { stdout } = await execa("python3", [tmpScript, templatePath], {
      input: JSON.stringify(context),
      timeout: 60_000
    });
    return stdout;
  } finally {
    try { fs.unlinkSync(tmpScript); } catch {}
  }
}