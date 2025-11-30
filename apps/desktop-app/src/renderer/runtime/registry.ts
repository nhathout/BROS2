// Lightweight in-renderer runtime backed by a minimal EventEmitter-compatible bus
// to satisfy the @bros2/runtime NodeContext typing while running in the browser.
import type { EventEmitter } from "node:events";

type Topic = string;
type Publish = { topic: Topic; data: unknown; ts: number; from: string };

export interface NodeContext {
  id: string;
  bus: SimpleEmitter;
  publish: (topic: Topic, data: unknown) => void;
  log: (msg: string) => void;
}

export interface NodeInstance {
  id: string;
  start(): void;
  stop(): void;
}

type Factory = (ctx: NodeContext, config?: any) => NodeInstance;

// Minimal EventEmitter implementation to match @bros2/runtime typing.
class SimpleEmitter implements EventEmitter {
  private _listeners = new Map<string | symbol, Set<(...args: any[]) => void>>();
  private _max = 0;

  addListener(eventName: string | symbol, listener: (...args: any[]) => void) {
    return this.on(eventName, listener);
  }

  on(eventName: string | symbol, listener: (...args: any[]) => void) {
    const set = this._listeners.get(eventName) ?? new Set<(...args: any[]) => void>();
    set.add(listener);
    this._listeners.set(eventName, set);
    return this;
  }

  once(eventName: string | symbol, listener: (...args: any[]) => void) {
    const wrapper = (...args: any[]) => {
      this.off(eventName, wrapper);
      listener(...args);
    };
    return this.on(eventName, wrapper);
  }

  prependListener(eventName: string | symbol, listener: (...args: any[]) => void) {
    const set = this._listeners.get(eventName) ?? new Set<(...args: any[]) => void>();
    this._listeners.set(eventName, new Set([listener, ...set]));
    return this;
  }

  prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void) {
    const wrapper = (...args: any[]) => {
      this.off(eventName, wrapper);
      listener(...args);
    };
    return this.prependListener(eventName, wrapper);
  }

  removeListener(eventName: string | symbol, listener: (...args: any[]) => void) {
    return this.off(eventName, listener);
  }

  off(eventName: string | symbol, listener: (...args: any[]) => void) {
    const set = this._listeners.get(eventName);
    if (!set) return this;
    set.delete(listener);
    if (set.size === 0) this._listeners.delete(eventName);
    return this;
  }

  removeAllListeners(eventName?: string | symbol) {
    if (typeof eventName === "undefined") {
      this._listeners.clear();
    } else {
      this._listeners.delete(eventName);
    }
    return this;
  }

  emit(eventName: string | symbol, ...args: any[]) {
    const set = this._listeners.get(eventName);
    if (!set) return false;
    for (const handler of Array.from(set)) {
      try {
        handler(...args);
      } catch (err) {
        console.error("[runtime] listener error", err);
      }
    }
    return set.size > 0;
  }

  listenerCount(eventName?: string | symbol): number {
    if (typeof eventName === "undefined") return Array.from(this._listeners.values()).reduce((sum, s) => sum + s.size, 0);
    return this._listeners.get(eventName)?.size ?? 0;
  }

  eventNames(): Array<string | symbol> {
    return Array.from(this._listeners.keys());
  }

  listeners(eventName: string | symbol): Function[] {
    return Array.from(this._listeners.get(eventName) ?? []);
  }

  rawListeners(eventName: string | symbol): Function[] {
    return this.listeners(eventName);
  }

  getMaxListeners(): number {
    return this._max;
  }

  setMaxListeners(n: number): this {
    this._max = n;
    return this;
  }
}

class Runtime {
  readonly bus = new SimpleEmitter();
  private registry: Record<string, Factory>;
  private nodes = new Map<string, NodeInstance>();
  private idSeq = 0;

  constructor(registry: Record<string, Factory> = {}) {
    this.registry = registry;
  }

  register(type: string, factory: Factory) {
    this.registry[type] = factory;
  }

  has(type: string) {
    return Boolean(this.registry[type]);
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
        console.log(`[publish] ${topic} <-`, data);
      },
      log: (msg) => console.log(`[node:${nodeId}] ${msg}`),
    };
    const inst = factory(ctx, config);
    this.nodes.set(nodeId, inst);
    return inst;
  }

  start(id: string) {
    this.nodes.get(id)?.start();
  }

  stop(id: string) {
    this.nodes.get(id)?.stop();
  }

  startAll() {
    for (const n of this.nodes.values()) n.start();
  }

  stopAll() {
    for (const n of this.nodes.values()) n.stop();
  }

  list() {
    return Array.from(this.nodes.keys());
  }
}

import { ArrowKeyPub } from "./nodes/ArrowKeyPub";
import { ConsoleSub } from "./nodes/ConsoleSub";
import { Forwarder } from "./nodes/Forwarder";
import { RosbridgeBridge } from "./nodes/RosbridgeBridge";

const baseRegistry: Record<string, Factory> = {
  ArrowKeyPub: (ctx, config) => new ArrowKeyPub(ctx, config),
  ConsoleSub: (ctx, config) => new ConsoleSub(ctx, config),
};

export const registry: Record<string, Factory> = {
  ...baseRegistry,
  RosbridgeBridge: (ctx, config) => new RosbridgeBridge(ctx, config),
  Forwarder: (ctx, config) => new Forwarder(ctx, config),
};

export const runtime = new Runtime(registry);
