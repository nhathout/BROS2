// this is where ill add more templates like 
// TurtlesimController, ConsoleSubscriber

import { Runtime } from "@bros2/runtime";
import type { NodeContext, NodeInstance } from "@bros2/runtime";
import { ArrowKeyPub } from "./nodes/ArrowKeyPub";
import { ConsoleSub } from "./nodes/ConsoleSub";
import { Forwarder } from "./nodes/Forwarder";
import { RosbridgeBridge } from "./nodes/RosbridgeBridge";

type Factory = (ctx: NodeContext, config?: any) => NodeInstance;

const baseRegistry: Record<string, Factory> = {
  ArrowKeyPub: (ctx, config) => new ArrowKeyPub(ctx, config),
  ConsoleSub: (ctx, config) => new ConsoleSub(ctx, config)
};

export const registry: Record<string, Factory> = {
  ...baseRegistry,
  RosbridgeBridge: (ctx, config) => new RosbridgeBridge(ctx, config),
  Forwarder: (ctx, config) => new Forwarder(ctx, config)
};

export const runtime = new Runtime(registry);
