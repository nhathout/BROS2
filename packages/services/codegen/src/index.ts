// main API: generateWorkspaceFromIR()

import path from "node:path";
import fs from "fs-extra";
import type { IR, IRNode, IRPackage } from "@bros2/shared";
import { renderTemplateJinja2 } from "./py-driver.js";

/**
 * Options for codegen.
 * workspaceDir: absolute host path that your Runner mounts at /workspace
 * templateRoot: path to templates folder (packages/templates/ros2/python)
 */
export interface CodegenOptions {
  workspaceDir: string;
  templateRoot: string;
}

/**
 * Generate a ROS 2 (Python) workspace from MVP IR.
 * - One Python package per IR package
 * - One or two executables per node:
 *    * pubs only  -> <executable> (publisher)
 *    * subs only  -> <executable> (subscriber)
 *    * pubs+subs  -> <executable>_pub and <executable>_sub (two scripts)
 * - Launch file starts every generated executable.
 * Returns a summary with paths and the rendered launch text for preview.
 */
export async function generateWorkspaceFromIR(ir: IR, opts: CodegenOptions) {
  const ws = path.resolve(opts.workspaceDir);
  const srcRoot = path.join(ws, "src");
  await fs.ensureDir(srcRoot);

  const tpl = (name: string) => path.join(opts.templateRoot, name);

  // Collect launch entries (package, executable, namespace?)
  const launchEntries: Array<{ pkg: string; exec: string; ns?: string }> = [];

  for (const p of ir.packages) {
    await writePythonPackageFromIRPackage(p, srcRoot, tpl, launchEntries);
  }

  // top-level README
  await fs.writeFile(path.join(ws, "README.template.md"),
    await renderTemplateJinja2(tpl("README.template.md"), { packages: ir.packages }),
    "utf8"
  );

  // Generate a top-level launch file that launches all nodes
  const launchOut = await renderTemplateJinja2(tpl("main.launch.py.j2"), { entries: launchEntries });
  const launchPkg = ensureCommonLaunchPackage(srcRoot);  // place launch under a "bros_launch" package
  const launchPath = path.join(launchPkg.pkgDir, "launch", "main.launch.py");
  await fs.ensureDir(path.dirname(launchPath));
  await fs.writeFile(launchPath, launchOut, "utf8");

  return {
    workspaceDir: ws,
    launchFile: launchPath,
    launchPreview: launchOut
  };
}

async function writePythonPackageFromIRPackage(
  ipkg: IRPackage,
  srcRoot: string,
  tpl: (name: string) => string,
  launchEntries: Array<{ pkg: string; exec: string; ns?: string }>
) {
  const pkgName = ipkg.name;
  const pkgDir = path.join(srcRoot, pkgName);
  const modDir = path.join(pkgDir, pkgName.replace(/-/g, "_")); // python package dir

  await fs.ensureDir(modDir);
  await fs.ensureDir(path.join(pkgDir, "launch"));

  // package.xml & setup.py
  const pkgXml = await renderTemplateJinja2(tpl("package.xml.j2"), { package_name: pkgName });
  await fs.writeFile(path.join(pkgDir, "package.xml"), pkgXml, "utf8");

  const entries: string[] = []; // console_scripts lines
  const dataForSetup: Array<{ script: string; module: string; func: string }> = [];

  for (const node of ipkg.nodes) {
    const scripts = await writeNodePython(ipkg, node, modDir, tpl);
    for (const s of scripts) {
      // s is executable name and module:function
      entries.push(`${s.name}=${s.module}:${s.func}`);
      launchEntries.push({ pkg: pkgName, exec: s.name, ns: node.namespace });
      dataForSetup.push({ script: s.name, module: s.module, func: s.func });
    }
  }

  const setupPy = await renderTemplateJinja2(tpl("setup.py.j2"), {
    package_name: pkgName,
    module_name: path.basename(modDir),
    console_scripts: dataForSetup
  });
  await fs.writeFile(path.join(pkgDir, "setup.py"), setupPy, "utf8");

  // minimal __init__.py
  await fs.ensureFile(path.join(modDir, "__init__.py"));

  // Optional CMakeLists.txt (not needed for pure ament_python, but included for parity/tooling)
  const cmake = await renderTemplateJinja2(tpl("CMakeLists.txt.j2"), { package_name: pkgName });
  await fs.writeFile(path.join(pkgDir, "CMakeLists.txt"), cmake, "utf8");
}

/**
 * Writes Python node files based on pubs/subs presence.
 * Returns a list of console_script entries to add to setup.py.
 */
async function writeNodePython(
  ipkg: IRPackage,
  node: IRNode,
  modDir: string,
  tpl: (name: string) => string
): Promise<Array<{ name: string; module: string; func: string }>> {
  const hasPubs = (node.pubs || []).length > 0;
  const hasSubs = (node.subs || []).length > 0;

  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, "_");
  const baseExecutable = sanitize(node.executable || node.name);

  const entries: Array<{ name: string; module: string; func: string }> = [];

  if (hasPubs && !hasSubs) {
    const file = path.join(modDir, `${baseExecutable}.py`);
    const out = await renderTemplateJinja2(tpl("node_pub.py.j2"), {
      node_name: sanitize(node.name),
      pubs: node.pubs
    });
    await fs.writeFile(file, out, "utf8");
    entries.push({ name: baseExecutable, module: path.basename(modDir) + `.${baseExecutable}`, func: "main" });
  } else if (!hasPubs && hasSubs) {
    const file = path.join(modDir, `${baseExecutable}.py`);
    const out = await renderTemplateJinja2(tpl("node_sub.py.j2"), {
      node_name: sanitize(node.name),
      subs: node.subs
    });
    await fs.writeFile(file, out, "utf8");
    entries.push({ name: baseExecutable, module: path.basename(modDir) + `.${baseExecutable}`, func: "main" });
  } else if (hasPubs && hasSubs) {
    // MVP compromise: create two executables: *_pub and *_sub
    const pubName = `${baseExecutable}_pub`;
    const subName = `${baseExecutable}_sub`;

    const pubFile = path.join(modDir, `${pubName}.py`);
    const pubOut = await renderTemplateJinja2(tpl("node_pub.py.j2"), {
      node_name: sanitize(node.name) + "_pub",
      pubs: node.pubs
    });
    await fs.writeFile(pubFile, pubOut, "utf8");
    entries.push({ name: pubName, module: path.basename(modDir) + `.${pubName}`, func: "main" });

    const subFile = path.join(modDir, `${subName}.py`);
    const subOut = await renderTemplateJinja2(tpl("node_sub.py.j2"), {
      node_name: sanitize(node.name) + "_sub",
      subs: node.subs
    });
    await fs.writeFile(subFile, subOut, "utf8");
    entries.push({ name: subName, module: path.basename(modDir) + `.${subName}`, func: "main" });
  } else {
    // node with no pubs/subs — generate a placeholder to keep package valid
    const file = path.join(modDir, `${baseExecutable}.py`);
    const placeholder = `#!/usr/bin/env python3
import rclpy
from rclpy.node import Node

def main():
    rclpy.init()
    node = Node("${sanitize(node.name)}")
    rclpy.spin_once(node, timeout_sec=0.1)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == "__main__":
    main()
`;
    await fs.writeFile(file, placeholder, "utf8");
    entries.push({ name: baseExecutable, module: path.basename(modDir) + `.${baseExecutable}`, func: "main" });
  }

  return entries;
}

/** Ensure a tiny "bros_launch" package exists to host the unified main.launch.py */
function ensureCommonLaunchPackage(srcRoot: string) {
  const pkgName = "bros_launch";
  const pkgDir = path.join(srcRoot, pkgName);
  const modDir = path.join(pkgDir, pkgName);
  fs.ensureDirSync(path.join(pkgDir, "launch"));
  fs.ensureDirSync(modDir);
  const pkgXml = `<?xml version="1.0"?>
<package format="3">
  <name>${pkgName}</name>
  <version>0.0.1</version>
  <description>Launch files for 2 workspace</description>
  <maintainer email="dev@bros2.local">BROS2</maintainer>
  <license>Apache-2.0</license>
  <buildtool_depend>ament_cmake</buildtool_depend>
  <exec_depend>launch</exec_depend>
  <exec_depend>launch_ros</exec_depend>
</package>
`;
  fs.writeFileSync(path.join(pkgDir, "package.xml"), pkgXml, "utf8");
  const cmake = `cmake_minimum_required(VERSION 3.5)
project(${pkgName})
find_package(ament_cmake REQUIRED)
install(DIRECTORY launch DESTINATION share/${pkgName}/)
ament_package()
`;
  fs.writeFileSync(path.join(pkgDir, "CMakeLists.txt"), cmake, "utf8");
  fs.writeFileSync(path.join(modDir, "__init__.py"), "", "utf8");
  return { pkgDir, modDir };
}