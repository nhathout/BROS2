import { describe, it, expect } from "vitest";
import { Runtime, type NodeContext, type NodeInstance } from "./index";

class DummyNode implements NodeInstance {
  id: string;
  started = false;

  constructor(ctx: NodeContext) {
    this.id = ctx.id;
  }

  start() {
    this.started = true;
  }

  stop() {
    this.started = false;
  }
}

class PublishOnceNode implements NodeInstance {
  id: string;
  private ctx: NodeContext;
  private topic: string;
  private payload: unknown;

  constructor(ctx: NodeContext, config: { topic: string; payload: unknown }) {
    this.id = ctx.id;
    this.ctx = ctx;
    this.topic = config.topic;
    this.payload = config.payload;
  }

  start() {
    this.ctx.publish(this.topic, this.payload);
  }

  stop() {
    // no-op
  }
}

describe("Runtime", () => {
  it("creates nodes and manages lifecycle", () => {
    const runtime = new Runtime({
      Dummy: (ctx) => new DummyNode(ctx),
    });

    const instance = runtime.create("Dummy");
    expect(instance).toBeInstanceOf(DummyNode);

    const node = instance as DummyNode;
    expect(node.started).toBe(false);

    runtime.start(node.id);
    expect(node.started).toBe(true);

    runtime.stop(node.id);
    expect(node.started).toBe(false);
  });

  it("emits published messages onto the shared bus", () => {
    const runtime = new Runtime({
      Pub: (ctx, config) => new PublishOnceNode(ctx, config),
    });

    const payload = { foo: "bar" };
    let received: unknown;
    runtime.bus.once("my/topic", (evt) => {
      received = evt.data;
    });

    const instance = runtime.create("Pub", { topic: "my/topic", payload });
    runtime.start(instance.id);

    expect(received).toEqual(payload);
  });
});
