import { EventEmitter } from "node:events";
export type Topic = string;
export interface Publish {
    topic: Topic;
    data: unknown;
    ts: number;
    from: string;
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
export declare class Runtime {
    readonly bus: EventEmitter<[never]>;
    private registry;
    private nodes;
    private idSeq;
    constructor(registry?: Record<string, NodeFactory>);
    register(type: string, factory: NodeFactory): void;
    create(type: string, config?: any, id?: string): NodeInstance;
    start(id: string): void;
    stop(id: string): void;
    startAll(): void;
    stopAll(): void;
    list(): string[];
}
