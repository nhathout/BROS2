import { Runtime, type NodeFactory } from "@bros2/runtime";
import { ArrowKeyPub } from "../../renderer/runtime/nodes/ArrowKeyPub";
import { ConsoleSub } from "../../renderer/runtime/nodes/ConsoleSub";

export const registry: Record<string, NodeFactory> = {
  ArrowKeyPub: (ctx, config) => new ArrowKeyPub(ctx, config),
  ConsoleSub: (ctx, config) => new ConsoleSub(ctx, config),
};

export const runtime = new Runtime(registry);
