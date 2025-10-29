import { Runtime, type NodeFactory } from "@bros2/runtime";
import { ArrowKeyPub } from "../../renderer/runtime/nodes/ArrowKeyPub";

export const registry: Record<string, NodeFactory> = {
  ArrowKeyPub: (ctx, config) => new ArrowKeyPub(ctx, config)
};

export const runtime = new Runtime(registry);
