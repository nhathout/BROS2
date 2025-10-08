# BROS

BROS (Block ROS) is an Electron desktop environment for building, simulating, and introspecting ROS 2 graphs with a drag-and-drop block interface. It streamlines going from idea to runnable robot behavior by generating ROS packages, launch files, and providing live insight into running nodes.

## Why BROS?
- Visual composition of ROS 2 nodes, topics, and services without leaving the editor.
- Automatic generation of package scaffolding and launch files from the block graph.
- Integrated simulation hooks (Gazebo, Isaac) and telemetry panels for rapid iteration.
- Cross-platform desktop app distributed via Electron so teams share a single workflow.

## Prerequisites
- macOS (Apple Silicon or Intel) or Linux with Docker Desktop / Docker Engine installed and running.
- `nvm` for Node version management (installed automatically by the bootstrap script if missing).
- Node `20.19.x` and pnpm `10.x` (configured by the bootstrap script).

Verify Docker CLI access before launching the app:

```bash
which docker
docker ps
```

## Setup & Install

### 1. Bootstrap the workspace

```bash
git clone https://github.com/nhathout/BROS.git
cd BROS
./apps/desktop-app/scripts/bootstrap.sh
cd apps/desktop-app/
node node_modules/electron/install.js
pnpm dev
```

What the script does:
- Ensures `nvm` is present and switches to Node `20.19.0`.
- Installs pnpm `10.17.1` via Corepack (or npm fallback).
- Runs `pnpm install -r` to hydrate all workspaces.
- Builds the Electron main process and renderer bundles.
- Launches the BROS desktop binary once the build finishes.
- Adds `nvm use` to your shell profile (optional prompt) so new terminals select the correct Node version.

Restart the shell if you are prompted so `pnpm` is on the `PATH`.

### 2. Install / refresh dependencies manually

Any time dependencies change (for example when pulling new workspace packages) run:

```bash
pnpm install
```

This command wires all local packages together (e.g. `@bros/ui`, `@bros/validation`) so TypeScript and the Electron main process can resolve them.

## Build & Development Workflow

### Full workspace build

Compiles every workspace package (shared → UI → runner → validation → desktop app) and packages the desktop app via Electron Builder:

```bash
pnpm -r build
```

Use this when you need a production build or fresh type declarations everywhere. Artifacts end up in:
- `packages/**/dist/` for shared libraries.
- `apps/desktop-app/dist/` for the main process + preloads.
- `apps/desktop-app/release/` for packaged Electron binaries.

### Faster iterative builds

For day-to-day development you can build only the pieces that change:

```bash
pnpm --filter @bros/shared build
pnpm --filter @bros/ui build
pnpm --filter @bros/runner build
pnpm --filter @bros/validation build
pnpm --filter ./apps/desktop-app build:main       # one-off compile
# or keep it running:
pnpm --filter ./apps/desktop-app build:main:watch
```

The order above guarantees that the Electron main process sees fresh declaration files.

### Run the desktop app in dev mode

Start the renderer and Electron in separate terminals (after running `build:main` at least once):

```bash
# Terminal 1 – Vite dev server for renderer assets
pnpm --filter ./apps/desktop-app dev

# Terminal 2 – Electron, pointing at the dev server
pnpm --filter ./apps/desktop-app electron:dev
```

If you are not running `build:main:watch`, re-run `pnpm --filter ./apps/desktop-app build:main` whenever main-process or preload code changes, then restart `electron:dev`.

## Using the Preload Bridges

The preload script exposes two namespaces:

```ts
window.runner.up(projectName: string): Promise<void>
window.runner.exec(command: string): Promise<{ stdout: string; stderr: string; code: number }>
window.runner.down(): Promise<void>

window.ir.build(graph: BlockGraph): Promise<{ ir: IR; issues: string[] }>
window.ir.validate(ir: IR): Promise<{ errors: Issue[]; warnings: Issue[] }>
```

### Runner sanity check (DevTools)

With Docker running, open DevTools (`View → Toggle Developer Tools`) and run:

```js
await window.runner.up("hello_ros");
await window.runner.exec("ros2 --help");
await window.runner.exec("ros2 pkg list | head -n 5");
await window.runner.down();
```

You should see Docker bring up a container named `bros_hello_ros`, and new files appear under `~/BROS/Projects/hello_ros/`.

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

## Testing

- Validation rules (`@bros/validation`):

  ```bash
  pnpm --filter @bros/validation test
  ```

  Runs Vitest covering duplicate node detection, topic type mismatches, and orphan publishers/subscribers.

- UI + shared packages (when tests are added):

  ```bash
  pnpm --filter @bros/ui test
  pnpm --filter @bros/shared test
  ```

- Execute every registered suite at once:

  ```bash
  pnpm -r test
  ```

## Cleaning the Workspace

Remove compiled artifacts everywhere:

```bash
pnpm -r clean
```

This clears `dist/`, `release/`, `tsconfig.tsbuildinfo`, and similar outputs for every package. After cleaning run a build to regenerate declarations:

```bash
pnpm -r build
# or rebuild selectively, e.g.
pnpm --filter @bros/validation build
pnpm --filter ./apps/desktop-app build:main
```

To fully reset dependencies:

```bash
pnpm store prune
rm -rf node_modules
pnpm install
```

## Notes & Tips
- Keep Docker running whenever you interact with `window.runner.*` APIs.
- Rerun `pnpm install` after pulling changes that add or rename workspace packages.
- The bootstrap script is idempotent; rerun it after upgrading your shell or Node toolchain.
- Electron Builder artifacts land in `apps/desktop-app/release/`; use `open` (macOS) or the file manager to launch packaged builds.
