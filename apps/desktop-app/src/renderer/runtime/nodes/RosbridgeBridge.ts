import type { NodeContext, NodeInstance } from "@bros2/runtime";

export class RosbridgeBridge implements NodeInstance {
  id: string;
  private ctx: NodeContext;
  private url: string;
  private ws?: WebSocket;

  constructor(ctx: NodeContext, cfg: { url?: string } = {}) {
    this.id = ctx.id;
    this.ctx = ctx;
    this.url = cfg.url ?? "ws://localhost:9090";
    (globalThis as any).__rosbridge__ = this;
  }

  start() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => this.ctx.log(`rosbridge connected: ${this.url}`);
    this.ws.onclose = () => this.ctx.log("rosbridge closed");
    this.ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(m.data as string);
        if (msg.op === "publish" && msg.topic && msg.msg) {
          this.ctx.publish(msg.topic, msg.msg);
        }
      } catch {}
    };
  }

  publishRos(topic: string, msg: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: "publish", topic, msg }));
    }
  }

  subscribeRos(topic: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: "subscribe", topic }));
    }
  }

  stop() {
    this.ws?.close();
    this.ws = undefined;
    if ((globalThis as any).__rosbridge__ === this) {
      delete (globalThis as any).__rosbridge__;
    }
  }
}
