import { describe, expect, it } from "vitest";
import { buildIR, graphToFragments } from "./index.js";
import type { BlockGraph } from "../types/blocks.js";

const talkerListenerGraph: BlockGraph = {
  blocks: [
    {
      kind: "node",
      id: "talker",
      name: "Talker",
      pkg: "demo_nodes_cpp",
      executable: "talker",
      lang: "cpp"
    },
    {
      kind: "node",
      id: "listener",
      name: "Listener",
      pkg: "demo_nodes_cpp",
      executable: "listener",
      lang: "cpp"
    },
    {
      kind: "publish",
      nodeId: "talker",
      topic: "/chatter",
      type: "std_msgs/msg/String"
    },
    {
      kind: "subscribe",
      nodeId: "listener",
      topic: "/chatter",
      type: "std_msgs/msg/String"
    }
  ]
};

describe("generators", () => {
  it("converts block graphs to fragments", () => {
    const fragments = graphToFragments(talkerListenerGraph);
    expect(fragments).toHaveLength(4);
  });

  it("builds an IR with zero issues for talker/listener graph", () => {
    const { ir, issues } = buildIR(talkerListenerGraph);
    expect(issues).toHaveLength(0);
    expect(ir.packages).toHaveLength(1);
    const pkg = ir.packages[0];
    expect(pkg.name).toBe("demo_nodes_cpp");
    expect(pkg.nodes).toHaveLength(2);
    expect(pkg.nodes.map((node) => node.name).sort()).toEqual(["Listener", "Talker"]);
  });
});
