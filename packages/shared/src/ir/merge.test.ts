import { describe, expect, it } from "vitest";
import { mergeIRFragments } from "./merge.js";

describe("mergeIRFragments", () => {
  it("merges fragments for the same node id", () => {
    const fragments = [
      {
        packages: [
          {
            name: "example_pkg",
            lang: "python",
            nodes: [
              {
                id: "node-1",
                name: "Example Node",
                package: "example_pkg",
                executable: "node_exec",
                lang: "python",
                pubs: [
                  { topic: "/chatter", type: "std_msgs/msg/String" }
                ]
              }
            ]
          }
        ]
      },
      {
        packages: [
          {
            name: "example_pkg",
            lang: "python",
            nodes: [
              {
                id: "node-1",
                name: "Example Node Updated",
                package: "example_pkg",
                executable: "node_exec",
                lang: "python",
                subs: [
                  { topic: "/chatter", type: "std_msgs/msg/String" }
                ]
              }
            ]
          }
        ]
      }
    ];

    const merged = mergeIRFragments(fragments);

    expect(merged.packages).toHaveLength(1);
    const pkg = merged.packages[0];
    expect(pkg.nodes).toHaveLength(1);
    const node = pkg.nodes[0];
    expect(node.id).toBe("node-1");
    expect(node.pubs).toEqual([
      { topic: "/chatter", type: "std_msgs/msg/String" }
    ]);
    expect(node.subs).toEqual([
      { topic: "/chatter", type: "std_msgs/msg/String" }
    ]);
  });

  it("deduplicates duplicate pubs and subs", () => {
    const fragments = [
      {
        packages: [
          {
            name: "dedupe_pkg",
            lang: "cpp",
            nodes: [
              {
                id: "n1",
                name: "Node",
                package: "dedupe_pkg",
                executable: "run",
                lang: "cpp",
                pubs: [
                  { topic: "/foo", type: "std_msgs/msg/String" },
                  { topic: "/foo", type: "std_msgs/msg/String" }
                ],
                subs: [
                  { topic: "/bar", type: "geometry_msgs/msg/Twist" },
                  { topic: "/bar", type: "geometry_msgs/msg/Twist" }
                ]
              }
            ]
          }
        ]
      }
    ];

    const merged = mergeIRFragments(fragments);
    const node = merged.packages[0].nodes[0];

    expect(node.pubs).toEqual([
      { topic: "/foo", type: "std_msgs/msg/String" }
    ]);
    expect(node.subs).toEqual([
      { topic: "/bar", type: "geometry_msgs/msg/Twist" }
    ]);
  });

  it("orders packages and nodes deterministically", () => {
    const fragments = [
      {
        packages: [
          {
            name: "pkg_b",
            lang: "python",
            nodes: [
              {
                id: "2",
                name: "Beta",
                package: "pkg_b",
                executable: "beta",
                lang: "python"
              }
            ]
          },
          {
            name: "pkg_a",
            lang: "cpp",
            nodes: [
              {
                id: "1",
                name: "Alpha",
                package: "pkg_a",
                executable: "alpha",
                lang: "cpp"
              },
              {
                id: "3",
                name: "Gamma",
                package: "pkg_a",
                executable: "gamma",
                lang: "cpp"
              }
            ]
          }
        ]
      }
    ];

    const merged = mergeIRFragments(fragments);
    const packageNames = merged.packages.map((p) => p.name);
    expect(packageNames).toEqual(["pkg_a", "pkg_b"]);

    const nodeNames = merged.packages[0].nodes.map((n) => n.name);
    expect(nodeNames).toEqual(["Alpha", "Gamma"]);
  });
});
