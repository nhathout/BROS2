import type { NodeContext } from "../registry";
import type { NodeInstance, Publish } from "@bros2/runtime";
import { RosbridgeBridge } from "./RosbridgeBridge";

type Twist = {
  linear: { x: number; y: number; z: number };
  angular: { x: number; y: number; z: number };
};

type TurtleSimSubConfig = {
  inputTopic?: string;
  cmdVelTopic?: string;
  linearSpeed?: number;
  angularSpeed?: number;
  stopAfterMs?: number;
  rosbridgeUrls?: string[];
  rosbridgeRetryMs?: number;
  autoConnect?: boolean;
};

/** Subscribes to arrow key events and publishes geometry_msgs/Twist for turtlesim. */
export class TurtleSimSub implements NodeInstance {
  id: string;
  private ctx: NodeContext;
  private inputTopic: string;
  private cmdVelTopic: string;
  private linearSpeed: number;
  private angularSpeed: number;
  private stopAfterMs: number;
  private handler?: (evt: Publish) => void;
  private stopTimer?: ReturnType<typeof setTimeout>;
  private bridge?: RosbridgeBridge;
  private ownsBridge = false;
  private bridgeUrls: string[];
  private bridgeRetryMs: number;
  private autoConnect: boolean;

  constructor(ctx: NodeContext, cfg: TurtleSimSubConfig = {}) {
    this.id = ctx.id;
    this.ctx = ctx;
    this.inputTopic = cfg.inputTopic ?? "keys/arrows";
    this.cmdVelTopic = cfg.cmdVelTopic ?? "/turtle1/cmd_vel";
    this.linearSpeed = cfg.linearSpeed ?? 1.5;
    this.angularSpeed = cfg.angularSpeed ?? 3;
    this.stopAfterMs = cfg.stopAfterMs ?? 160;
    this.bridgeUrls =
      cfg.rosbridgeUrls && cfg.rosbridgeUrls.length > 0
        ? [...cfg.rosbridgeUrls]
        : ["ws://localhost:9090", "ws://127.0.0.1:9090"];
    this.bridgeRetryMs = cfg.rosbridgeRetryMs ?? 2500;
    this.autoConnect = cfg.autoConnect ?? true;
  }

  start() {
    if (this.handler) return;
    if (!this.autoConnect) {
      this.ctx.log("turtlesim subscriber paused until ROS is running");
      return;
    }
    this.ctx.log(
      `subscribing to "${this.inputTopic}" and publishing Twist to "${this.cmdVelTopic}"`
    );
    this.ensureBridge();
    this.bridge?.subscribeRos?.("/turtle1/pose");

    this.handler = (evt: Publish) => {
      const payload = evt.data as any;
      const key =
        typeof payload?.key === "string"
          ? (payload.key as string)
          : typeof payload === "string"
          ? (payload as string)
          : null;
      const twist = this.toTwist(key);
      if (!twist) return;

      this.publishTwist(twist, key ?? "key");
      this.scheduleStop();
    };

    this.ctx.bus.on(this.inputTopic, this.handler);
  }

  stop() {
    if (this.handler) {
      this.ctx.bus.off(this.inputTopic, this.handler);
      this.handler = undefined;
    }
    this.cancelStopTimer();
    const hasBridge = Boolean(this.bridge || (globalThis as any).__rosbridge__);
    if (hasBridge) {
      this.publishTwist(this.zeroTwist(), "stop");
    }

    if (this.ownsBridge && this.bridge) {
      this.bridge.stop();
      this.bridge = undefined;
      this.ownsBridge = false;
    }

    this.ctx.log(`stopped turtlesim subscriber on "${this.inputTopic}"`);
  }

  private ensureBridge(): RosbridgeBridge | null {
    if (!this.autoConnect) return null;
    if (this.bridge) return this.bridge;

    const existing = (globalThis as any).__rosbridge__;
    if (existing?.publishRos) {
      this.bridge = existing;
      this.ownsBridge = false;
      if (typeof existing.start === "function") existing.start();
      return existing;
    }

    const id = `${this.id}_rosbridge`;
    const bridgeCtx: NodeContext = {
      id,
      bus: this.ctx.bus,
      publish: (topic, data) => {
        const evt: Publish = { topic, data, from: id, ts: Date.now() };
        this.ctx.bus.emit(topic, evt);
        console.log(`[publish] ${topic} <-`, data);
      },
      log: (msg) => this.ctx.log(msg),
    };
    const bridge = new RosbridgeBridge(bridgeCtx, {
      urls: this.bridgeUrls,
      retryMs: this.bridgeRetryMs,
    });
    bridge.start();
    this.bridge = bridge;
    this.ownsBridge = true;
    return bridge;
  }

  private publishTwist(twist: Twist, label: string) {
    const bridge = this.ensureBridge();
    if (!bridge || typeof bridge.publishRos !== "function") {
      this.ctx.log("no rosbridge connection; dropped turtlesim cmd_vel");
      return;
    }
    bridge.publishRos(this.cmdVelTopic, twist);
    this.ctx.log(`sent "${label}" -> ${this.cmdVelTopic}`);
  }

  private scheduleStop() {
    if (this.stopAfterMs <= 0) return;
    this.cancelStopTimer();
    this.stopTimer = setTimeout(() => {
      this.stopTimer = undefined;
      this.publishTwist(this.zeroTwist(), "stop");
    }, this.stopAfterMs);
  }

  private cancelStopTimer() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = undefined;
    }
  }

  private toTwist(dir: string | null): Twist | null {
    if (!dir) return null;
    const base = this.zeroTwist();
    switch (dir) {
      case "up":
        return { ...base, linear: { ...base.linear, x: this.linearSpeed } };
      case "down":
        return { ...base, linear: { ...base.linear, x: -this.linearSpeed } };
      case "left":
        return { ...base, angular: { ...base.angular, z: this.angularSpeed } };
      case "right":
        return { ...base, angular: { ...base.angular, z: -this.angularSpeed } };
      default:
        return null;
    }
  }

  private zeroTwist(): Twist {
    return {
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
    };
  }
}
