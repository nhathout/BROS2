const { contextBridge } = require("electron");
const { runtime } = require("../renderer/runtime/registry");

contextBridge.exposeInMainWorld("runtime", {
  create: (type, config) => runtime.create(type, config).id,
  start: (id) => runtime.start(id),
  stop: (id) => runtime.stop(id),
  startAll: () => runtime.startAll(),
  stopAll: () => runtime.stopAll(),
  list: () => runtime.list(),
});
