// CommonJS preload bridge (.cts -> .cjs)
const { contextBridge } = require("electron");
// Import the runtime instance from the renderer registry
const { runtime } = require("../renderer/runtime/registry");

contextBridge.exposeInMainWorld("runtime", {
  create: (type: string, config?: any) => runtime.create(type, config).id,
  start: (id: string) => runtime.start(id),
  stop: (id: string) => runtime.stop(id),
  startAll: () => runtime.startAll(),
  stopAll: () => runtime.stopAll(),
  list: () => runtime.list(),
});