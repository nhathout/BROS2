import type { NodeContext, NodeInstance } from "@bros2/runtime";

type KeyDir = "up" | "down" | "left" | "right";

/** Publishes { key: "up"|"down"|"left"|"right", ts } on every arrow key press. */
export class ArrowKeyPub implements NodeInstance {
  id: string;
  private ctx: NodeContext;
  private topic: string;
  private handler?: (e: KeyboardEvent) => void;

  constructor(ctx: NodeContext, config?: { topic?: string }) {
    this.id = ctx.id;
    this.ctx = ctx;
    this.topic = config?.topic ?? "keys/arrows";
  }

  start() {
    if (this.handler) return;

    this.ctx.log(`listening for arrow keys on topic "${this.topic}"`);
    this.handler = (e: KeyboardEvent) => {
      const map: Record<string, KeyDir> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const dir = map[e.key];
      if (!dir) return;

      const payload = { key: dir, ts: Date.now() };
      this.ctx.publish(this.topic, payload);
      this.ctx.log(`pressed: ${dir}`);
    };

    window.addEventListener("keydown", this.handler);
  }

  stop() {
    if (!this.handler) return;
    window.removeEventListener("keydown", this.handler);
    this.ctx.log(`stopped listening on "${this.topic}"`);
    this.handler = undefined;
  }
}