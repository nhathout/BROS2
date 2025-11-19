import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { IconType } from "react-icons";
import {
  FiCamera,
  FiCpu,
  FiCommand,
  FiDatabase,
  FiMap,
  FiTarget,
  FiZap,
  FiPlay,
  FiChevronLeft,
  FiSave,
  FiTrash2,
  FiEdit2,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import type { WorkspaceDocument, WorkspaceNode } from "../../shared/workspace";
import "../styles/Workspace.css";

type PaletteItem = {
  id: string;
  label: string;
  type: string;
  icon: IconType;
  description: string;
  defaultMeta?: WorkspaceNode["meta"];
};

const randomNodeId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);

const nodeTypeColors: Record<string, string> = {
  entry: "#38bdf8",
  sensor: "#0ea5e9",
  logic: "#f97316",
  actuator: "#facc15",
  transform: "#6366f1",
  model: "#8b5cf6",
  visualize: "#ec4899",
  map: "#22d3ee",
  costmap: "#14b8a6",
  planner: "#34d399",
  goal: "#f87171",
  io: "#f472b6",
  compute: "#c084fc",
  default: "#a3a3a3",
};

const paletteGroups: Array<{ title: string; items: PaletteItem[] }> = [
  {
    title: "Sensors & Inputs",
    items: [
      {
        id: "camera-feed",
        label: "Camera Feed",
        type: "sensor",
        icon: FiCamera,
        description: "Capture RGB frames from your vision rig.",
      },
      {
        id: "lidar",
        label: "LiDAR Sweep",
        type: "sensor",
        icon: FiTarget,
        description: "360° point cloud from the LiDAR array.",
      },
      {
        id: "map-loader",
        label: "Map Loader",
        type: "map",
        icon: FiMap,
        description: "Bring in saved maps or SLAM outputs.",
      },
    ],
  },
  {
    title: "Processing",
    items: [
      {
        id: "preprocess",
        label: "Preprocess",
        type: "transform",
        icon: FiCpu,
        description: "Normalize, crop, and clean sensor data.",
      },
      {
        id: "detector",
        label: "Object Detector",
        type: "model",
        icon: FiCommand,
        description: "Run inference with your trained model.",
      },
      {
        id: "fusion",
        label: "Sensor Fusion",
        type: "logic",
        icon: FiDatabase,
        description: "Combine inputs into a unified state.",
      },
    ],
  },
  {
    title: "Control & Outputs",
    items: [
      {
        id: "planner",
        label: "Route Planner",
        type: "planner",
        icon: FiMap,
        description: "Plan waypoints with costmaps and goals.",
      },
      {
        id: "goal-dispatch",
        label: "Goal Dispatch",
        type: "goal",
        icon: FiPlay,
        description: "Send tasks to actuators or fleets.",
      },
      {
        id: "actuator",
        label: "Motor Driver",
        type: "actuator",
        icon: FiZap,
        description: "Drive motors or servos with commands.",
      },
    ],
  },
];

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
};

const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceDoc, setWorkspaceDoc] = useState<WorkspaceDocument | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceMeta, setWorkspaceMeta] = useState<WorkspaceDocument["meta"] | undefined>(undefined);
  const [nodes, setNodes] = useState<WorkspaceNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveTimestamp, setSaveTimestamp] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef(false);
  const panRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  useEffect(() => {
    if (!id) {
      setError("Workspace identifier is missing.");
      setLoading(false);
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        const doc = await window.workspace.load(id);
        if (!isMounted) return;
        setWorkspaceDoc(doc);
        setWorkspaceName(doc.name);
        setWorkspaceMeta(doc.meta ?? {});
        setNodes(doc.nodes ?? []);
        setSelectedNodeId(doc.nodes?.[0]?.id ?? null);
        setError(null);
        setSaveTimestamp(doc.updatedAt);
      } catch (err) {
        console.error("[workspace] failed to load", err);
        if (isMounted) {
          setError("We couldn’t open this workspace. It may have been moved or deleted.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const saveWorkspace = useCallback(async () => {
    if (!workspaceDoc) return;
    setSavingState("saving");
    try {
      const payload: WorkspaceDocument = {
        ...workspaceDoc,
        name: workspaceName.trim() || "Untitled Workspace",
        nodes,
        meta: workspaceMeta,
      };
      const saved = await window.workspace.save(workspaceDoc.id, payload);
      setWorkspaceDoc(saved);
      setSaveTimestamp(saved.updatedAt);
      setSavingState("saved");
    } catch (err) {
      console.error("[workspace] save failed", err);
      setSavingState("error");
    }
  }, [nodes, workspaceDoc, workspaceMeta, workspaceName]);

  useEffect(() => {
    if (!workspaceDoc) return;
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void saveWorkspace();
    }, 900);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [nodes, workspaceMeta, workspaceName, saveWorkspace, workspaceDoc]);

  useEffect(() => {
    if (savingState === "saved") {
      const timeout = setTimeout(() => setSavingState("idle"), 2000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [savingState]);

  const handleSaveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await saveWorkspace();
  }, [saveWorkspace]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const handleAddNode = useCallback(
    (item: PaletteItem) => {
      const canvas = canvasRef.current;
      const defaultPosition = { x: 180, y: 140 };
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        defaultPosition.x =
          (rect.width / 2 - pan.x) / zoom - 120 + Math.random() * 80 - 40;
        defaultPosition.y =
          (rect.height / 2 - pan.y) / zoom - 80 + Math.random() * 80 - 40;
      }

      const node: WorkspaceNode = {
        id: randomNodeId(),
        type: item.type,
        label: item.label,
        position: {
          x: Math.max(32, defaultPosition.x),
          y: Math.max(32, defaultPosition.y),
        },
        meta: {
          ...item.defaultMeta,
          paletteId: item.id,
        },
      };

      setNodes((prev) => [...prev, node]);
      setSelectedNodeId(node.id);
    },
    [pan.x, pan.y, zoom]
  );

  const handlePanMove = useCallback((event: PointerEvent) => {
    if (!panRef.current.active) return;
    const deltaX = event.clientX - panRef.current.startX;
    const deltaY = event.clientY - panRef.current.startY;
    setPan({
      x: panRef.current.originX + deltaX,
      y: panRef.current.originY + deltaY,
    });
  }, []);

  const stopPanning = useCallback(() => {
    panRef.current.active = false;
    window.removeEventListener("pointermove", handlePanMove);
    window.removeEventListener("pointerup", stopPanning);
  }, [handlePanMove]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scale = zoom;
      const { id: dragId, offsetX, offsetY } = dragRef.current;
      const pointerX = (event.clientX - rect.left - pan.x) / scale;
      const pointerY = (event.clientY - rect.top - pan.y) / scale;
      const nextX = pointerX - offsetX;
      const nextY = pointerY - offsetY;
      const maxX = rect.width / scale - 200;
      const maxY = rect.height / scale - 140;

      setNodes((prev) =>
        prev.map((node) =>
          node.id === dragId
            ? {
                ...node,
                position: {
                  x: Math.max(24, Math.min(maxX, nextX)),
                  y: Math.max(24, Math.min(maxY, nextY)),
                },
              }
            : node
        )
      );
    },
    [zoom, pan.x, pan.y]
  );

  const stopDragging = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }, [handlePointerMove]);

  const handleNodePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, node: WorkspaceNode) => {
      event.stopPropagation();
      event.preventDefault();
      setSelectedNodeId(node.id);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scale = zoom;
      const pointerX = (event.clientX - rect.left - pan.x) / scale;
      const pointerY = (event.clientY - rect.top - pan.y) / scale;
      dragRef.current = {
        id: node.id,
        offsetX: pointerX - node.position.x,
        offsetY: pointerY - node.position.y,
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDragging);
    },
    [handlePointerMove, stopDragging, zoom, pan.x, pan.y]
  );

  const handleCanvasPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isNode = target.closest(".workspace__node");
      const isPrimary = event.button === 0;
      const isPanTrigger =
        event.button === 1 ||
        event.buttons === 4 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey;

      if (!isNode) {
        setSelectedNodeId(null);
      }

      const shouldPan = isPanTrigger || (!isNode && isPrimary);

      if (shouldPan && canvasRef.current) {
        event.preventDefault();
        panRef.current = {
          active: true,
          startX: event.clientX,
          startY: event.clientY,
          originX: pan.x,
          originY: pan.y,
        };
        window.addEventListener("pointermove", handlePanMove);
        window.addEventListener("pointerup", stopPanning, { once: true });
      }
    },
    [pan.x, pan.y, handlePanMove, stopPanning]
  );

  const updateZoom = useCallback((next: number) => {
    setZoom((prev) => {
      const clamped = Math.min(2, Math.max(0.5, typeof next === "number" ? next : prev));
      return Math.round(clamped * 100) / 100;
    });
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        updateZoom(zoom + delta);
      } else {
        event.preventDefault();
        setPan((prev) => ({
          x: prev.x - event.deltaX,
          y: prev.y - event.deltaY,
        }));
      }
    },
    [updateZoom, zoom]
  );

  const handleZoomButton = useCallback(
    (direction: "in" | "out" | "reset") => {
      if (direction === "reset") {
        updateZoom(1);
      } else {
        updateZoom(zoom + (direction === "in" ? 0.1 : -0.1));
      }
    },
    [updateZoom, zoom]
  );


  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointermove", handlePanMove);
      window.removeEventListener("pointerup", stopPanning);
    };
  }, [handlePointerMove, stopDragging, handlePanMove, stopPanning]);

  const updateNode = useCallback((id: string, updater: (node: WorkspaceNode) => WorkspaceNode) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === id ? updater(node) : node))
    );
  }, []);

  const handleNodeLabelChange = useCallback(
    (id: string, value: string) => {
      updateNode(id, (node) => ({
        ...node,
        label: value,
      }));
    },
    [updateNode]
  );

  const handleNodeTypeChange = useCallback(
    (id: string, value: string) => {
      updateNode(id, (node) => ({
        ...node,
        type: value,
      }));
    },
    [updateNode]
  );

  const handleNodeNotesChange = useCallback(
    (id: string, value: string) => {
      updateNode(id, (node) => ({
        ...node,
        meta: {
          ...node.meta,
          notes: value,
        },
      }));
    },
    [updateNode]
  );

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId]);

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

  if (loading) {
    return (
      <div className="workspace workspace--centered">
        <div className="workspace__loader">
          <span className="workspace__loader-dot" />
          <span className="workspace__loader-text">Loading workspace…</span>
        </div>
      </div>
    );
  }

  if (error || !workspaceDoc) {
    return (
      <div className="workspace workspace--centered">
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
    <div className="workspace">
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
            className="workspace__button workspace__button--primary"
            onClick={handleSaveNow}
            disabled={savingState === "saving"}
          >
            <FiSave size={16} />
            Save now
          </button>
        </div>
      </header>

      <div className="workspace__body">
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

        <section
          ref={canvasRef}
          className="workspace__canvas"
          onPointerDown={handleCanvasPointerDown}
          onWheel={handleWheel}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="workspace__canvas-surface"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {nodes.length === 0 && (
              <div className="workspace__canvas-empty">
                Drag in blocks from the left panel or click to add them here.
              </div>
            )}
            {nodes.map((node) => {
              const color = nodeTypeColors[node.type] ?? nodeTypeColors.default;
              const Icon = paletteGroups
                .flatMap((group) => group.items)
                .find((item) => item.type === node.type)?.icon;
              return (
                <div
                  key={node.id}
                  className={`workspace__node ${
                    selectedNodeId === node.id ? "is-selected" : ""
                  }`}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    borderColor: color,
                  }}
                  onPointerDown={(event) => handleNodePointerDown(event, node)}
                >
                  <span className="workspace__node-icon" style={{ color }}>
                    {Icon ? <Icon size={18} /> : <FiCommand size={18} />}
                  </span>
                  <div className="workspace__node-body">
                    <strong>{node.label}</strong>
                    <span>{node.type}</span>
                  </div>
                  <div className="workspace__node-handles">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="workspace__panel workspace__panel--right">
          <h3 className="workspace__panel-title">Inspector</h3>
          <div className="workspace__panel-body">
            {selectedNode ? (
              <>
                <label>
                  Node label
                  <input
                    value={selectedNode.label}
                    onChange={(event) =>
                      handleNodeLabelChange(selectedNode.id, event.target.value)
                    }
                  />
                </label>

                <label>
                  Node type
                  <select
                    value={selectedNode.type}
                    onChange={(event) =>
                      handleNodeTypeChange(selectedNode.id, event.target.value)
                    }
                  >
                    {Object.keys(nodeTypeColors).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Notes
                  <textarea
                    value={(selectedNode.meta as any)?.notes ?? ""}
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

      <div className="workspace__zoom-overlay">
        <div className="workspace__zoom">
          <button
            type="button"
            className="workspace__zoom-btn"
            onClick={() => handleZoomButton("out")}
          >
            −
          </button>
          <input
            type="range"
            min="50"
            max="200"
            step="5"
            value={Math.round(zoom * 100)}
            onChange={(event) => updateZoom(Number(event.target.value) / 100)}
          />
          <button
            type="button"
            className="workspace__zoom-btn"
            onClick={() => handleZoomButton("in")}
          >
            +
          </button>
          <span className="workspace__zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="workspace__zoom-reset"
            onClick={() => handleZoomButton("reset")}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspacePage;
