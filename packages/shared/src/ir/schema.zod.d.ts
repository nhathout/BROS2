import { z } from "zod";
export declare const LangSchema: z.ZodEnum<["python", "cpp"]>;
export declare const TopicRefSchema: z.ZodObject<{
    topic: z.ZodString;
    type: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    topic: string;
}, {
    type: string;
    topic: string;
}>;
export declare const NodeSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    package: z.ZodString;
    executable: z.ZodString;
    lang: z.ZodEnum<["python", "cpp"]>;
    namespace: z.ZodOptional<z.ZodString>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    pubs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        topic: z.ZodString;
        type: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        topic: string;
    }, {
        type: string;
        topic: string;
    }>, "many">>;
    subs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        topic: z.ZodString;
        type: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        topic: string;
    }, {
        type: string;
        topic: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    lang: "python" | "cpp";
    package: string;
    name: string;
    executable: string;
    id: string;
    namespace?: string | undefined;
    params?: Record<string, unknown> | undefined;
    pubs?: {
        type: string;
        topic: string;
    }[] | undefined;
    subs?: {
        type: string;
        topic: string;
    }[] | undefined;
}, {
    lang: "python" | "cpp";
    package: string;
    name: string;
    executable: string;
    id: string;
    namespace?: string | undefined;
    params?: Record<string, unknown> | undefined;
    pubs?: {
        type: string;
        topic: string;
    }[] | undefined;
    subs?: {
        type: string;
        topic: string;
    }[] | undefined;
}>;
export declare const PackageSchema: z.ZodObject<{
    name: z.ZodString;
    lang: z.ZodEnum<["python", "cpp"]>;
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        package: z.ZodString;
        executable: z.ZodString;
        lang: z.ZodEnum<["python", "cpp"]>;
        namespace: z.ZodOptional<z.ZodString>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        pubs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            topic: z.ZodString;
            type: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            topic: string;
        }, {
            type: string;
            topic: string;
        }>, "many">>;
        subs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            topic: z.ZodString;
            type: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            topic: string;
        }, {
            type: string;
            topic: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        lang: "python" | "cpp";
        package: string;
        name: string;
        executable: string;
        id: string;
        namespace?: string | undefined;
        params?: Record<string, unknown> | undefined;
        pubs?: {
            type: string;
            topic: string;
        }[] | undefined;
        subs?: {
            type: string;
            topic: string;
        }[] | undefined;
    }, {
        lang: "python" | "cpp";
        package: string;
        name: string;
        executable: string;
        id: string;
        namespace?: string | undefined;
        params?: Record<string, unknown> | undefined;
        pubs?: {
            type: string;
            topic: string;
        }[] | undefined;
        subs?: {
            type: string;
            topic: string;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    lang: "python" | "cpp";
    name: string;
    nodes: {
        lang: "python" | "cpp";
        package: string;
        name: string;
        executable: string;
        id: string;
        namespace?: string | undefined;
        params?: Record<string, unknown> | undefined;
        pubs?: {
            type: string;
            topic: string;
        }[] | undefined;
        subs?: {
            type: string;
            topic: string;
        }[] | undefined;
    }[];
}, {
    lang: "python" | "cpp";
    name: string;
    nodes: {
        lang: "python" | "cpp";
        package: string;
        name: string;
        executable: string;
        id: string;
        namespace?: string | undefined;
        params?: Record<string, unknown> | undefined;
        pubs?: {
            type: string;
            topic: string;
        }[] | undefined;
        subs?: {
            type: string;
            topic: string;
        }[] | undefined;
    }[];
}>;
export declare const IRSchema: z.ZodObject<{
    packages: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        lang: z.ZodEnum<["python", "cpp"]>;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            package: z.ZodString;
            executable: z.ZodString;
            lang: z.ZodEnum<["python", "cpp"]>;
            namespace: z.ZodOptional<z.ZodString>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            pubs: z.ZodOptional<z.ZodArray<z.ZodObject<{
                topic: z.ZodString;
                type: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: string;
                topic: string;
            }, {
                type: string;
                topic: string;
            }>, "many">>;
            subs: z.ZodOptional<z.ZodArray<z.ZodObject<{
                topic: z.ZodString;
                type: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: string;
                topic: string;
            }, {
                type: string;
                topic: string;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            lang: "python" | "cpp";
            package: string;
            name: string;
            executable: string;
            id: string;
            namespace?: string | undefined;
            params?: Record<string, unknown> | undefined;
            pubs?: {
                type: string;
                topic: string;
            }[] | undefined;
            subs?: {
                type: string;
                topic: string;
            }[] | undefined;
        }, {
            lang: "python" | "cpp";
            package: string;
            name: string;
            executable: string;
            id: string;
            namespace?: string | undefined;
            params?: Record<string, unknown> | undefined;
            pubs?: {
                type: string;
                topic: string;
            }[] | undefined;
            subs?: {
                type: string;
                topic: string;
            }[] | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        lang: "python" | "cpp";
        name: string;
        nodes: {
            lang: "python" | "cpp";
            package: string;
            name: string;
            executable: string;
            id: string;
            namespace?: string | undefined;
            params?: Record<string, unknown> | undefined;
            pubs?: {
                type: string;
                topic: string;
            }[] | undefined;
            subs?: {
                type: string;
                topic: string;
            }[] | undefined;
        }[];
    }, {
        lang: "python" | "cpp";
        name: string;
        nodes: {
            lang: "python" | "cpp";
            package: string;
            name: string;
            executable: string;
            id: string;
            namespace?: string | undefined;
            params?: Record<string, unknown> | undefined;
            pubs?: {
                type: string;
                topic: string;
            }[] | undefined;
            subs?: {
                type: string;
                topic: string;
            }[] | undefined;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    packages: {
        lang: "python" | "cpp";
        name: string;
        nodes: {
            lang: "python" | "cpp";
            package: string;
            name: string;
            executable: string;
            id: string;
            namespace?: string | undefined;
            params?: Record<string, unknown> | undefined;
            pubs?: {
                type: string;
                topic: string;
            }[] | undefined;
            subs?: {
                type: string;
                topic: string;
            }[] | undefined;
        }[];
    }[];
}, {
    packages: {
        lang: "python" | "cpp";
        name: string;
        nodes: {
            lang: "python" | "cpp";
            package: string;
            name: string;
            executable: string;
            id: string;
            namespace?: string | undefined;
            params?: Record<string, unknown> | undefined;
            pubs?: {
                type: string;
                topic: string;
            }[] | undefined;
            subs?: {
                type: string;
                topic: string;
            }[] | undefined;
        }[];
    }[];
}>;
