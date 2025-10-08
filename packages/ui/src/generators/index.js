import { IRSchema, mergeIRFragments } from "@bros/shared";
function getNodeScaffold(node) {
    const lang = node.lang ?? "python";
    const packageName = node.pkg ?? node.name ?? node.id;
    const executable = node.executable ?? node.name ?? node.id;
    return {
        id: node.id,
        name: node.name,
        packageName,
        executable,
        lang,
        namespace: node.namespace,
        params: node.params
    };
}
function nodeBlockToFragment(node) {
    const scaffold = getNodeScaffold(node);
    return {
        packages: [
            {
                name: scaffold.packageName,
                lang: scaffold.lang,
                nodes: [
                    {
                        id: scaffold.id,
                        name: scaffold.name,
                        package: scaffold.packageName,
                        executable: scaffold.executable,
                        lang: scaffold.lang,
                        namespace: scaffold.namespace,
                        params: scaffold.params
                    }
                ]
            }
        ]
    };
}
function publishBlockToFragment(block, node) {
    const scaffold = getNodeScaffold(node);
    return {
        packages: [
            {
                name: scaffold.packageName,
                lang: scaffold.lang,
                nodes: [
                    {
                        id: scaffold.id,
                        name: scaffold.name,
                        package: scaffold.packageName,
                        executable: scaffold.executable,
                        lang: scaffold.lang,
                        namespace: scaffold.namespace,
                        params: scaffold.params,
                        pubs: [
                            {
                                topic: block.topic,
                                type: block.type
                            }
                        ]
                    }
                ]
            }
        ]
    };
}
function subscribeBlockToFragment(block, node) {
    const scaffold = getNodeScaffold(node);
    return {
        packages: [
            {
                name: scaffold.packageName,
                lang: scaffold.lang,
                nodes: [
                    {
                        id: scaffold.id,
                        name: scaffold.name,
                        package: scaffold.packageName,
                        executable: scaffold.executable,
                        lang: scaffold.lang,
                        namespace: scaffold.namespace,
                        params: scaffold.params,
                        subs: [
                            {
                                topic: block.topic,
                                type: block.type
                            }
                        ]
                    }
                ]
            }
        ]
    };
}
function computeFragments(graph) {
    const fragments = [];
    const issues = [];
    const nodeBlocks = new Map();
    for (const block of graph.blocks) {
        if (block.kind === "node") {
            nodeBlocks.set(block.id, block);
        }
    }
    for (const block of graph.blocks) {
        switch (block.kind) {
            case "node":
                fragments.push(nodeBlockToFragment(block));
                break;
            case "publish": {
                const node = nodeBlocks.get(block.nodeId);
                if (!node) {
                    issues.push(`publish block references unknown node '${block.nodeId}'`);
                    break;
                }
                fragments.push(publishBlockToFragment(block, node));
                break;
            }
            case "subscribe": {
                const node = nodeBlocks.get(block.nodeId);
                if (!node) {
                    issues.push(`subscribe block references unknown node '${block.nodeId}'`);
                    break;
                }
                fragments.push(subscribeBlockToFragment(block, node));
                break;
            }
            default:
                issues.push(`unsupported block kind '${block.kind}'`);
                break;
        }
    }
    return { fragments, issues };
}
export function graphToFragments(graph) {
    return computeFragments(graph).fragments;
}
export function buildIR(graph) {
    const { fragments, issues } = computeFragments(graph);
    const merged = mergeIRFragments(fragments);
    const validation = IRSchema.safeParse(merged);
    if (!validation.success) {
        for (const error of validation.error.errors) {
            const path = error.path.join(".") || "value";
            issues.push(`schema violation at ${path}: ${error.message}`);
        }
        return { ir: merged, issues: Array.from(new Set(issues)) };
    }
    return { ir: validation.data, issues: Array.from(new Set(issues)) };
}
export { nodeBlockToFragment, publishBlockToFragment, subscribeBlockToFragment };
