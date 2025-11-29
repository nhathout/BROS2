const { contextBridge } = require("electron");
const { runtime } = require("../renderer/runtime/registry");

function safeExpose(key, api) {
  try {
    contextBridge.exposeInMainWorld(key, api);
  } catch (err) {
    if (err && err.message && err.message.includes("Cannot bind an API on top of an existing property")) {
      console.warn(`[runtime-bridge] ${key} already defined, skipping.`);
      return;
    }
    throw err;
  }
}

safeExpose("runtime", {
  create: (type, config) => runtime.create(type, config).id,
  start: (id) => runtime.start(id),
  stop: (id) => runtime.stop(id),
  startAll: () => runtime.startAll(),
  stopAll: () => runtime.stopAll(),
  list: () => runtime.list(),
});
