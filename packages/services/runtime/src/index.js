import { EventEmitter } from "node:events";
export class Runtime {
    bus = new EventEmitter();
    registry;
    nodes = new Map();
    idSeq = 0;
    constructor(registry = {}) {
        this.registry = registry;
    }
    register(type, factory) {
        this.registry[type] = factory;
    }
    create(type, config, id) {
        const factory = this.registry[type];
        if (!factory)
            throw new Error(`Unknown node type: ${type}`);
        const nodeId = id || `${type}_${++this.idSeq}`;
        const ctx = {
            id: nodeId,
            bus: this.bus,
            publish: (topic, data) => {
                const evt = { topic, data, from: nodeId, ts: Date.now() };
                this.bus.emit(topic, evt);
                // default: mirror all publishes to console for now
                console.log(`[publish] ${topic} <-`, data);
            },
            log: (msg) => console.log(`[node:${nodeId}] ${msg}`)
        };
        const inst = factory(ctx, config);
        this.nodes.set(nodeId, inst);
        return inst;
    }
    start(id) { this.nodes.get(id)?.start(); }
    stop(id) { this.nodes.get(id)?.stop(); }
    startAll() { for (const n of this.nodes.values())
        n.start(); }
    stopAll() { for (const n of this.nodes.values())
        n.stop(); }
    list() { return Array.from(this.nodes.keys()); }
}
