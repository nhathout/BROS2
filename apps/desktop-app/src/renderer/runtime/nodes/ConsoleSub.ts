import type { NodeContext, NodeInstance, Publish } from "@bros2/runtime";

type ConsoleSubConfig = {
  topic?: string;
  format?: (payload: Publish["data"]) => string;
};

/** Subscribes to a topic and logs inbound messages via ctx.log. */
export class ConsoleSub implements NodeInstance {
  id: string;
  private ctx: NodeContext;
  private topic: string;
  private handler?: (evt: Publish) => void;
  private format: (payload: Publish["data"]) => string;

  constructor(ctx: NodeContext, config: ConsoleSubConfig = {}) {
    this.id = ctx.id;
    this.ctx = ctx;
    this.topic = config.topic ?? "keys/arrows";
    this.format =
      config.format ??
      ((payload) => (typeof payload === "string" ? payload : JSON.stringify(payload)));
  }

  start() {
    if (this.handler) return;

    this.ctx.log(`subscribing to "${this.topic}"`);
    this.handler = (evt: Publish) => {
      const message = this.format(evt.data);
      this.ctx.log(`received from ${evt.from}: ${message}`);
    };
    this.ctx.bus.on(this.topic, this.handler);
  }

  stop() {
    if (!this.handler) return;
    this.ctx.bus.off(this.topic, this.handler);
    this.handler = undefined;
    this.ctx.log(`stopped subscribing to "${this.topic}"`);
  }
}
