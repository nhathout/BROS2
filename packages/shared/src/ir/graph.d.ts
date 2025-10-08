export type Lang = "python" | "cpp";
export interface IRTopicRef {
    topic: string;
    type: string;
}
export interface IRNode {
    id: string;
    name: string;
    package: string;
    executable: string;
    lang: Lang;
    namespace?: string;
    params?: Record<string, unknown>;
    pubs?: IRTopicRef[];
    subs?: IRTopicRef[];
}
export interface IRPackage {
    name: string;
    lang: Lang;
    nodes: IRNode[];
}
export interface IR {
    packages: IRPackage[];
}
export declare function emptyIR(): IR;
