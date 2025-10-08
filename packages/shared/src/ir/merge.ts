import { emptyIR, type IR, type IRNode, type IRPackage, type IRTopicRef } from "./graph.js";

interface NodeAccumulator {
  id: string;
  name: string;
  package: string;
  executable: string;
  lang: IRNode["lang"];
  namespace?: string;
  params?: Record<string, unknown>;
  pubs: IRTopicRef[];
  subs: IRTopicRef[];
}

interface PackageAccumulator {
  name: string;
  lang: IRPackage["lang"];
  nodes: Map<string, NodeAccumulator>;
}

const NAME_PATTERN = /[^A-Za-z0-9_]/g;

function sanitizeName(value: string | undefined | null, fallback: string): string {
  const sanitized = (value ?? "")
    .replace(NAME_PATTERN, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
  return sanitized.length > 0 ? sanitized : fallback;
}

function mergeTopicRefs(target: IRTopicRef[], incoming?: IRTopicRef[]): IRTopicRef[] {
  if (!incoming?.length) {
    return target;
  }

  const seen = new Map<string, IRTopicRef>();
  for (const ref of [...target, ...incoming]) {
    if (!ref || typeof ref.topic !== "string" || typeof ref.type !== "string") continue;
    const key = `${ref.topic}|${ref.type}`;
    if (!seen.has(key)) {
      seen.set(key, { topic: ref.topic, type: ref.type });
    }
  }
  return Array.from(seen.values());
}

function mergeParams(existing: Record<string, unknown> | undefined, incoming?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!existing && !incoming) return undefined;
  return { ...(existing ?? {}), ...(incoming ?? {}) };
}

export function mergeIRFragments(fragments: any[]): IR {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    return emptyIR();
  }

  const packageMap = new Map<string, PackageAccumulator>();

  for (const fragment of fragments) {
    if (!fragment || typeof fragment !== "object") continue;
    const packages: IRPackage[] | undefined = fragment.packages;
    if (!Array.isArray(packages)) continue;

    for (const pkg of packages) {
      if (!pkg || typeof pkg.name !== "string") continue;
      const sanitizedPackageName = sanitizeName(pkg.name, "package");
      const pkgLang = pkg.lang;
      let accumulator = packageMap.get(sanitizedPackageName);
      if (!accumulator) {
        accumulator = {
          name: sanitizedPackageName,
          lang: pkgLang,
          nodes: new Map<string, NodeAccumulator>()
        };
        packageMap.set(sanitizedPackageName, accumulator);
      } else if (pkgLang && accumulator.lang !== pkgLang) {
        accumulator.lang = pkgLang;
      }

      const nodes = Array.isArray(pkg.nodes) ? pkg.nodes : [];
      for (const node of nodes) {
        if (!node || typeof node.id !== "string") continue;
        const nodeId = node.id;
        const sanitizedNodeName = sanitizeName(node.name, nodeId);
        const sanitizedExecutable = sanitizeName(node.executable, "executable");
        const sanitizedNamespace = node.namespace ? sanitizeName(node.namespace, "ns") : undefined;

        let nodeAccumulator = accumulator.nodes.get(nodeId);
        if (!nodeAccumulator) {
          nodeAccumulator = {
            id: nodeId,
            name: sanitizedNodeName,
            package: sanitizedPackageName,
            executable: sanitizedExecutable,
            lang: node.lang,
            namespace: sanitizedNamespace,
            params: node.params ? { ...node.params } : undefined,
            pubs: [],
            subs: []
          };
          accumulator.nodes.set(nodeId, nodeAccumulator);
        } else {
          nodeAccumulator.name = sanitizedNodeName;
          nodeAccumulator.executable = sanitizedExecutable;
          nodeAccumulator.namespace = sanitizedNamespace ?? nodeAccumulator.namespace;
          if (node.lang) {
            nodeAccumulator.lang = node.lang;
          }
          nodeAccumulator.params = mergeParams(nodeAccumulator.params, node.params);
        }

        nodeAccumulator.pubs = mergeTopicRefs(nodeAccumulator.pubs, node.pubs);
        nodeAccumulator.subs = mergeTopicRefs(nodeAccumulator.subs, node.subs);
      }
    }
  }

  const mergedPackages: IRPackage[] = Array.from(packageMap.values())
    .map((pkg) => {
      const nodes: IRNode[] = Array.from(pkg.nodes.values())
        .map((node) => ({
          id: node.id,
          name: node.name,
          package: pkg.name,
          executable: node.executable,
          lang: node.lang,
          namespace: node.namespace,
          params: node.params,
          pubs: node.pubs.length ? node.pubs : undefined,
          subs: node.subs.length ? node.subs : undefined
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        name: pkg.name,
        lang: pkg.lang,
        nodes
      } satisfies IRPackage;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { packages: mergedPackages };
}
