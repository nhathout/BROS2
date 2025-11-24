import type { NodeContext, NodeInstance } from "@bros2/runtime";

export class Forwarder implements NodeInstance {
  id: string;
  private ctx: NodeContext;
  private from: string;
  private to: string;
  private send: (topic: string, msg: any) => void;
  private handler?: (evt: any) => void;

  constructor(
    ctx: NodeContext,
    cfg: { from: string; to: string; send: (topic: string, msg: any) => void }
  ) {
    this.id = ctx.id;
    this.ctx = ctx;
    this.from = cfg.from;
    this.to = cfg.to;
    this.send = cfg.send;
  }

  start() {
    this.handler = (evt: any) => this.send(this.to, evt.data ?? evt);
    this.ctx.bus.on(this.from, this.handler);
    this.ctx.log(`forwarding "${this.from}" -> ROS "${this.to}"`);
  }

  stop() {
    if (this.handler) this.ctx.bus.off(this.from, this.handler);
    this.handler = undefined;
  }
}
