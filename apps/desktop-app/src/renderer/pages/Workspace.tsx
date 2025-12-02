import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlowProvider,
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  MarkerType,
  Handle,
  Position,
  type ReactFlowInstance,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnSelectionChangeFunc,
  type CoordinateExtent,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { IconType } from "react-icons";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCommand,
  FiDatabase,
  FiEdit2,
  FiMap,
  FiPower,
  FiPlay,
  FiSave,
  FiTrash2,
  FiSun,
  FiMoon,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import type { WorkspaceDocument, WorkspaceNode } from "../../shared/workspace";
import { runtime } from "../runtime/registry";
import "../styles/Workspace.css";

type PaletteItem = {
  id: string;
  label: string;
  type: string;
  icon: IconType;
  description: string;
  defaultMeta?: WorkspaceNode["meta"];
};

type RosNodeData = {
  label: string;
  type: string;
  color: string;
  meta?: WorkspaceNode["meta"];
};

type FlowNode = Node<RosNodeData>;
type WorkspaceMeta = (WorkspaceDocument["meta"] & { edges?: Edge[] }) | undefined;

const randomNodeId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);

// Limit how far the viewport and nodes can move so the user stays on the grid.
const WORKSPACE_EXTENT: CoordinateExtent = [
  [0, 0],
  [2400, 1600],
];

const nodeTypeColors: Record<string, string> = {
  ArrowKeyPub: "#38bdf8",
  ConsoleSub: "#f97316",
  TurtleSimSub: "#22c55e",
  TurtleSimSubscriber: "#22c55e",
  RosbridgeBridge: "#c084fc",
  Forwarder: "#22d3ee",
  default: "#a3a3a3",
};

const selectableNodeTypes = Object.keys(nodeTypeColors).filter(
  (type) => type !== "default" && type !== "TurtleSimSubscriber"
);

const paletteGroups: Array<{ title: string; items: PaletteItem[] }> = [
  {
    title: "Runtime Nodes",
    items: [
      {
        id: "ArrowKeyPub",
        label: "Arrow Keys Publisher",
        type: "ArrowKeyPub",
        icon: FiCommand,
        description: "Publishes arrow key presses onto the workspace bus.",
        defaultMeta: { topic: "keys/arrows" },
      },
      {
        id: "TurtleSimSub",
        label: "Turtlesim Sub",
        type: "TurtleSimSub",
        icon: FiMap,
        description: "Translates arrow key events into /turtle1/cmd_vel Twist messages.",
        defaultMeta: {
          inputTopic: "keys/arrows",
          cmdVelTopic: "/turtle1/cmd_vel",
          linearSpeed: 1.5,
          angularSpeed: 3,
          stopAfterMs: 160,
        },
      },
      {
        id: "ConsoleSub",
        label: "Console Subscriber",
        type: "ConsoleSub",
        icon: FiDatabase,
        description: "Logs inbound messages from a topic to the console.",
        defaultMeta: { topic: "keys/arrows" },
      },
    ],
  },
  {
    title: "ROS Transport",
    items: [
      {
        id: "RosbridgeBridge",
        label: "Rosbridge Bridge",
        type: "RosbridgeBridge",
        icon: FiMap,
        description: "Connects to rosbridge and mirrors ROS publish/subscribe traffic (infrastructure).",
        defaultMeta: { urls: ["ws://localhost:9090", "ws://127.0.0.1:9090"], retryMs: 2500 },
      },
      {
        id: "Forwarder",
        label: "ROS Forwarder",
        type: "Forwarder",
        icon: FiPlay,
        description: "Forwards workspace bus messages into ROS topics.",
        defaultMeta: { from: "keys/arrows", to: "/keys/arrows" },
      },
    ],
  },
];

const normalizePosition = (position?: WorkspaceNode["position"]): WorkspaceNode["position"] => {
  if (!position || Number.isNaN(position.x) || Number.isNaN(position.y)) {
    return { x: 140, y: 120 };
  }
  return {
    x: Math.min(WORKSPACE_EXTENT[1][0], Math.max(WORKSPACE_EXTENT[0][0], position.x)),
    y: Math.min(WORKSPACE_EXTENT[1][1], Math.max(WORKSPACE_EXTENT[0][1], position.y)),
  };
};

const toFlowNode = (node: WorkspaceNode): FlowNode => ({
  id: node.id,
  type: "rosNode",
  position: normalizePosition(node.position),
  data: {
    label: node.label || node.type,
    type: node.type,
    color: nodeTypeColors[node.type] ?? nodeTypeColors.default,
    meta: node.meta ?? {},
  },
});

const toWorkspaceNode = (node: FlowNode): WorkspaceNode => ({
  id: node.id,
  type: node.data?.type ?? "Node",
  label: node.data?.label ?? node.data?.type ?? "Node",
  position: node.position,
  meta: node.data?.meta ?? {},
});

const RosNode: React.FC<NodeProps<FlowNode>> = ({ data, selected }) => (
  <div
    className={`workspace__rf-node ${selected ? "is-selected" : ""}`}
    style={{ borderColor: data.color }}
  >
    <Handle
      type="target"
      position={Position.Left}
      className="workspace__rf-handle"
      style={{ background: data.color }}
    />
    <div className="workspace__rf-body">
      <span className="workspace__rf-label">{data.label}</span>
      <span className="workspace__rf-meta">{data.type}</span>
    </div>
    <Handle
      type="source"
      position={Position.Right}
      className="workspace__rf-handle"
      style={{ background: data.color }}
    />
  </div>
);

const rosNodeTypes = { rosNode: RosNode };

const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceDoc, setWorkspaceDoc] = useState<WorkspaceDocument | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceMeta, setWorkspaceMeta] = useState<WorkspaceMeta>();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveTimestamp, setSaveTimestamp] = useState<string | null>(null);
  const [rosState, setRosState] = useState<"idle" | "starting" | "running" | "stopping" | "error">(
    "idle"
  );
  const [rosMessage, setRosMessage] = useState<string>("ROS idle");
  const [showConsole, setShowConsole] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showInspector, setShowInspector] = useState(true);
  const [showGraph, setShowGraph] = useState(false);
  const [graphImage, setGraphImage] = useState<string | null>(null);
  const [graphDot, setGraphDot] = useState<string | null>(null);
  const [graphStatus, setGraphStatus] = useState<"idle" | "loading" | "error">("idle");
  const [activeDrawerTab, setActiveDrawerTab] = useState<"console" | "viewer" | "graph">("console");
  const [consoleFeed, setConsoleFeed] = useState<
    Array<{ ts: number; topic: string; from: string; data: any }>
  >([]);
  const [lastPose, setLastPose] = useState<{ x: number; y: number; theta: number } | null>(null);
  const getStoredTheme = () => {
    if (typeof window === "undefined") return "dark" as const;
    const stored = window.localStorage?.getItem("bros2-theme");
    return stored === "light" ? "light" : "dark";
  };
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);

  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef(false);
  const lastSavedSigRef = useRef<string | null>(null);
  const runtimeNodesRef = useRef<Map<string, { type: string; metaSig: string }>>(new Map());

  const workspaceNodes = useMemo(() => nodes.map(toWorkspaceNode), [nodes]);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const rosProjectName = useMemo(() => {
    const base = (workspaceName || "").trim() || "turtlesim";
    const sanitized = base.toLowerCase().replace(/[^a-z0-9-_]/g, "_").replace(/_+/g, "_");
    const cleaned = sanitized.replace(/^_+/, "").replace(/_+$/, "");
    return cleaned || "turtlesim";
  }, [workspaceName]);
  const showDrawer = showConsole || showViewer || showGraph;
  const hasTurtlesimNode = useMemo(
    () =>
      workspaceNodes.some(
        (node) => node.type === "TurtleSimSub" || node.type === "TurtleSimSubscriber"
      ),
    [workspaceNodes]
  );
  const hasConsoleSubNode = useMemo(
    () => workspaceNodes.some((node) => node.type === "ConsoleSub"),
    [workspaceNodes]
  );
  const needsRosbridge = useMemo(
    () =>
      hasTurtlesimNode ||
      workspaceNodes.some((node) => node.type === "RosbridgeBridge" || node.type === "Forwarder"),
    [hasTurtlesimNode, workspaceNodes]
  );

  const ensureUniqueNameInFolder = useCallback(
    async (desired: string) => {
      const list = (await window.workspace.list()) ?? [];
      const folderKey = (workspaceMeta?.folder ?? "").trim();
      const names = new Set(
        list
          .filter((ws) => (ws.meta?.folder ?? "") === folderKey && ws.id !== workspaceDoc?.id)
          .map((ws) => ws.name)
      );
      const base = desired.trim() || "Untitled Workspace";
      if (!names.has(base)) return base;
      let counter = 2;
      while (true) {
        const candidate = `${base} (${counter})`;
        if (!names.has(candidate)) return candidate;
        counter += 1;
      }
    },
    [workspaceDoc?.id, workspaceMeta?.folder]
  );
  const backgroundGridColor = theme === "light" ? "rgba(15, 23, 42, 0.7)" : "rgba(148, 163, 184, 0.2)";
  const backgroundGridBg = theme === "light" ? "#f2f4f7" : "transparent";
  const workspaceSig = useMemo(
    () =>
      JSON.stringify({
        name: workspaceName.trim(),
        meta: workspaceMeta ?? {},
        nodes: workspaceNodes,
      }),
    [workspaceMeta, workspaceName, workspaceNodes]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage?.setItem("bros2-theme", theme);
    document.body.classList.toggle("theme-light", theme === "light");
  }, [theme]);

  useEffect(() => {
    if (!id) {
      setError("Workspace identifier is missing.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const doc = await window.workspace.load(id);
        if (cancelled) return;
        const loadedNodes = (doc.nodes ?? []).map(toFlowNode);
        const loadedEdges = ((doc.meta as WorkspaceMeta)?.edges ?? []) as Edge[];

        setWorkspaceDoc(doc);
        setWorkspaceName(doc.name);
        setWorkspaceMeta({ ...(doc.meta ?? {}), edges: loadedEdges });
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setSelectedNodeId(loadedNodes[0]?.id ?? null);
        setSaveTimestamp(doc.updatedAt);
        setError(null);
        lastSavedSigRef.current = JSON.stringify({
          name: doc.name,
          meta: { ...(doc.meta ?? {}), edges: loadedEdges },
          nodes: doc.nodes ?? [],
        });
      } catch (err) {
        console.error("[workspace] failed to load", err);
        if (!cancelled) {
          setError("We couldn’t open this workspace. It may have been moved or deleted.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [id, setEdges, setNodes]);

  const saveWorkspace = useCallback(async () => {
    if (!workspaceDoc) return;
    setSavingState("saving");
    try {
      const uniqueName = await ensureUniqueNameInFolder(workspaceName);
      const payload: WorkspaceDocument = {
        ...workspaceDoc,
        name: uniqueName,
        nodes: workspaceNodes,
        meta: { ...(workspaceMeta ?? {}), edges } as WorkspaceDocument["meta"],
      };
      const saved = await window.workspace.save(workspaceDoc.id, payload);
      setWorkspaceDoc(saved);
      setWorkspaceName(saved.name);
      setSaveTimestamp(saved.updatedAt);
      setSavingState("saved");
      lastSavedSigRef.current = workspaceSig;
    } catch (err) {
      console.error("[workspace] save failed", err);
      setSavingState("error");
    }
  }, [edges, ensureUniqueNameInFolder, workspaceDoc, workspaceMeta, workspaceName, workspaceNodes, workspaceSig]);

  useEffect(() => {
    if (!workspaceDoc) return;
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      lastSavedSigRef.current ??= workspaceSig;
      return;
    }

    // Only save when there is a meaningful change.
    if (lastSavedSigRef.current === workspaceSig) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      void saveWorkspace();
    }, 850);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [workspaceDoc, workspaceSig, saveWorkspace]);

  useEffect(() => {
    if (savingState === "saved") {
      const timeout = setTimeout(() => setSavingState("idle"), 1800);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [savingState]);

  useEffect(() => {
    if (!nodes.length || !rfInstanceRef.current) return;
    rfInstanceRef.current.fitView({ padding: 0.2, duration: 320 });
  }, [nodes.length]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!hasConsoleSubNode && !hasTurtlesimNode) return;
    const handler = (evt: any) => {
      if (!evt || !evt.topic) return;
      if (hasConsoleSubNode) {
        setConsoleFeed((prev) => [...prev, evt].slice(-200));
      }
      if (evt.topic === "/turtle1/pose" && evt.data) {
        const pose = evt.data as any;
        if (
          typeof pose.x === "number" &&
          typeof pose.y === "number" &&
          typeof pose.theta === "number"
        ) {
          setLastPose({ x: pose.x, y: pose.y, theta: pose.theta });
          if (rosState === "running") setRosMessage("rosbridge + turtlesim running");
        }
      }
    };
    runtime.bus.on("__all__", handler);
    return () => {
      runtime.bus.off("__all__", handler);
    };
  }, [hasConsoleSubNode, hasTurtlesimNode, rosState]);

  useEffect(() => {
    const shouldShowViewer = rosState === "running" && hasTurtlesimNode;
    setShowViewer(shouldShowViewer);
    if (!shouldShowViewer) {
      setLastPose(null);
    } else {
      const bridge = (globalThis as any).__rosbridge__;
      if (bridge?.subscribeRos) {
        bridge.subscribeRos("/turtle1/pose");
      }
    }
  }, [hasTurtlesimNode, rosState]);

  useEffect(() => {
    const available: Array<"console" | "viewer" | "graph"> = [];
    if (showViewer) available.push("viewer");
    if (showConsole) available.push("console");
    if (showGraph) available.push("graph");
    if (!available.length) return;
    if (!available.includes(activeDrawerTab)) {
      setActiveDrawerTab(available[0]);
    }
  }, [activeDrawerTab, showConsole, showGraph, showViewer]);

  const handleSelectionChange = useCallback<OnSelectionChangeFunc<FlowNode, Edge>>(
    ({ nodes: selectedNodes }) => {
      setSelectedNodeId(selectedNodes?.[0]?.id ?? null);
    },
    []
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#7dd3fc", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#7dd3fc" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  useEffect(() => {
    setWorkspaceMeta((prev) => ({ ...(prev ?? {}), edges }));
  }, [edges]);

  const handleAddNode = useCallback(
    (item: PaletteItem) => {
      const newId = randomNodeId();
      setNodes((prev) => {
        const basePosition = { x: 220 + prev.length * 32, y: 180 + prev.length * 22 };
        if (rfInstanceRef.current && flowWrapperRef.current) {
          const bounds = flowWrapperRef.current.getBoundingClientRect();
          const projected = rfInstanceRef.current.screenToFlowPosition({
            x: bounds.left + bounds.width / 2,
            y: bounds.top + bounds.height / 2,
          });
          basePosition.x = projected.x;
          basePosition.y = projected.y;
        }

        const clampedPosition = {
          x: Math.min(WORKSPACE_EXTENT[1][0], Math.max(WORKSPACE_EXTENT[0][0], basePosition.x)),
          y: Math.min(WORKSPACE_EXTENT[1][1], Math.max(WORKSPACE_EXTENT[0][1], basePosition.y)),
        };

        const node: FlowNode = {
          id: newId,
          type: "rosNode",
          position: clampedPosition,
          data: {
            label: item.label,
            type: item.type,
            color: nodeTypeColors[item.type] ?? nodeTypeColors.default,
            meta: { ...item.defaultMeta, paletteId: item.id },
          },
        };

        return [...prev, node];
      });
      setSelectedNodeId(newId);
    },
    [setNodes]
  );

  const handleNodeLabelChange = useCallback(
    (id: string, value: string) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, label: value } } : node
        )
      );
    },
    [setNodes]
  );

  const handleNodeTypeChange = useCallback(
    (id: string, value: string) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  type: value,
                  color: nodeTypeColors[value] ?? nodeTypeColors.default,
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const handleNodeNotesChange = useCallback(
    (id: string, value: string) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  meta: { ...(node.data.meta ?? {}), notes: value },
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setEdges((eds) =>
      eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId)
    );
    setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId, setEdges, setNodes]);

  useEffect(() => {
    const runtimeMap = runtimeNodesRef.current;
    const desired = new Map(workspaceNodes.map((node) => [node.id, node]));

    for (const id of Array.from(runtimeMap.keys())) {
      if (!desired.has(id)) {
        runtime.stop(id);
        runtimeMap.delete(id);
      }
    }

    for (const node of workspaceNodes) {
      const metaSig = JSON.stringify(node.meta ?? {});
      const existing = runtimeMap.get(node.id);
      if (existing && existing.type === node.type && existing.metaSig === metaSig) continue;
      if (existing) {
        runtime.stop(node.id);
        runtimeMap.delete(node.id);
      }

      if (!runtime.has(node.type)) {
        console.warn("[runtime] unknown node type; skipping:", node.type);
        continue;
      }

      try {
        let config: any = node.meta ?? {};
        if (node.type === "Forwarder") {
          const to = (node.meta as any)?.to ?? "/keys/arrows";
          const from = (node.meta as any)?.from ?? "keys/arrows";
          config = {
            ...node.meta,
            from,
            to,
            send: (topic: string, msg: any) => {
              const bridge = (globalThis as any).__rosbridge__;
              if (bridge?.publishRos) {
                bridge.publishRos(topic, msg);
              } else {
                console.warn("[runtime] Forwarder has no rosbridge connection");
              }
            },
          };
        }
        if (node.type === "RosbridgeBridge") {
          const defaults = ["ws://localhost:9090", "ws://127.0.0.1:9090"];
          const inferredHost =
            typeof window !== "undefined" && window.location?.hostname
              ? `ws://${window.location.hostname}:9090`
              : null;
          const urls = Array.from(
            new Set(
              [...(config.urls ?? []), config.url, inferredHost, ...defaults].filter(Boolean)
            )
          );
          config = {
            ...config,
            urls,
            retryMs: config.retryMs ?? 2500,
          };
        }

        runtime.create(node.type, config, node.id);
        runtime.start(node.id);
        runtimeMap.set(node.id, { type: node.type, metaSig });
      } catch (err) {
        console.error("[runtime] failed to start node", node.type, err);
      }
    }
  }, [workspaceNodes]);

  useEffect(
    () => () => {
      const runtimeMap = runtimeNodesRef.current;
      for (const id of runtimeMap.keys()) {
        runtime.stop(id);
      }
      runtimeMap.clear();
    },
    []
  );

  const handleSaveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await saveWorkspace();
  }, [saveWorkspace]);

  useEffect(() => {
    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(nodes[0]?.id ?? null);
    }
  }, [nodes, selectedNodeId]);

  const statusLabel = useMemo(() => {
    switch (savingState) {
      case "saving":
        return "Saving…";
      case "saved":
        return saveTimestamp
          ? `Saved ${new Date(saveTimestamp).toLocaleTimeString()}`
          : "Saved";
      case "error":
        return "Save failed · check disk permissions";
      default:
        return "Autosave ready";
    }
  }, [saveTimestamp, savingState]);

  const rosStatusClass = useMemo(() => {
    if (rosState === "running") return "is-running";
    if (rosState === "error") return "is-error";
    if (rosState === "starting" || rosState === "stopping") return "is-pending";
    return "";
  }, [rosState]);

  const rosButtonLabel = useMemo(() => {
    switch (rosState) {
      case "starting":
        return "Starting…";
      case "stopping":
        return "Stopping…";
      case "running":
        return "Stop ROS";
      default:
        return "Start ROS";
    }
  }, [rosState]);

  const generateGraph = useCallback(async () => {
    setShowGraph(true);
    setActiveDrawerTab("graph");
    setGraphImage(null);
    setGraphDot(null);
    if (!window.runner?.exec) {
      setGraphStatus("error");
      return;
    }
    setGraphStatus("loading");
    const cmd =
      'bash -lc "source /opt/ros/humble/setup.bash && export QT_QPA_PLATFORM=offscreen; if command -v rqt_graph >/dev/null 2>&1; then if command -v dot >/dev/null 2>&1; then rqt_graph --dot > /tmp/rqt_graph.dot && dot -Tpng /tmp/rqt_graph.dot -o /tmp/rqt_graph.png && base64 /tmp/rqt_graph.png; else rqt_graph --dot; fi; else echo rqt_graph missing >&2; exit 1; fi"';
    try {
      const res = await window.runner.exec(cmd);
      if (res.code !== 0) throw new Error(res.stderr || res.stdout || "rqt_graph failed");
      const out = (res.stdout || "").trim();
      if (!out) throw new Error("Empty rqt_graph output");
      if (out.startsWith("digraph")) {
        setGraphDot(out);
      } else {
        setGraphImage(out);
      }
      setGraphStatus("idle");
    } catch (err) {
      console.error("[rqt_graph] failed", err);
      setGraphStatus("error");
    }
  }, []);

  const startRos = useCallback(async () => {
    if (rosState === "starting" || rosState === "running") return;
    if (!window.runner?.up || !window.runner.exec) {
      setRosState("error");
      setRosMessage("window.runner is unavailable");
      return;
    }
    setRosState("starting");
    setRosMessage(
      `Launching rosbridge${hasTurtlesimNode ? " + turtlesim" : ""}${
        showGraph ? " + rqt_graph" : ""
      }…`
    );
    try {
      await window.runner.up(rosProjectName);
      setRosMessage("Starting rosbridge…");
      const bridgeRes = await window.runner.exec(
        'bash -lc "source /opt/ros/humble/setup.bash && nohup ros2 launch rosbridge_server rosbridge_websocket_launch.xml >/tmp/rosbridge.log 2>&1 & echo $!"'
      );
      if (bridgeRes.code !== 0) throw new Error(bridgeRes.stderr || bridgeRes.stdout);
      if (hasTurtlesimNode) {
        setRosMessage("Starting turtlesim…");
        const turtleRes = await window.runner.exec(
          'bash -lc "source /opt/ros/humble/setup.bash && QT_QPA_PLATFORM=offscreen nohup ros2 run turtlesim turtlesim_node >/tmp/turtlesim.log 2>&1 & echo $!"'
        );
        if (turtleRes.code !== 0) throw new Error(turtleRes.stderr || turtleRes.stdout);
      }
      setRosMessage("rosbridge launched");
      const bridge = (globalThis as any).__rosbridge__;
      if (bridge?.subscribeRos) {
        bridge.subscribeRos("/turtle1/pose");
      }
      setRosState("running");
      setRosMessage(
        `rosbridge${hasTurtlesimNode ? " + turtlesim" : ""} running${
          showGraph ? " (rqt ready)" : ""
        }`
      );
      if (showGraph) void generateGraph();
    } catch (err) {
      console.error("[ros] start failed", err);
      setRosState("error");
      setRosMessage("Failed to start ROS (check Docker/rosbridge)");
    }
  }, [generateGraph, hasTurtlesimNode, rosProjectName, rosState, showGraph]);

  const stopRos = useCallback(async () => {
    if (rosState === "stopping" || rosState === "idle") return;
    if (!window.runner?.down || !window.runner.exec) {
      setRosState("error");
      setRosMessage("window.runner is unavailable");
      return;
    }
    setRosState("stopping");
    setRosMessage("Stopping rosbridge/turtlesim…");
    try {
      await window.runner.exec(
        'bash -lc "pkill -f rosbridge_websocket || true; pkill -f turtlesim_node || true"'
      );
      await window.runner.down();
      setRosState("idle");
      setRosMessage("ROS stopped");
      setShowViewer(false);
      setLastPose(null);
    } catch (err) {
      console.error("[ros] stop failed", err);
      setRosState("error");
      setRosMessage("Failed to stop ROS cleanly");
    }
  }, [rosState]);

  useEffect(() => {
    return () => {
      // stop runtime nodes
      const runtimeMap = runtimeNodesRef.current;
      for (const id of runtimeMap.keys()) {
        runtime.stop(id);
      }
      runtimeMap.clear();
      // stop containers
      void window.runner?.exec?.(
        'bash -lc "pkill -f rosbridge_websocket || true; pkill -f turtlesim_node || true"'
      );
      void window.runner?.down?.();
    };
  }, []);

  if (loading) {
    return (
      <div className={`workspace workspace--centered ${theme === "light" ? "theme-light" : ""}`}>
        <div className="workspace__loader">
          <span className="workspace__loader-dot" />
          <span className="workspace__loader-text">Loading workspace…</span>
        </div>
      </div>
    );
  }

  if (error || !workspaceDoc) {
    return (
      <div className={`workspace workspace--centered ${theme === "light" ? "theme-light" : ""}`}>
        <div className="workspace__error-card">
          <h2>Workspace unavailable</h2>
          <p>{error ?? "We couldn’t load this workspace."}</p>
          <button
            type="button"
            className="workspace__button workspace__button--primary"
            onClick={() => navigate("/dashboard")}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className={`workspace ${theme === "light" ? "theme-light" : ""}`}>
        <header className="workspace__topbar">
          <button
            type="button"
            className="workspace__button workspace__button--ghost"
            onClick={() => navigate("/dashboard")}
          >
            <FiChevronLeft size={16} />
            Dashboard
          </button>

          <div className="workspace__title">
            <FiEdit2 size={16} />
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Untitled workspace"
            />
          </div>

          <div
            className={`workspace__status ${
              savingState === "error"
                ? "is-error"
                : savingState === "saving"
                ? "is-saving"
                : ""
            }`}
          >
            {statusLabel}
          </div>

          <div className="workspace__actions">
            <button
              type="button"
              className={`workspace__theme-toggle ${theme === "light" ? "is-selected" : ""}`}
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? <FiMoon size={16} /> : <FiSun size={16} />}
            </button>
            <div className="workspace__ros">
              <div className={`workspace__ros-status ${rosStatusClass}`}>{rosMessage}</div>
              <button
                type="button"
                className={`workspace__button ${
                  rosState === "running" ? "workspace__button--danger" : "workspace__button--ros"
                }`}
                onClick={rosState === "running" ? stopRos : startRos}
                disabled={rosState === "starting" || rosState === "stopping"}
                title="Manage rosbridge + turtlesim inside the runner"
              >
                <FiPower size={15} />
                {rosButtonLabel}
              </button>
            </div>
            <button
              type="button"
              className="workspace__button workspace__button--primary"
              onClick={handleSaveNow}
              disabled={savingState === "saving"}
            >
              <FiSave size={16} />
              Save now
            </button>
          </div>
        </header>

        <div className={`workspace__body ${showInspector ? "" : "is-inspector-hidden"}`}>
          <aside className="workspace__panel workspace__panel--left">
            <h3 className="workspace__panel-title">Blocks</h3>
            {paletteGroups.map((group) => (
              <div key={group.title} className="workspace__palette-group">
                <h4>{group.title}</h4>
                <div className="workspace__palette-items">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="workspace__palette-item"
                      onClick={() => handleAddNode(item)}
                    >
                      <span className="workspace__palette-icon" data-type={item.type}>
                        <item.icon size={18} />
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          <section ref={flowWrapperRef} className="workspace__canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onSelectionChange={handleSelectionChange}
              nodeTypes={rosNodeTypes}
              fitView={nodes.length > 0}
              fitViewOptions={{ padding: 0.14 }}
              minZoom={0.45}
              maxZoom={1.8}
              translateExtent={WORKSPACE_EXTENT}
              nodeExtent={WORKSPACE_EXTENT}
              panOnScroll
              panOnDrag // allow click-and-drag on the canvas to pan
              selectionOnDrag
              proOptions={{ hideAttribution: true }}
              className="workspace__reactflow"
              onInit={(instance) => {
                rfInstanceRef.current = instance;
                if (nodes.length) {
                  instance.fitView({ padding: 0.2 });
                }
              }}
            >
              <Background
                gap={24}
                size={3}
                color={backgroundGridColor}
                bgColor={backgroundGridBg}
                variant="dots"
              />
              {nodes.length > 0 && (
                <MiniMap
                  pannable
                  zoomable
                  bgColor={theme === "light" ? "#fff7e6" : "#0b0f16"}
                  maskColor={theme === "light" ? "rgba(255, 247, 230, 0.9)" : "rgba(11, 15, 22, 0.9)"}
                  nodeColor={(node) => nodeTypeColors[(node as FlowNode).data?.type ?? "default"]}
                  nodeStrokeColor={theme === "light" ? "#0f172a" : "#0b0f16"}
                />
              )}
              <Controls position="bottom-right" />
            </ReactFlow>
          </section>

          <aside
            className={`workspace__panel workspace__panel--right ${
              showInspector ? "" : "is-hidden"
            }`}
          >
            <h3 className="workspace__panel-title">Inspector</h3>
            <div className="workspace__panel-body">
              {selectedNode ? (
                <>
                  <label>
                    Node label
                    <input
                      value={selectedNode.data?.label ?? ""}
                      onChange={(event) =>
                        handleNodeLabelChange(selectedNode.id, event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Node type
                  <select
                    value={selectedNode.data?.type ?? ""}
                    onChange={(event) =>
                      handleNodeTypeChange(selectedNode.id, event.target.value)
                    }
                  >
                    {selectableNodeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  </label>

                  <label>
                    Notes
                    <textarea
                      value={(selectedNode.data?.meta as any)?.notes ?? ""}
                      placeholder="What happens inside this block?"
                      onChange={(event) =>
                        handleNodeNotesChange(selectedNode.id, event.target.value)
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="workspace__button workspace__button--danger"
                    onClick={handleDeleteNode}
                  >
                    <FiTrash2 size={16} />
                    Remove block
                  </button>
                </>
              ) : (
                <div className="workspace__empty-inspector">
                  Select a block to edit its properties.
                </div>
              )}

              <div className="workspace__divider" />

              <label>
                Workspace summary
                <textarea
                  value={workspaceMeta?.description ?? ""}
                  placeholder="Describe what this workspace does…"
                  onChange={(event) =>
                    setWorkspaceMeta((prev) => ({
                      ...(prev ?? {}),
                      description: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </aside>
        </div>

        <button
          type="button"
          className="workspace__inspector-toggle"
          onClick={() => setShowInspector((prev) => !prev)}
          aria-label={showInspector ? "Hide inspector" : "Show inspector"}
        >
          {showInspector ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
        </button>

        <div className="workspace__tools-floating">
          <button
            type="button"
            className={`workspace__button workspace__button--primary ${
              showConsole ? "is-active" : ""
            }`}
            onClick={() => {
              setShowConsole((prev) => {
                const next = !prev;
                if (next) setActiveDrawerTab("console");
                return next;
              });
              setShowGraph(false);
            }}
          >
            <FiCommand size={14} />
            {showConsole ? "Hide Console" : "Show Console"}
          </button>
          <button
            type="button"
            className="workspace__button workspace__button--ghost"
            onClick={() => void generateGraph()}
            disabled={graphStatus === "loading" || rosState !== "running"}
            title={rosState === "running" ? "Generate rqt_graph snapshot" : "Start ROS first"}
          >
            {graphStatus === "loading" ? "Graph…" : "RQT"}
          </button>
        </div>

        {showDrawer && (
          <div className="workspace__drawer">
            <div className="workspace__drawer-header">
              <div className="workspace__drawer-tabs">
                {showConsole && (
                  <button
                    type="button"
                    className={`workspace__drawer-tab ${
                      activeDrawerTab === "console" ? "is-active" : ""
                    }`}
                    onClick={() => setActiveDrawerTab("console")}
                  >
                    Console
                  </button>
                )}
                {showViewer && (
                  <button
                    type="button"
                    className={`workspace__drawer-tab ${
                      activeDrawerTab === "viewer" ? "is-active" : ""
                    }`}
                    onClick={() => setActiveDrawerTab("viewer")}
                  >
                    Turtlesim
                  </button>
                )}
                {showGraph && (
                  <button
                    type="button"
                    className={`workspace__drawer-tab ${
                      activeDrawerTab === "graph" ? "is-active" : ""
                    }`}
                    onClick={() => setActiveDrawerTab("graph")}
                  >
                    RQT
                  </button>
                )}
              </div>
              <button
                type="button"
                className="workspace__button workspace__button--ghost"
                onClick={() => {
                  setShowConsole(false);
                  setShowGraph(false);
                  if (rosState !== "running") setShowViewer(false);
                }}
              >
                Close
              </button>
            </div>

            {activeDrawerTab === "console" && showConsole && (
              <div className="workspace__console">
                {consoleFeed.length === 0 ? (
                  <div className="workspace__console-empty">No messages yet.</div>
                ) : (
                  consoleFeed
                    .slice()
                    .reverse()
                    .map((evt, idx) => (
                      <div key={`${evt.ts}-${idx}`} className="workspace__console-row">
                        <span className="workspace__console-topic">{evt.topic}</span>
                        <span className="workspace__console-from">{evt.from}</span>
                        <span className="workspace__console-payload">
                          {typeof evt.data === "string"
                            ? evt.data
                            : JSON.stringify(evt.data)}
                        </span>
                        <span className="workspace__console-ts">
                          {new Date(evt.ts).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                )}
              </div>
            )}

            {activeDrawerTab === "viewer" && showViewer && (
              <div className="workspace__viewer">
                {lastPose ? (
                  <svg viewBox="0 0 12 12" className="workspace__viewer-canvas">
                    <rect x="0" y="0" width="12" height="12" rx="1.2" fill="#0b1220" stroke="#1f2937" />
                    <circle cx="1" cy="11" r="0.08" fill="#111827" />
                    <g transform={`translate(${lastPose.x / 5}, ${12 - lastPose.y / 5})`}>
                      <circle cx="0" cy="0" r="0.18" fill="#22c55e" />
                      <line
                        x1="0"
                        y1="0"
                        x2={Math.cos(lastPose.theta) * 0.6}
                        y2={-Math.sin(lastPose.theta) * 0.6}
                        stroke="#befae3"
                        strokeWidth="0.08"
                        strokeLinecap="round"
                      />
                    </g>
                  </svg>
                ) : (
                  <div className="workspace__viewer-empty">
                    Waiting for /turtle1/pose …
                  </div>
                )}
              </div>
            )}

            {activeDrawerTab === "graph" && showGraph && (
              <div className="workspace__graph">
                {graphStatus === "loading" && (
                  <div className="workspace__viewer-empty">Generating rqt_graph…</div>
                )}
                {graphStatus === "error" && (
                  <div className="workspace__viewer-empty">
                    Failed to generate rqt_graph. Ensure graphviz is installed in the runner.
                  </div>
                )}
                {graphStatus === "idle" && graphImage && (
                  <img
                    src={`data:image/png;base64,${graphImage}`}
                    alt="rqt_graph"
                    className="workspace__graph-img"
                  />
                )}
                {graphStatus === "idle" && !graphImage && graphDot && (
                  <pre className="workspace__graph-dot">{graphDot}</pre>
                )}
              </div>
            )}
          </div>
        )}

        <div className="workspace__zoom-overlay">
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default WorkspacePage;
