export interface BlockNode {
  kind: "node";
  id: string;
  name: string;
  lang?: "python" | "cpp";
  namespace?: string;
  pkg?: string;
  executable?: string;
  params?: Record<string, unknown>;
}

export interface BlockPublish {
  kind: "publish";
  nodeId: string;
  topic: string;
  type: string;
}

export interface BlockSubscribe {
  kind: "subscribe";
  nodeId: string;
  topic: string;
  type: string;
}

export type BlockAny = BlockNode | BlockPublish | BlockSubscribe;

export interface BlockGraph {
  blocks: BlockAny[];
}
