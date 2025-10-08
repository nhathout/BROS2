import { IRSchema, mergeIRFragments } from "@bros/shared";
import type { IR } from "@bros/shared";
import type { BlockGraph, BlockNode, BlockPublish, BlockSubscribe } from "../types/blocks.js";

interface NodeScaffold {
  id: string;
  name: string;
  packageName: string;
  executable: string;
  lang: "python" | "cpp";
  namespace?: string;
  params?: Record<string, unknown>;
}

interface FragmentComputation {
  fragments: IR[];
  issues: string[];
}

function getNodeScaffold(node: BlockNode): NodeScaffold {
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

function nodeBlockToFragment(node: BlockNode): IR {
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

function publishBlockToFragment(block: BlockPublish, node: BlockNode): IR {
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

function subscribeBlockToFragment(block: BlockSubscribe, node: BlockNode): IR {
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

function computeFragments(graph: BlockGraph): FragmentComputation {
  const fragments: IR[] = [];
  const issues: string[] = [];

  const nodeBlocks = new Map<string, BlockNode>();
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
        issues.push(`unsupported block kind '${(block as { kind?: string }).kind}'`);
        break;
    }
  }

  return { fragments, issues };
}

export function graphToFragments(graph: BlockGraph): IR[] {
  return computeFragments(graph).fragments;
}

export function buildIR(graph: BlockGraph): { ir: IR; issues: string[] } {
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

export {
  nodeBlockToFragment,
  publishBlockToFragment,
  subscribeBlockToFragment
};
