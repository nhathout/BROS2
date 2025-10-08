import { z } from "zod";
const TopicTypePattern = /^[A-Za-z][A-Za-z0-9_]*\/[A-Za-z][A-Za-z0-9_]*\/[A-Za-z][A-Za-z0-9_]*$/;
const TopicNamePattern = /^\/?[A-Za-z0-9_\/]+$/;
export const LangSchema = z.enum(["python", "cpp"]);
export const TopicRefSchema = z
    .object({
    topic: z.string().regex(TopicNamePattern, "Invalid ROS 2 topic name"),
    type: z.string().regex(TopicTypePattern, "Invalid ROS 2 message type")
})
    .strict();
export const NodeSchema = z
    .object({
    id: z.string().min(1),
    name: z.string().min(1),
    package: z.string().min(1),
    executable: z.string().min(1),
    lang: LangSchema,
    namespace: z.string().min(1).optional(),
    params: z.record(z.unknown()).optional(),
    pubs: z.array(TopicRefSchema).optional(),
    subs: z.array(TopicRefSchema).optional()
})
    .strict();
export const PackageSchema = z
    .object({
    name: z.string().min(1),
    lang: LangSchema,
    nodes: z.array(NodeSchema)
})
    .strict();
export const IRSchema = z
    .object({
    packages: z.array(PackageSchema)
})
    .strict();
