// CommonJS preload bridge (.cts -> .cjs)
const { contextBridge } = require("electron");
// Import the runtime instance from the renderer registry
const { runtime } = require("../renderer/runtime/registry");

function safeExpose(key: string, api: Record<string, unknown>) {
  try {
    contextBridge.exposeInMainWorld(key, api);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Cannot bind an API on top of an existing property")) return;
    throw err;
  }
}

safeExpose("runtime", {
  create: (type: string, config?: any) => runtime.create(type, config).id,
  start: (id: string) => runtime.start(id),
  stop: (id: string) => runtime.stop(id),
  startAll: () => runtime.startAll(),
  stopAll: () => runtime.stopAll(),
  list: () => runtime.list(),
});
