import { describe, expect, it } from "vitest";
import { validateIR } from "./index.js";
describe("validateIR", () => {
    it("returns no issues for a simple talker/listener pair", () => {
        const ir = {
            packages: [
                {
                    name: "talker_pkg",
                    lang: "python",
                    nodes: [
                        {
                            id: "talker",
                            name: "talker",
                            package: "talker_pkg",
                            executable: "talker",
                            lang: "python",
                            namespace: "/",
                            pubs: [
                                { topic: "/chatter", type: "std_msgs/msg/String" },
                            ],
                        },
                    ],
                },
                {
                    name: "listener_pkg",
                    lang: "python",
                    nodes: [
                        {
                            id: "listener",
                            name: "listener",
                            package: "listener_pkg",
                            executable: "listener",
                            lang: "python",
                            namespace: "/",
                            subs: [
                                { topic: "/chatter", type: "std_msgs/msg/String" },
                            ],
                        },
                    ],
                },
            ],
        };
        const result = validateIR(ir);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
    });
    it("flags duplicate node names within a package namespace", () => {
        const ir = {
            packages: [
                {
                    name: "pkg_a",
                    lang: "cpp",
                    nodes: [
                        {
                            id: "node1",
                            name: "talker",
                            package: "pkg_a",
                            executable: "talker",
                            lang: "cpp",
                            namespace: "robots",
                        },
                        {
                            id: "node2",
                            name: "talker",
                            package: "pkg_a",
                            executable: "talker",
                            lang: "cpp",
                            namespace: "robots",
                        },
                    ],
                },
            ],
        };
        const result = validateIR(ir);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatchObject({ code: "duplicate-node" });
    });
    it("reports conflicting topic types across publishers and subscribers", () => {
        const ir = {
            packages: [
                {
                    name: "talker_pkg",
                    lang: "python",
                    nodes: [
                        {
                            id: "talker",
                            name: "talker",
                            package: "talker_pkg",
                            executable: "talker",
                            lang: "python",
                            pubs: [
                                { topic: "/chatter", type: "std_msgs/msg/String" },
                            ],
                        },
                    ],
                },
                {
                    name: "listener_pkg",
                    lang: "python",
                    nodes: [
                        {
                            id: "listener",
                            name: "listener",
                            package: "listener_pkg",
                            executable: "listener",
                            lang: "python",
                            subs: [
                                { topic: "/chatter", type: "std_msgs/msg/Int32" },
                            ],
                        },
                    ],
                },
            ],
        };
        const result = validateIR(ir);
        expect(result.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: "topic-type-mismatch" }),
        ]));
    });
    it("warns when topics have only publishers or only subscribers", () => {
        const ir = {
            packages: [
                {
                    name: "pkg_a",
                    lang: "python",
                    nodes: [
                        {
                            id: "talker",
                            name: "talker",
                            package: "pkg_a",
                            executable: "talker",
                            lang: "python",
                            pubs: [
                                { topic: "/chatter", type: "std_msgs/msg/String" },
                            ],
                        },
                    ],
                },
                {
                    name: "pkg_b",
                    lang: "python",
                    nodes: [
                        {
                            id: "listener",
                            name: "listener",
                            package: "pkg_b",
                            executable: "listener",
                            lang: "python",
                            subs: [
                                { topic: "/status", type: "std_msgs/msg/String" },
                            ],
                        },
                    ],
                },
            ],
        };
        const result = validateIR(ir);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(2);
        expect(result.warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: "topic-orphan" }),
        ]));
    });
});
