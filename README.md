<p align="left">
  <img src="assets/logos/BROS2-logo-long.png" alt="BROS2 logo" width="440">
</p>

BROS2 (Block ROS2) is an Electron desktop environment for building, simulating, and introspecting ROS2 graphs with a drag-and-drop block interface. It streamlines going from idea to runnable robot behavior by generating ROS packages, launch files, and providing live insight into running nodes.

Basically, BROS2 (Block ROS2) is an Electron desktop app that lets you assemble ROS2 graphs visually and run them through a managed Docker workspace 🦾🤖

## 🔎 Why BROS2?
- Visual composition of ROS 2 nodes, topics, and services without leaving the editor.
- Automatic generation of package scaffolding and launch files from the block graph.
- Integrated simulation hooks (Gazebo, Isaac) and telemetry panels for rapid iteration.
- Cross-platform desktop app distributed via Electron so teams share a single workflow.

## 📋 Requirements
- macOS (Apple Silicon or Intel) or Linux with Docker Desktop / Docker Engine running.
- Git, curl, and bash (used by the bootstrap script).
- Internet access to download Node, pnpm, and Electron during setup.

Verify Docker access before continuing:

```bash
docker ps
```

## 🧱 First-Time Setup

```bash
git clone https://github.com/nhathout/BROS2.git
cd BROS2
./apps/desktop-app/scripts/bootstrap.sh
```

The bootstrap script installs or activates:
- `nvm` (if missing) and Node `20.19.0`.
- pnpm `10.17.1` via Corepack (or npm fallback).
- Workspace dependencies with `pnpm install -r`.
- Electron binaries and a first build of the desktop app.

It launches the packaged app once everything compiles. If the script adds an `nvm use` snippet to your shell profile, open a new terminal so `pnpm` is on your `PATH` next time.

## ⏳ Daily Development

1. **Select Node 20.19.x** (every new shell resets your `nvm` version):

   ```bash
   source ~/.nvm/nvm.sh
   nvm use 20.19.0
   ```

2. **Refresh dependencies** after pulling changes:

   ```bash
   pnpm install -r
   ```

3. **Build the workspace libraries** so their `.d.ts` files exist for the Electron main process. Run each filter separately from the repo root (brace expansion is not supported):

   ```bash
   pnpm --filter @bros2/runtime build
   pnpm --filter @bros2/shared build
   pnpm --filter @bros2/ui build
   pnpm --filter @bros2/validation build
   pnpm --filter @bros2/runner build
   ```

4. **Emit the desktop main + preload bundle** (run from the repo root).  
   _Do not skip this step after running `pnpm -r clean`; it regenerates the preload bridges and the runtime registry that power `window.runtime`._

   ```bash
   pnpm --filter ./apps/desktop-app build:main
   ```

   (Optional) Build the renderer bundle for production checks — also from the repo root:

   ```bash
   pnpm --filter ./apps/desktop-app build:renderer
   ```

5. **Start the dev environment** (Electron main + Vite renderer):

   ```bash
   pnpm --filter ./apps/desktop-app dev
   ```

   Keep this process running while you iterate. You can still `cd apps/desktop-app && pnpm dev`, but the filtered form avoids path mistakes. After Electron opens, pop open DevTools and run `typeof window.runtime`—it should log `"object"` if the preload bridges built correctly.

If Electron complains about missing binaries, reinstall them once:

```bash
cd apps/desktop-app
node node_modules/electron/install.js
```

## 🤖 ROS 2 Dev Notes

The preload bridge exposes `window.runner` for Docker-backed ROS 2 sessions and `window.ir` for graph validation.

```ts
window.runner.up(projectName: string): Promise<void>;
window.runner.exec(command: string): Promise<{ stdout: string; stderr: string; code: number }>;
window.runner.down(): Promise<void>;

window.ir.build(graph: BlockGraph): Promise<{ ir: IR; issues: string[] }>;
window.ir.validate(ir: IR): Promise<{ errors: Issue[]; warnings: Issue[] }>;
```

### ☑️ Runner sanity check (DevTools)

With Docker running and the app in dev mode, open DevTools (`View → Toggle Developer Tools`) and run:

```js
await window.runner.up("hello_ros");
await window.runner.exec("ros2 --help");
await window.runner.exec("ros2 pkg list | head -n 5");
await window.runner.down();
```

This spins up the `bros_hello_ros` container defined in `Projects/hello_ros` and exercises the ROS 2 CLI.

### IR build + validation example

```js
const graph = {
  blocks: [
    { kind: "node", id: "talker", name: "talker" },
    { kind: "publish", nodeId: "talker", topic: "/chatter", type: "std_msgs/msg/String" },
  ],
};

const { ir, issues } = await window.ir.build(graph);
const { errors, warnings } = await window.ir.validate(ir);
console.log({ issues, errors, warnings });
```

### Runtime bridge & ArrowKey publisher smoke test

The preload now exposes `window.runtime` alongside the runner and IR bridges. With the dev app running:

```js
typeof window.runtime; // "object"
const id = window.runtime.create("ArrowKeyPub", { topic: "keys/arrows" });
window.runtime.start(id);
// Press arrow keys while the Electron window is focused:
// [publish] keys/arrows <- { key: "left", ts: ... }
// [node:ArrowKeyPub_1] pressed: left
window.runtime.stop(id);
window.runtime.list(); // ["ArrowKeyPub_1"]
```

If `window.runtime` is missing, run `pnpm --filter ./apps/desktop-app build:main` again to regenerate the preload bridges.

## 🧹 Cleaning & Full Rebuild

1. Remove build outputs everywhere (this clears `dist/` folders and `tsconfig.main.tsbuildinfo`, ensuring the desktop main bundle re-emits `dist/main.js`):

   ```bash
   pnpm -r clean
   ```

2. Reset dependencies if things get out of sync:

   ```bash
   pnpm store prune   # optional
   rm -rf node_modules
   pnpm install -r
   ```

3. Rebuild the workspaces and desktop app using the daily workflow above. When `build:main` completes you should have:

   ```
   apps/desktop-app/dist/main.js
   apps/desktop-app/dist/preload.js
   apps/desktop-app/dist/remote/runtime-bridge.cjs
   apps/desktop-app/dist/renderer/runtime/registry.js
   ```

4. (Optional) Produce installers:

   ```bash
   pnpm -r build
   ```

   You may ignore macOS code-sign warnings on local development machines.

## 💡 Tips
- Keep Docker running whenever you use `window.runner.*`; the runner manages containers in `Projects/`.
- If `pnpm dev` fails because Electron is missing, re-run `node node_modules/electron/install.js`.
- Rerun the bootstrap script after major Node/pnpm upgrades—it is idempotent and safe to run again.
