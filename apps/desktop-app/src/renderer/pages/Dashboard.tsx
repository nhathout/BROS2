import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiHome,
  FiClock,
  FiTrash2,
  FiPlus,
  FiSearch,
  FiFolder,
  FiList,
  FiGrid,
  FiChevronDown,
  FiLogOut,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { WorkspaceDocument, WorkspaceNode, WorkspaceSummary } from "../../shared/workspace";
import "../styles/Dashboard.css";

type WorkspaceCard = {
  workspaceId: string;
  name: string;
  description: string;
  updatedAt: string;
  updatedAtISO: string;
  owner: string;
  badge: "doc" | "sheet" | "slide" | "pdf" | "image";
  color: string;
  isRecent?: boolean;
  isTrashed?: boolean;
};

type FolderRecord = {
  id: string;
  name: string;
  location: string;
  color: string;
  isTrashed?: boolean;
};

const tabs = [
  { id: "home", label: "Home", icon: FiHome },
  { id: "recent", label: "Recent", icon: FiClock },
  { id: "trash", label: "Trash", icon: FiTrash2 },
] as const;

const folderData: FolderRecord[] = [
  { id: "f-1", name: "BROS2 Roadmap", location: "In My Drive", color: "#5b7fff" },
  { id: "f-2", name: "Launch Assets", location: "Shared with me", color: "#f4b400" },
  { id: "f-3", name: "Sprint Docs", location: "In My Drive", color: "#0f9d58" },
  { id: "f-4", name: "Archived Concepts", location: "In My Drive", color: "#ab47bc", isTrashed: true },
];

const badgeLabel: Record<WorkspaceCard["badge"], string> = {
  doc: "Doc",
  sheet: "Sheet",
  slide: "Slide",
  pdf: "PDF",
  image: "Image",
};

const colorPalette = ["#5b7fff", "#34a853", "#fbbc04", "#ea4335", "#8e24aa", "#00bcd4", "#f97316"];
const badgeCycle: WorkspaceCard["badge"][] = ["doc", "sheet", "slide", "pdf", "image"];

const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const pickColor = (id: string) => colorPalette[Math.abs(hashString(id)) % colorPalette.length];
const pickBadge = (id: string) => badgeCycle[Math.abs(hashString(id)) % badgeCycle.length];

const formatUpdatedLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Edited · recently";
  return `Edited · ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
};

const computeIsRecent = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const diff = Date.now() - date.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return diff <= sevenDays;
};

const randomNodeId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);

const makeNode = (
  type: string,
  label: string,
  position: { x: number; y: number },
  meta?: WorkspaceNode["meta"]
): WorkspaceNode => ({
  id: randomNodeId(),
  type,
  label,
  position,
  meta,
});

const workspaceSeedTemplates: Array<{
  name: string;
  meta: WorkspaceDocument["meta"];
  createNodes: () => WorkspaceDocument["nodes"];
}> = [
  {
    name: "Autonomy Sandbox",
    meta: {
      description: "Sensors → decisions → motion. Perfect starting point for robotics flows.",
      tags: ["sample", "autonomy"],
    },
    createNodes: () => [
      makeNode("entry", "Start", { x: 96, y: 80 }),
      makeNode("sensor", "Read Sensors", { x: 260, y: 180 }),
      makeNode("logic", "Decision Engine", { x: 460, y: 120 }),
      makeNode("actuator", "Motor Control", { x: 640, y: 220 }),
    ],
  },
  {
    name: "Perception Pipeline",
    meta: {
      description: "Camera stream with preprocessing, detection, and overlay output.",
      tags: ["sample", "perception"],
    },
    createNodes: () => [
      makeNode("input", "Camera Feed", { x: 120, y: 140 }),
      makeNode("transform", "Preprocess", { x: 320, y: 80 }),
      makeNode("model", "Object Detector", { x: 520, y: 140 }),
      makeNode("visualize", "HUD Overlay", { x: 700, y: 220 }),
    ],
  },
  {
    name: "Mission Planner",
    meta: {
      description: "Waypoint planner combining mapping, costmaps, and navigation goals.",
      tags: ["sample", "planning"],
    },
    createNodes: () => [
      makeNode("map", "Map Loader", { x: 140, y: 100 }),
      makeNode("costmap", "Costmap Builder", { x: 340, y: 200 }),
      makeNode("planner", "Route Planner", { x: 540, y: 120 }),
      makeNode("goal", "Dispatch Goals", { x: 720, y: 240 }),
    ],
  },
];

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const seedWorkspaces = useCallback(async () => {
    if (!window.workspace) {
      setWorkspaceError(
        "Workspace storage bridge is unavailable. Try restarting the desktop app to reload the preload script."
      );
      return;
    }

    try {
      for (const template of workspaceSeedTemplates) {
        await window.workspace.create({
          name: template.name,
          template: {
            nodes: template.createNodes(),
            meta: template.meta,
          },
          meta: template.meta,
        });
      }
    } catch (err) {
      console.error("[dashboard] failed to seed workspaces", err);
      setWorkspaceError("We couldn't create sample workspaces. Try again or check disk permissions.");
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    setWorkspaceError(null);

    if (!window.workspace) {
      setLoadingWorkspaces(false);
      setWorkspaceError(
        "Workspace storage bridge is unavailable. Please restart the app so the preload scripts reload."
      );
      return;
    }

    try {
      let list = await window.workspace.list();
      if (!list.length) {
        await seedWorkspaces();
        list = window.workspace ? await window.workspace.list() : [];
      }
      setWorkspaces(list);
    } catch (err) {
      console.error("[dashboard] failed to load workspaces", err);
      setWorkspaceError(
        "Unable to load your workspaces. We tried falling back to a local app data folder—please relaunch or check disk permissions if this continues."
      );
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [seedWorkspaces]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const workspaceCards = useMemo<WorkspaceCard[]>(() => {
    return workspaces.map((workspace) => {
      const color = pickColor(workspace.id);
      const badge = pickBadge(workspace.id);
      return {
        workspaceId: workspace.id,
        name: workspace.name,
        description:
          workspace.meta?.description ??
          "Locally stored workspace in your BROS2 directory.",
        updatedAt: formatUpdatedLabel(workspace.updatedAt),
        updatedAtISO: workspace.updatedAt,
        owner: "You",
        badge,
        color,
        isRecent: computeIsRecent(workspace.updatedAt),
        isTrashed: workspace.meta?.tags?.includes("trash") ?? false,
      };
    });
  }, [workspaces]);

  const visibleFolders = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return folderData.filter((folder) => {
      if (activeTab === "trash" && !folder.isTrashed) return false;
      if (activeTab !== "trash" && folder.isTrashed) return false;

      return folder.name.toLowerCase().includes(query);
    });
  }, [activeTab, searchQuery]);

  const visibleFiles = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return workspaceCards.filter((file) => {
      if (activeTab === "trash" && !file.isTrashed) return false;
      if (activeTab === "recent" && !file.isRecent) return false;
      if (activeTab === "home" && file.isTrashed) return false;

      return (
        file.name.toLowerCase().includes(query) ||
        file.description.toLowerCase().includes(query)
      );
    });
  }, [workspaceCards, activeTab, searchQuery]);

  const emptyStateMessage =
    activeTab === "trash"
      ? "Your trash is empty."
      : "No workspaces yet. Create a new one to get started.";

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAccountMenuOpen]);

  const handleCreateWorkspace = useCallback(async () => {
    if (!window.workspace) {
      setWorkspaceError(
        "Workspace bridge not ready yet. Try quitting and reopening the desktop app."
      );
      return;
    }

    try {
      const created = await window.workspace.create({
        name: `Workspace ${workspaces.length + 1}`,
      });
      await refreshWorkspaces();
      navigate(`/workspace/${created.id}`);
    } catch (err) {
      console.error("[dashboard] create workspace failed", err);
      setWorkspaceError(
        "Unable to create a workspace. Please confirm the app has access to your Documents folder or try again after relaunching."
      );
    }
  }, [navigate, refreshWorkspaces, workspaces.length]);

  const handleOpenWorkspace = useCallback(
    (workspaceId: string) => {
      navigate(`/workspace/${workspaceId}`);
    },
    [navigate]
  );

  const handleSignOut = () => {
    setIsAccountMenuOpen(false);
    navigate("/");
  };

  return (
    <div className="drive-dashboard">
      <aside className="drive-dashboard__sidebar">
        <div className="drive-dashboard__logo">
          <span className="logo-text">BROS2</span>
        </div>

        <button className="drive-dashboard__new-button" onClick={handleCreateWorkspace}>
          <FiPlus size={18} />
          New
        </button>

        <nav className="drive-dashboard__nav">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`drive-dashboard__nav-item ${
                activeTab === id ? "is-active" : ""
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="drive-dashboard__quota">
          <div className="drive-dashboard__quota-header">
            <span>Storage</span>
            <span>9.8 GB of 200 GB</span>
          </div>
          <div className="drive-dashboard__quota-bar">
            <span style={{ width: "32%" }} />
          </div>
        </div>
      </aside>

      <main className="drive-dashboard__content">
        <header className="drive-dashboard__header">
          <div>
            <h1>Welcome back</h1>
            <p className="drive-dashboard__subtitle">
              Organize, collaborate, and ship robotic workflows faster.
            </p>
          </div>
          <div className="drive-dashboard__header-actions">
            <div className="drive-dashboard__view-toggle" role="group">
              <button
                type="button"
                className={viewMode === "grid" ? "is-selected" : ""}
                onClick={() => setViewMode("grid")}
              >
                <FiGrid size={18} />
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "is-selected" : ""}
                onClick={() => setViewMode("list")}
              >
                <FiList size={18} />
              </button>
            </div>

            <div className="drive-dashboard__account" ref={accountRef}>
              <button
                type="button"
                className="drive-dashboard__account-button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              >
                <span className="drive-dashboard__avatar">TT</span>
                <span className="drive-dashboard__account-label">
                  <span className="drive-dashboard__account-name">
                    Trieu Tran
                  </span>
                  <span className="drive-dashboard__account-role">
                    Admin
                  </span>
                </span>
                <FiChevronDown size={16} />
              </button>

              {isAccountMenuOpen && (
                <div className="drive-dashboard__account-menu">
                  <button
                    type="button"
                    className="drive-dashboard__account-menu-item"
                    onClick={handleSignOut}
                  >
                    <FiLogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="drive-dashboard__search">
          <FiSearch size={18} />
          <input
            type="search"
            value={searchQuery}
            placeholder="Search Drive"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <div className="drive-dashboard__search-filters">
            <button type="button">Type</button>
            <button type="button">People</button>
            <button type="button">Modified</button>
            <button type="button">Location</button>
          </div>
        </div>

        {activeTab !== "trash" && visibleFolders.length > 0 && (
          <section className="drive-dashboard__section">
            <div className="drive-dashboard__section-header">
              <h2>Suggested folders</h2>
            </div>

            <div className="drive-dashboard__folder-grid">
              {visibleFolders.map((folder) => (
                <article key={folder.id} className="drive-dashboard__folder-card">
                  <div
                    className="drive-dashboard__folder-icon"
                    style={{ backgroundColor: folder.color }}
                  >
                    <FiFolder size={18} />
                  </div>
                  <div>
                    <h3>{folder.name}</h3>
                    <span>{folder.location}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="drive-dashboard__section">
          <div className="drive-dashboard__section-header">
            <h2>
              {activeTab === "trash"
                ? "Recently removed"
                : activeTab === "recent"
                ? "Recent workspaces"
                : "Your workspaces"}
            </h2>
            {loadingWorkspaces && (
              <span className="drive-dashboard__status">Loading…</span>
            )}
          </div>

          {workspaceError && (
            <div className="drive-dashboard__error">{workspaceError}</div>
          )}

          {loadingWorkspaces ? (
            <div className="drive-dashboard__empty">
              <p>Loading your workspaces…</p>
              <span>Hang tight while we scan your local workspace folder.</span>
            </div>
          ) : visibleFiles.length === 0 ? (
            <div className="drive-dashboard__empty">
              <p>{emptyStateMessage}</p>
              <span>Try adjusting your search or upload new content.</span>
            </div>
          ) : viewMode === "grid" ? (
            <div className="drive-dashboard__file-grid">
              {visibleFiles.map((file) => (
                <article
                  key={file.workspaceId}
                  className="drive-dashboard__file-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenWorkspace(file.workspaceId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenWorkspace(file.workspaceId);
                    }
                  }}
                >
                  <div
                    className="drive-dashboard__file-badge"
                    style={{ backgroundColor: file.color }}
                  >
                    {badgeLabel[file.badge]}
                  </div>
                  <h3>{file.name}</h3>
                  <p>{file.description}</p>
                  <div className="drive-dashboard__file-meta">
                    <span>{file.owner}</span>
                    <span>{file.updatedAt}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <table className="drive-dashboard__file-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {visibleFiles.map((file) => (
                  <tr
                    key={file.workspaceId}
                    onClick={() => handleOpenWorkspace(file.workspaceId)}
                    className="drive-dashboard__row-button"
                  >
                    <td>
                      <span
                        className="drive-dashboard__file-table-badge"
                        style={{ backgroundColor: file.color }}
                      >
                        {badgeLabel[file.badge]}
                      </span>
                      {file.name}
                    </td>
                    <td>{file.owner}</td>
                    <td>{file.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
