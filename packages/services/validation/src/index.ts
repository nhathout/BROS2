import type { IR, IRNode, IRPackage, IRTopicRef } from "@bros/shared";

export type IssueLevel = "error" | "warning";

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  at?: string;
}

export interface ValidationResult {
  errors: Issue[];
  warnings: Issue[];
}

interface TopicLocation {
  package: string;
  node: string;
  namespace?: string;
}

interface TopicUsage {
  type?: string;
  publishers: TopicLocation[];
  subscribers: TopicLocation[];
}

export function validateIR(ir: IR): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  const topicUsages = new Map<string, TopicUsage>();

  for (const pkg of ir.packages ?? []) {
    validatePackage(pkg, topicUsages, errors);
  }

  for (const [topic, usage] of topicUsages.entries()) {
    const hasPublishers = usage.publishers.length > 0;
    const hasSubscribers = usage.subscribers.length > 0;

    if (hasPublishers && hasSubscribers) {
      continue;
    }

    const side = hasPublishers ? "subscribers" : "publishers";
    const source = hasPublishers ? usage.publishers[0] : usage.subscribers[0];
    warnings.push({
      level: "warning",
      code: "topic-orphan",
      message: `Topic "${topic}" has ${hasPublishers ? "publishers" : "subscribers"} but no ${side}.`,
      at: formatLocation(source),
    });
  }

  return { errors, warnings };
}

function validatePackage(pkg: IRPackage, topicUsages: Map<string, TopicUsage>, errors: Issue[]): void {
  const seenNames = new Map<string, IRNode>();

  for (const node of pkg.nodes ?? []) {
    const ns = node.namespace ?? "";
    const key = `${pkg.name}::${ns}::${node.name}`;

    if (seenNames.has(key)) {
      const prev = seenNames.get(key)!;
      errors.push({
        level: "error",
        code: "duplicate-node",
        message: `Duplicate node name "${node.name}" in package "${pkg.name}" and namespace "${ns || "/"}" (conflicts with ${formatLocation({ package: pkg.name, node: prev.name, namespace: prev.namespace })}).`,
        at: formatLocation({ package: pkg.name, node: node.name, namespace: ns }),
      });
      continue;
    }

    seenNames.set(key, node);

    collectTopicUsage(pkg.name, node, node.pubs ?? [], "publishers", topicUsages, errors);
    collectTopicUsage(pkg.name, node, node.subs ?? [], "subscribers", topicUsages, errors);
  }
}

type Role = "publishers" | "subscribers";

function collectTopicUsage(
  packageName: string,
  node: IRNode,
  refs: IRTopicRef[],
  role: Role,
  topicUsages: Map<string, TopicUsage>,
  errors: Issue[],
): void {
  for (const ref of refs) {
    if (!ref.type || ref.type.trim().length === 0) {
      errors.push({
        level: "error",
        code: "missing-topic-type",
        message: `Topic "${ref.topic}" is missing a type on ${role.slice(0, -1)} "${node.name}" in package "${packageName}".`,
        at: formatLocation({ package: packageName, node: node.name, namespace: node.namespace }),
      });
      continue;
    }

    const usage = getOrCreateUsage(topicUsages, ref.topic);
    const location: TopicLocation = {
      package: packageName,
      node: node.name,
      namespace: node.namespace,
    };

    if (usage.type && usage.type !== ref.type) {
      errors.push({
        level: "error",
        code: "topic-type-mismatch",
        message: `Topic "${ref.topic}" has conflicting types "${usage.type}" and "${ref.type}".`,
        at: formatLocation(location),
      });
    } else if (!usage.type) {
      usage.type = ref.type;
    }

    usage[role].push(location);
  }
}

function getOrCreateUsage(map: Map<string, TopicUsage>, topic: string): TopicUsage {
  let usage = map.get(topic);
  if (!usage) {
    usage = { publishers: [], subscribers: [] };
    map.set(topic, usage);
  }
  return usage;
}

function formatLocation(location?: TopicLocation): string | undefined {
  if (!location) {
    return undefined;
  }

  const ns = normalizeNamespace(location.namespace);
  return ns ? `${location.package}${ns}/${location.node}` : `${location.package}/${location.node}`;
}

function normalizeNamespace(ns?: string): string | undefined {
  if (!ns || ns === "/" || ns.trim().length === 0) {
    return undefined;
  }

  return ns.startsWith("/") ? ns : `/${ns}`;
}
