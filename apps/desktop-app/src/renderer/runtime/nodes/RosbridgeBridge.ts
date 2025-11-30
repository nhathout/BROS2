import type { NodeContext, NodeInstance } from "../registry";

type BridgeConfig = {
  url?: string;
  urls?: string[];
  retryMs?: number;
};

export class RosbridgeBridge implements NodeInstance {
  id: string;
  private ctx: NodeContext;
  private urls: string[];
  private retryMs: number;
  private ws?: WebSocket;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private currentIndex = 0;
  private stopped = false;

  constructor(ctx: NodeContext, cfg: BridgeConfig = {}) {
    this.id = ctx.id;
    this.ctx = ctx;
    this.urls =
      cfg.urls && cfg.urls.length > 0
        ? [...cfg.urls]
        : cfg.url
        ? [cfg.url]
        : ["ws://localhost:9090", "ws://127.0.0.1:9090"];
    this.retryMs = cfg.retryMs ?? 2500;
    (globalThis as any).__rosbridge__ = this;
  }

  start() {
    this.stopped = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.connectNext();
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
    this.stopped = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
    this.ws?.close();
    this.ws = undefined;
    if ((globalThis as any).__rosbridge__ === this) {
      delete (globalThis as any).__rosbridge__;
    }
  }

  private connectNext() {
    if (this.stopped) return;
    const url = this.urls[this.currentIndex % this.urls.length];
    this.currentIndex += 1;
    try {
      this.ctx.log(`connecting to rosbridge at ${url}`);
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.ctx.log(`rosbridge connected: ${url}`);
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = undefined;
        }
      };
      ws.onclose = () => {
        this.ctx.log(`rosbridge closed: ${url}`);
        this.scheduleRetry();
      };
      ws.onerror = () => {
        this.ctx.log(`rosbridge error: ${url}`);
        this.scheduleRetry();
      };
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(m.data as string);
          if (msg.op === "publish" && msg.topic && msg.msg) {
            this.ctx.publish(msg.topic, msg.msg);
          }
        } catch (err) {
          console.warn("[rosbridge] failed to parse message", err);
        }
      };
    } catch (err) {
      this.ctx.log(`rosbridge failed to connect: ${String(err)}`);
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.connectNext();
    }, this.retryMs);
  }
}
