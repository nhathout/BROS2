// this is where ill add more templates like 
// TurtlesimController, ConsoleSubscriber

import { Runtime } from "@bros2/runtime";
import type { NodeContext, NodeInstance } from "@bros2/runtime";
import { ArrowKeyPub } from "./nodes/ArrowKeyPub";

type Factory = (ctx: NodeContext, config?: any) => NodeInstance;

export const registry: Record<string, Factory> = {
  ArrowKeyPub: (ctx, config) => new ArrowKeyPub(ctx, config),
};

export const runtime = new Runtime(registry);