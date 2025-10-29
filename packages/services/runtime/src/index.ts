import { EventEmitter } from "node:events";

export type Topic = string;
export interface Publish {
  topic: Topic;
  data: unknown;
  ts: number;
  from: string; // node id
}

export interface NodeContext {
  id: string;
  bus: EventEmitter;
  publish: (topic: Topic, data: unknown) => void;
  log: (msg: string) => void;
}

export interface NodeInstance {
  id: string;
  start(): void;
  stop(): void;
}

export type NodeFactory = (ctx: NodeContext, config?: any) => NodeInstance;

export class Runtime {
  readonly bus = new EventEmitter();
  private registry: Record<string, NodeFactory>;
  private nodes = new Map<string, NodeInstance>();
  private idSeq = 0;

  constructor(registry: Record<string, NodeFactory> = {}) {
    this.registry = registry;
  }

  register(type: string, factory: NodeFactory) {
    this.registry[type] = factory;
  }

  create(type: string, config?: any, id?: string): NodeInstance {
    const factory = this.registry[type];
    if (!factory) throw new Error(`Unknown node type: ${type}`);
    const nodeId = id || `${type}_${++this.idSeq}`;
    const ctx: NodeContext = {
      id: nodeId,
      bus: this.bus,
      publish: (topic, data) => {
        const evt: Publish = { topic, data, from: nodeId, ts: Date.now() };
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

  start(id: string) { this.nodes.get(id)?.start(); }
  stop(id: string) { this.nodes.get(id)?.stop(); }
  startAll() { for (const n of this.nodes.values()) n.start(); }
  stopAll() { for (const n of this.nodes.values()) n.stop(); }

  list() { return Array.from(this.nodes.keys()); }
}