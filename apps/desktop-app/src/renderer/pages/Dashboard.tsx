import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  FiSettings,
  FiMenu,
  FiChevronLeft,
  FiSun,
  FiMoon,
  FiCheck,
  FiFileText,
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
  meta?: WorkspaceDocument["meta"];
};

type StorageEntry = {
  id: string;
  name: string;
  path: string;
  bytes: number;
  folder?: string;
};

const tabs = [
  { id: "home", label: "Home", icon: FiHome },
  { id: "recent", label: "Recent", icon: FiClock },
  { id: "trash", label: "Trash", icon: FiTrash2 },
] as const;

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
    name: "Turtlesim Teleop",
    meta: {
      description: "Arrow keys -> /turtle1/cmd_vel via rosbridge (start rosbridge + turtlesim in the runner).",
      tags: ["sample", "ros", "turtlesim"],
    },
    createNodes: () => [
      makeNode("ArrowKeyPub", "Arrow Key Publisher", { x: 260, y: 120 }, { topic: "keys/arrows" }),
      makeNode(
        "TurtleSimSub",
        "Turtlesim Sub",
        { x: 560, y: 120 },
        {
          inputTopic: "keys/arrows",
          cmdVelTopic: "/turtle1/cmd_vel",
          linearSpeed: 1.5,
          angularSpeed: 3,
          stopAfterMs: 160,
        }
      ),
      makeNode("ConsoleSub", "Console Subscriber", { x: 860, y: 120 }, { topic: "keys/arrows" }),
    ],
  },
];

const Dashboard: React.FC = () => {
  const getStoredTheme = () => {
    if (typeof window === "undefined") return "dark" as const;
    const stored = window.localStorage?.getItem("bros2-theme");
    return stored === "light" ? "light" : "dark";
  };

  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [folders, setFolders] = useState<Array<{ name: string; path: string }>>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);
  const [typeFilter, setTypeFilter] = useState<{ folders: boolean; workspaces: boolean }>({
    folders: true,
    workspaces: true,
  });
  const [locationFilter, setLocationFilter] = useState<"home" | "trash">("home");
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    workspaceId: string | null;
  }>({ visible: false, x: 0, y: 0, workspaceId: null });
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceDocument | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [storageEntries, setStorageEntries] = useState<StorageEntry[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  const [isCreateFolderClosing, setIsCreateFolderClosing] = useState(false);
  const [isStorageClosing, setIsStorageClosing] = useState(false);
  const newActionRef = useRef<HTMLButtonElement | null>(null);
  const newActionMenuRef = useRef<HTMLDivElement | null>(null);
  const typeFilterRef = useRef<HTMLButtonElement | null>(null);
  const typeFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const locationFilterRef = useRef<HTMLButtonElement | null>(null);
  const locationFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const folderActionRef = useRef<HTMLButtonElement | null>(null);
  const folderActionMenuRef = useRef<HTMLDivElement | null>(null);
  const [folderActionMenu, setFolderActionMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [folderContextMenu, setFolderContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    name: string | null;
    path: string | null;
    fullPath: string | null;
  }>({ visible: false, x: 0, y: 0, name: null, path: null, fullPath: null });
  const folderContextRef = useRef<HTMLDivElement | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<{
    name: string;
    path: string;
    fullPath: string | null;
    childFolders: number;
    childWorkspaces: number;
  } | null>(null);
  const [newActionMenu, setNewActionMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [typeFilterMenu, setTypeFilterMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [locationFilterMenu, setLocationFilterMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [createFolderMode, setCreateFolderMode] = useState<"create" | "rename">("create");
  const [renameFolderTarget, setRenameFolderTarget] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const accountRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const createFolderCloseRef = useRef<NodeJS.Timeout | null>(null);
  const storageCloseRef = useRef<NodeJS.Timeout | null>(null);

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
      if (window.folder) {
        const folderList = await window.folder.list();
        setFolders(folderList);
      }

      // Estimate storage by loading each workspace and summing serialized bytes.
      const used = await (async () => {
        try {
          const encoder = new TextEncoder();
          const docs = await Promise.all(list.map((ws) => window.workspace!.load(ws.id)));
          return docs.reduce((sum, doc) => sum + encoder.encode(JSON.stringify(doc)).length, 0);
        } catch (err) {
          console.warn("[dashboard] failed to calculate storage", err);
          return 0;
        }
      })();
      setStorageUsedBytes(used);
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
        meta: workspace.meta,
      };
    });
  }, [workspaces]);

  const visibleFolders = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (activeTab === "trash") return [];
    const parentOf = (p: string) => {
      const parts = p.split("/").filter(Boolean);
      parts.pop();
      return parts.join("/");
    };
    if (!typeFilter.folders) return [];
    return folders.filter((folder) => {
      const folderParent = parentOf(folder.path);
      return folderParent === (currentFolder || "") && folder.name.toLowerCase().includes(query);
    });
  }, [activeTab, currentFolder, folders, searchQuery, typeFilter.folders]);

  const visibleFiles = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const folderFilter = currentFolder || "";
    if (!typeFilter.workspaces) return [];
    return workspaceCards.filter((file) => {
      if (activeTab === "trash" && !file.isTrashed) return false;
      if (activeTab === "recent" && !file.isRecent) return false;
      if (activeTab === "home" && file.isTrashed) return false;
      if (activeTab !== "trash") {
        const fileFolder = file.meta?.folder ?? "";
        if (fileFolder !== folderFilter) return false;
      }

      return (
        file.name.toLowerCase().includes(query) ||
        file.description.toLowerCase().includes(query)
      );
    });
  }, [workspaceCards, activeTab, searchQuery, currentFolder, typeFilter.workspaces]);

  const emptyStateMessage =
    activeTab === "trash"
      ? "Your trash is empty."
      : "No workspaces yet. Create a new one to get started.";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage?.setItem("bros2-theme", theme);
    document.body.classList.toggle("theme-light", theme === "light");
  }, [theme]);

  useEffect(() => {
    if (!typeFilterMenu.visible) return;
    const hide = (event: MouseEvent) => {
      const target = event.target as Node;
      if (typeFilterMenuRef.current?.contains(target)) return;
      if (typeFilterRef.current?.contains(target)) return;
      setTypeFilterMenu({ visible: false, x: 0, y: 0 });
    };
    const hideEsc = (e: KeyboardEvent) => e.key === "Escape" && setTypeFilterMenu({ visible: false, x: 0, y: 0 });
    document.addEventListener("mousedown", hide);
    document.addEventListener("keydown", hideEsc);
    return () => {
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("keydown", hideEsc);
    };
  }, [typeFilterMenu.visible]);

  useEffect(() => {
    if (!locationFilterMenu.visible) return;
    const hide = (event: MouseEvent) => {
      const target = event.target as Node;
      if (locationFilterMenuRef.current?.contains(target)) return;
      if (locationFilterRef.current?.contains(target)) return;
      setLocationFilterMenu({ visible: false, x: 0, y: 0 });
    };
    const hideEsc = (e: KeyboardEvent) => e.key === "Escape" && setLocationFilterMenu({ visible: false, x: 0, y: 0 });
    document.addEventListener("mousedown", hide);
    document.addEventListener("keydown", hideEsc);
    return () => {
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("keydown", hideEsc);
    };
  }, [locationFilterMenu.visible]);

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

  const handleCreateFolder = useCallback(async () => {
    if (!window.folder) {
      setWorkspaceError("Folder bridge unavailable. Restart the app to reload preload scripts.");
      return;
    }
    const name = createFolderName.trim();
    if (!name) {
      setWorkspaceError("Folder name is required.");
      return;
    }
    try {
      if (createFolderMode === "rename" && renameFolderTarget) {
        await window.folder.rename({ oldPath: renameFolderTarget, newName: name });
      } else {
        const created = await window.folder.create(name, currentFolder || null);
        setCurrentFolder(created.path ?? currentFolder);
      }
      const folderList = await window.folder.list();
      setFolders(folderList);
      setCreateFolderName("");
      setIsCreateFolderOpen(false);
      setIsCreateFolderClosing(false);
      setCreateFolderMode("create");
      setRenameFolderTarget(null);
    } catch (err) {
      console.error("[dashboard] create folder failed", err);
      setWorkspaceError("Unable to create folder. Check filesystem permissions.");
    }
  }, [createFolderMode, createFolderName, currentFolder, renameFolderTarget]);

  const closeCreateFolderModal = useCallback(() => {
    if (isCreateFolderClosing) return;
    setIsCreateFolderClosing(true);
    createFolderCloseRef.current = setTimeout(() => {
      setIsCreateFolderOpen(false);
      setIsCreateFolderClosing(false);
      setCreateFolderMode("create");
      setRenameFolderTarget(null);
    }, 180);
  }, [isCreateFolderClosing]);

  const closeStorageModal = useCallback(() => {
    if (isStorageClosing) return;
    setIsStorageClosing(true);
    storageCloseRef.current = setTimeout(() => {
      setIsStorageModalOpen(false);
      setIsStorageClosing(false);
    }, 180);
  }, [isStorageClosing]);

  const handleCreateWorkspace = useCallback(async (folderPath?: string) => {
    if (!window.workspace) {
      setWorkspaceError(
        "Workspace bridge not ready yet. Try quitting and reopening the desktop app."
      );
      return;
    }

    try {
      const created = await window.workspace.create({
        name: `Workspace ${workspaces.length + 1}`,
        meta: folderPath || currentFolder ? { folder: folderPath ?? currentFolder } : undefined,
      });
      await refreshWorkspaces();
      navigate(`/workspace/${created.id}`);
    } catch (err) {
      console.error("[dashboard] create workspace failed", err);
      setWorkspaceError(
        "Unable to create a workspace. Please confirm the app has access to your Documents folder or try again after relaunching."
      );
    }
  }, [currentFolder, navigate, refreshWorkspaces, workspaces.length]);

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

  const refreshStorageEntries = useCallback(async () => {
    try {
      if (!window.workspace || typeof window.workspace.storageList !== "function") {
        console.warn("[dashboard] storageList bridge is unavailable; reload app to refresh preload scripts.");
        setStorageEntries([]);
        return;
      }
      const entries = await window.workspace.storageList();
      setStorageEntries(entries);
    } catch (err) {
      console.error("[dashboard] storage list failed", err);
    }
  }, []);

  const closeContextMenu = () =>
    setContextMenu({ visible: false, x: 0, y: 0, workspaceId: null });

  const handleTrashFolder = useCallback(
    async (targetPath: string, folderPath: string) => {
      try {
        await window.folder?.trash(targetPath);
        const folderList = await window.folder?.list();
        setFolders(folderList ?? []);
        if (folderPath === currentFolder || currentFolder.startsWith(`${folderPath}/`)) {
          setCurrentFolder("");
        }
        await refreshWorkspaces();
        await refreshStorageEntries();
      } catch (err) {
        console.error("[dashboard] trash folder failed", err);
        setWorkspaceError("Unable to delete folder. Check permissions or try again.");
      } finally {
        setFolderContextMenu({
          visible: false,
          x: 0,
          y: 0,
          name: null,
          path: null,
          fullPath: null,
        });
        setPendingFolderDelete(null);
      }
    },
    [currentFolder, refreshStorageEntries, refreshWorkspaces]
  );

  useEffect(() => {
    if (!contextMenu.visible) return;
    const hideOnClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // only left click closes
      const target = e.target as Node;
      if (contextMenuRef.current && contextMenuRef.current.contains(target)) return;
      closeContextMenu();
    };
    const hideEsc = (e: KeyboardEvent) => e.key === "Escape" && closeContextMenu();
    document.addEventListener("mousedown", hideOnClick);
    document.addEventListener("keydown", hideEsc);
    return () => {
      document.removeEventListener("mousedown", hideOnClick);
      document.removeEventListener("keydown", hideEsc);
    };
  }, [contextMenu.visible]);

  useEffect(() => {
    if (!folderContextMenu.visible) return;
    const hideOnClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Node;
      if (folderContextRef.current && folderContextRef.current.contains(target)) return;
      setFolderContextMenu({ visible: false, x: 0, y: 0, name: null, path: null, fullPath: null });
    };
    const hideEsc = (e: KeyboardEvent) =>
      e.key === "Escape" &&
      setFolderContextMenu({ visible: false, x: 0, y: 0, name: null, path: null, fullPath: null });
    document.addEventListener("mousedown", hideOnClick);
    document.addEventListener("keydown", hideEsc);
    return () => {
      document.removeEventListener("mousedown", hideOnClick);
      document.removeEventListener("keydown", hideEsc);
    };
  }, [folderContextMenu.visible]);

  useEffect(() => {
    if (!newActionMenu.visible) return;
    const hide = (event: MouseEvent) => {
      const target = event.target as Node;
      if (newActionMenuRef.current?.contains(target)) return;
      if (newActionRef.current?.contains(target)) return;
      setNewActionMenu({ visible: false, x: 0, y: 0 });
    };
    const hideEsc = (e: KeyboardEvent) => e.key === "Escape" && setNewActionMenu({ visible: false, x: 0, y: 0 });
    document.addEventListener("mousedown", hide);
    document.addEventListener("keydown", hideEsc);
    return () => {
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("keydown", hideEsc);
    };
  }, [newActionMenu.visible]);

  useEffect(() => {
    if (activeTab === "trash" && locationFilter !== "trash") {
      setLocationFilter("trash");
    } else if (activeTab !== "trash" && locationFilter !== "home") {
      setLocationFilter("home");
    }
  }, [activeTab, locationFilter]);

  useEffect(() => {
    if (!folderActionMenu.visible) return;
    const hide = (event: MouseEvent) => {
      const target = event.target as Node;
      if (folderActionMenuRef.current?.contains(target)) return;
      if (folderActionRef.current?.contains(target)) return;
      setFolderActionMenu({ visible: false, x: 0, y: 0 });
    };
    const hideEsc = (e: KeyboardEvent) => e.key === "Escape" && setFolderActionMenu({ visible: false, x: 0, y: 0 });
    document.addEventListener("mousedown", hide);
    document.addEventListener("keydown", hideEsc);
    return () => {
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("keydown", hideEsc);
    };
  }, [folderActionMenu.visible]);

  useEffect(() => {
    if (isStorageModalOpen) {
      void refreshStorageEntries();
    }
  }, [isStorageModalOpen, refreshStorageEntries]);

  useEffect(() => {
    return () => {
      if (createFolderCloseRef.current) clearTimeout(createFolderCloseRef.current);
      if (storageCloseRef.current) clearTimeout(storageCloseRef.current);
    };
  }, []);

  const handleOpenContextMenu = useCallback(
    (event: React.MouseEvent, workspaceId: string) => {
      event.preventDefault();
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        workspaceId,
      });
    },
    []
  );

  const handleLoadWorkspaceDoc = useCallback(async (workspaceId: string) => {
    const doc = await window.workspace.load(workspaceId);
    return doc;
  }, []);

  const handleEditWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const doc = await handleLoadWorkspaceDoc(workspaceId);
        setEditingWorkspace(doc);
        setEditName(doc.name);
        setEditDescription(doc.meta?.description ?? "");
        setEditType((doc.meta as any)?.type ?? "");
        setIsEditModalOpen(true);
      } catch (err) {
        console.error("[dashboard] edit load failed", err);
        setWorkspaceError("Unable to open workspace for editing.");
      } finally {
        closeContextMenu();
      }
    },
    [handleLoadWorkspaceDoc]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingWorkspace) return;
    try {
      const payload: WorkspaceDocument = {
        ...editingWorkspace,
        name: editName.trim() || "Untitled Workspace",
        meta: {
          ...(editingWorkspace.meta ?? {}),
          description: editDescription,
          type: editType || undefined,
        },
      };
      await window.workspace.save(editingWorkspace.id, payload);
      await refreshWorkspaces();
    } catch (err) {
      console.error("[dashboard] edit save failed", err);
      setWorkspaceError("Unable to save changes. Check disk permissions.");
    } finally {
      setIsEditModalOpen(false);
      setEditingWorkspace(null);
    }
  }, [editDescription, editName, editType, editingWorkspace, refreshWorkspaces]);

  const handleDuplicateWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const doc = await handleLoadWorkspaceDoc(workspaceId);
      const dupName = `${doc.name} copy`;
      await window.workspace.create({
        name: dupName,
        template: doc,
        meta: doc.meta,
      });
      await refreshWorkspaces();
      await refreshStorageEntries();
      } catch (err) {
        console.error("[dashboard] duplicate failed", err);
        setWorkspaceError("Unable to duplicate workspace.");
      } finally {
        closeContextMenu();
      }
    },
    [handleLoadWorkspaceDoc, refreshStorageEntries, refreshWorkspaces]
  );

  const handleTrashWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const doc = await handleLoadWorkspaceDoc(workspaceId);
        const tags = new Set([...(doc.meta?.tags ?? [])]);
        tags.add("trash");
        await window.workspace.save(workspaceId, {
          ...doc,
          meta: { ...(doc.meta ?? {}), tags: Array.from(tags) },
        });
        await refreshWorkspaces();
        await refreshStorageEntries();
      } catch (err) {
        console.error("[dashboard] trash failed", err);
        setWorkspaceError("Unable to move workspace to trash.");
      } finally {
        closeContextMenu();
      }
    },
    [handleLoadWorkspaceDoc, refreshStorageEntries, refreshWorkspaces]
  );

  const handleOpenInFolder = useCallback(
    async (workspaceId: string) => {
      try {
        if (!window.workspace || typeof window.workspace.load !== "function") return;
        const doc = await window.workspace.load(workspaceId);
        const storageItems = await window.workspace.storageList();
        const match = storageItems.find((item) => item.id === doc.id);
        if (match) {
          if (window.folder?.open) {
            const dir = (() => {
              const idx = Math.max(match.path.lastIndexOf("/"), match.path.lastIndexOf("\\"));
              return idx > 0 ? match.path.slice(0, idx) : match.path;
            })();
            await window.folder.open(dir);
          }
        }
      } catch (err) {
        console.error("[dashboard] open in folder failed", err);
      } finally {
        closeContextMenu();
      }
    },
    [closeContextMenu]
  );

  const handleRestoreWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const doc = await handleLoadWorkspaceDoc(workspaceId);
        const tags = new Set([...(doc.meta?.tags ?? [])]);
        tags.delete("trash");
        await window.workspace.save(workspaceId, {
          ...doc,
          meta: { ...(doc.meta ?? {}), tags: Array.from(tags) },
        });
        await refreshWorkspaces();
        await refreshStorageEntries();
      } catch (err) {
        console.error("[dashboard] restore failed", err);
        setWorkspaceError("Unable to restore workspace.");
      } finally {
        closeContextMenu();
      }
    },
    [handleLoadWorkspaceDoc, refreshStorageEntries, refreshWorkspaces]
  );

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    const digits = value < 10 && unitIndex > 0 ? 1 : 0;
    return `${value.toFixed(digits)} ${units[unitIndex]}`;
  };

  const quotaLabel = `${formatBytes(storageUsedBytes)}`;

  return (
    <div
      className={`drive-dashboard ${isSidebarCollapsed ? "is-collapsed" : ""} ${
        theme === "light" ? "theme-light" : ""
      }`}
    >
      <aside className={`drive-dashboard__sidebar ${isSidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="drive-dashboard__logo">
          {!isSidebarCollapsed && <span className="logo-text">BROS2</span>}
          <button
            type="button"
            className="drive-dashboard__collapse"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <FiMenu size={18} /> : <FiChevronLeft size={18} />}
          </button>
        </div>

        <button
          className="drive-dashboard__new-button"
          ref={newActionRef}
          onClick={() => {
            if (newActionMenu.visible) {
              setNewActionMenu({ visible: false, x: 0, y: 0 });
              return;
            }
            const rect = newActionRef.current?.getBoundingClientRect();
            setNewActionMenu({
              visible: true,
              x: rect ? rect.left : 0,
              y: rect ? rect.bottom + 8 : 0,
            });
          }}
        >
          <FiPlus size={18} />
          {!isSidebarCollapsed && "New"}
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
              {!isSidebarCollapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {!isSidebarCollapsed && (
          <div className="drive-dashboard__quota">
            <div className="drive-dashboard__quota-header">
              <span>Storage used</span>
              <div className="drive-dashboard__quota-actions">
                <span>{quotaLabel}</span>
                <button
                type="button"
                className="drive-dashboard__quota-settings"
                onClick={() => setIsStorageModalOpen(true)}
                aria-label="Manage storage"
              >
                <FiSettings size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
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
            <button
              type="button"
              className={`drive-dashboard__theme-toggle ${theme === "light" ? "is-selected" : ""}`}
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? <FiMoon size={16} /> : <FiSun size={16} />}
            </button>

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

        {(isStorageModalOpen || isStorageClosing) && (
          <div
            className={`drive-dashboard__modal-backdrop drive-dashboard__modal-backdrop--animate ${
              isStorageClosing ? "drive-dashboard__modal-backdrop--closing" : ""
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Manage storage"
            onClick={closeStorageModal}
          >
            <div
              className={`drive-dashboard__modal drive-dashboard__modal--storage ${
                isStorageClosing ? "drive-dashboard__modal--closing" : "drive-dashboard__modal--animate"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="drive-dashboard__modal-header">
                <h3>Manage storage</h3>
                <button
                  type="button"
                  onClick={closeStorageModal}
                  aria-label="Close"
                >
                  ✕
                </button>
              </header>
              <div className="drive-dashboard__modal-body">
                <p>{quotaLabel} in use across your workspaces.</p>
                <div className="drive-dashboard__storage-list">
                  {storageEntries.length === 0 ? (
                    <div className="drive-dashboard__empty">
                      <p>No storage data yet.</p>
                      <span>Workspaces will appear here once created.</span>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Path</th>
                          <th>Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storageEntries.map((entry) => (
                          <tr
                            key={entry.id}
                            onContextMenu={(event) =>
                              handleOpenContextMenu(event, entry.id)
                            }
                          >
                            <td>{entry.name}</td>
                            <td className="muted">{entry.path}</td>
                            <td>{formatBytes(entry.bytes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <footer className="drive-dashboard__modal-footer">
                <button
                  type="button"
                  className="drive-dashboard__button-secondary"
                  onClick={closeStorageModal}
                >
                  Close
                </button>
              </footer>
            </div>
          </div>
        )}

        <div className="drive-dashboard__search">
          <FiSearch size={18} />
          <input
            type="search"
            value={searchQuery}
            placeholder="Search Drive"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <div className="drive-dashboard__search-filters">
            <button
              type="button"
              ref={typeFilterRef}
              className="drive-dashboard__filter-button"
              onClick={() => {
                if (typeFilterMenu.visible) {
                  setTypeFilterMenu({ visible: false, x: 0, y: 0 });
                  return;
                }
                const rect = typeFilterRef.current?.getBoundingClientRect();
                setTypeFilterMenu({
                  visible: true,
                  x: rect ? rect.left + rect.width / 2 : 0,
                  y: rect ? rect.bottom + 6 : 0,
                });
              }}
            >
              <span>Type</span>
              <FiChevronDown size={14} />
            </button>
            <button
              type="button"
              ref={locationFilterRef}
              className="drive-dashboard__filter-button"
              onClick={() => {
                if (locationFilterMenu.visible) {
                  setLocationFilterMenu({ visible: false, x: 0, y: 0 });
                  return;
                }
                const rect = locationFilterRef.current?.getBoundingClientRect();
                setLocationFilterMenu({
                  visible: true,
                  x: rect ? rect.left + rect.width / 2 : 0,
                  y: rect ? rect.bottom + 6 : 0,
                });
              }}
            >
              <span>Location</span>
              <FiChevronDown size={14} />
            </button>
          </div>
        </div>

        {activeTab !== "trash" && (
          <section className="drive-dashboard__section">
            <div className="drive-dashboard__section-header drive-dashboard__section-header--folders">
              <div className="drive-dashboard__folder-breadcrumb">
                {currentFolder ? (
                  <>
                    <button
                      type="button"
                      className="drive-dashboard__folder-back"
                      onClick={() => {
                        const parts = currentFolder.split("/").filter(Boolean);
                        parts.pop();
                        setCurrentFolder(parts.join("/"));
                      }}
                      aria-label="Go up one level"
                    >
                      ←
                    </button>
                    <span>{currentFolder}</span>
                  </>
                ) : (
                  <span>Folders</span>
                )}
              </div>
              <button
                type="button"
                className="drive-dashboard__folder-add"
                ref={folderActionRef}
                onClick={() => {
                  if (folderActionMenu.visible) {
                    setFolderActionMenu({ visible: false, x: 0, y: 0 });
                    return;
                  }
                  const rect = folderActionRef.current?.getBoundingClientRect();
                  setFolderActionMenu({
                    visible: true,
                    x: rect ? rect.left : 0,
                    y: rect ? rect.bottom + 8 : 0,
                  });
                }}
                aria-label="Create folder"
              >
                +
              </button>
            </div>

            {visibleFolders.length > 0 ? (
              <div className="drive-dashboard__folder-grid">
                {visibleFolders.map((folder) => (
          <article
            key={folder.path}
            className="drive-dashboard__folder-card"
            onClick={() => setCurrentFolder(folder.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              setFolderContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                name: folder.name,
                path: folder.path,
                fullPath: folder.fullPath,
              });
            }}
          >
                    <div className="drive-dashboard__folder-icon" style={{ backgroundColor: "#5b7fff" }}>
                      <FiFolder size={18} />
                    </div>
                    <div>
                      <h3>{folder.name}</h3>
                      <span>{folder.path}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
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
                  onContextMenu={(event) => handleOpenContextMenu(event, file.workspaceId)}
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
                    onContextMenu={(event) => handleOpenContextMenu(event, file.workspaceId)}
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

      {contextMenu.visible &&
        contextMenu.workspaceId &&
        createPortal(
          <div
            ref={contextMenuRef}
            className={`drive-dashboard__context-menu ${theme === "light" ? "theme-light" : ""}`}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button type="button" onClick={() => handleOpenWorkspace(contextMenu.workspaceId!)}>
              Open
            </button>
            <button type="button" onClick={() => handleOpenInFolder(contextMenu.workspaceId!)}>
              Open in folder
            </button>
            <button type="button" onClick={() => handleEditWorkspace(contextMenu.workspaceId!)}>
              Edit…
            </button>
            <button type="button" onClick={() => handleDuplicateWorkspace(contextMenu.workspaceId!)}>
              Duplicate
            </button>
            {activeTab === "trash" ? (
              <button type="button" onClick={() => handleRestoreWorkspace(contextMenu.workspaceId!)}>
                Restore
              </button>
            ) : (
              <button type="button" onClick={() => handleTrashWorkspace(contextMenu.workspaceId!)}>
                Move to trash
              </button>
            )}
          </div>,
          document.body
        )}

      {isEditModalOpen && (
        <div
          className="drive-dashboard__modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Edit workspace"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="drive-dashboard__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="drive-dashboard__modal-header">
              <h3>Edit workspace</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <div className="drive-dashboard__modal-body">
              <label>
                Name
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name this workspace"
                />
              </label>
              <label>
                Description
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="What is this workspace for?"
                />
              </label>
              <label>
                Type
                <input
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  placeholder="e.g., ROS, Simulation"
                />
              </label>
            </div>
            <footer className="drive-dashboard__modal-footer">
              <button
                type="button"
                className="drive-dashboard__button-secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="drive-dashboard__new-button"
                onClick={handleSaveEdit}
              >
                Save changes
              </button>
            </footer>
          </div>
        </div>
      )}

      {folderContextMenu.visible && folderContextMenu.path && (
        <div
          ref={folderContextRef}
          className={`drive-dashboard__context-menu ${theme === "light" ? "theme-light" : ""}`}
          style={{ top: folderContextMenu.y, left: folderContextMenu.x }}
        >
          <button
            type="button"
            onClick={() => {
              setCurrentFolder(folderContextMenu.path ?? "");
              setFolderContextMenu({
                visible: false,
                x: 0,
                y: 0,
                name: null,
                path: null,
                fullPath: null,
              });
            }}
          >
            Open
          </button>
          <button
            type="button"
            onClick={async () => {
              await handleCreateWorkspace(folderContextMenu.path ?? undefined);
              setFolderContextMenu({
                visible: false,
                x: 0,
                y: 0,
                name: null,
                path: null,
                fullPath: null,
              });
            }}
          >
            New workspace here
          </button>
          <button
            type="button"
          onClick={() => {
            setCreateFolderMode("rename");
            setRenameFolderTarget(folderContextMenu.fullPath ?? folderContextMenu.path);
            setCreateFolderName(folderContextMenu.name ?? "");
            setIsCreateFolderOpen(true);
            setFolderContextMenu({
              visible: false,
              x: 0,
              y: 0,
              name: null,
              path: null,
              fullPath: null,
            });
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (folderContextMenu.path) {
                const path = folderContextMenu.path;
                const fullPath = folderContextMenu.fullPath ?? folderContextMenu.path;
                const childFolders = folders.filter(
                  (f) => f.path !== path && f.path.startsWith(`${path}/`)
                ).length;
                const childWorkspaces = workspaceCards.filter((ws) => {
                  const folderMeta = ws.meta?.folder ?? "";
                  return folderMeta === path || folderMeta.startsWith(`${path}/`);
                }).length;
                setPendingFolderDelete({
                  name: folderContextMenu.name ?? path,
                  path,
                  fullPath,
                  childFolders,
                  childWorkspaces,
                });
              }
              setFolderContextMenu({
                visible: false,
                x: 0,
                y: 0,
                name: null,
                path: null,
                fullPath: null,
              });
            }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              const targetPath = folderContextMenu.fullPath ?? folderContextMenu.path;
              if (targetPath) {
                window.folder?.open(targetPath);
              }
              setFolderContextMenu({
                visible: false,
                x: 0,
                y: 0,
                name: null,
                path: null,
                fullPath: null,
              });
            }}
          >
            Open in folder
          </button>
        </div>
      )}

      {folderActionMenu.visible &&
        createPortal(
          <div
            ref={folderActionMenuRef}
            className={`drive-dashboard__context-menu ${theme === "light" ? "theme-light" : ""}`}
            style={{ top: folderActionMenu.y, left: folderActionMenu.x }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={() => {
                setCreateFolderMode("create");
                setRenameFolderTarget(null);
                setCreateFolderName("New folder");
                setIsCreateFolderOpen(true);
                setFolderActionMenu({ visible: false, x: 0, y: 0 });
              }}
            >
              New folder
            </button>
            <button
              type="button"
              onClick={async () => {
                setFolderActionMenu({ visible: false, x: 0, y: 0 });
                await handleCreateWorkspace(currentFolder || undefined);
              }}
            >
              New workspace
            </button>
          </div>,
          document.body
        )}

      {newActionMenu.visible &&
        createPortal(
          <div
            ref={newActionMenuRef}
            className={`drive-dashboard__context-menu ${theme === "light" ? "theme-light" : ""}`}
            style={{ top: newActionMenu.y, left: newActionMenu.x }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
                onClick={() => {
                  setCreateFolderMode("create");
                  setRenameFolderTarget(null);
                  setCreateFolderName("New folder");
                  setIsCreateFolderOpen(true);
                  setNewActionMenu({ visible: false, x: 0, y: 0 });
                }}
              >
                New folder
              </button>
              <button
                type="button"
                onClick={async () => {
                  setNewActionMenu({ visible: false, x: 0, y: 0 });
                  await handleCreateWorkspace(currentFolder || undefined);
                }}
              >
                New workspace
              </button>
          </div>,
          document.body
        )}

        {typeFilterMenu.visible &&
          createPortal(
            <div
              ref={typeFilterMenuRef}
              className={`drive-dashboard__dropdown-menu ${theme === "light" ? "theme-light" : ""}`}
              style={{ top: typeFilterMenu.y, left: typeFilterMenu.x, transform: "translateX(-50%)" }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                type="button"
                className="drive-dashboard__dropdown-item"
                onClick={() => {
                  setTypeFilter((prev) => ({ ...prev, folders: !prev.folders }));
                  setTypeFilterMenu({ visible: false, x: 0, y: 0 });
                }}
              >
                <FiFolder size={16} />
                <span>Folders</span>
                {typeFilter.folders && <FiCheck size={14} className="is-checked" />}
              </button>
              <button
                type="button"
                className="drive-dashboard__dropdown-item"
                onClick={() => {
                  setTypeFilter((prev) => ({ ...prev, workspaces: !prev.workspaces }));
                  setTypeFilterMenu({ visible: false, x: 0, y: 0 });
                }}
              >
                <FiFileText size={16} />
                <span>Workspaces</span>
                {typeFilter.workspaces && <FiCheck size={14} className="is-checked" />}
              </button>
            </div>,
            document.body
          )}

        {locationFilterMenu.visible &&
          createPortal(
            <div
              ref={locationFilterMenuRef}
              className={`drive-dashboard__dropdown-menu ${theme === "light" ? "theme-light" : ""}`}
              style={{ top: locationFilterMenu.y, left: locationFilterMenu.x, transform: "translateX(-50%)" }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                type="button"
                className="drive-dashboard__dropdown-item"
                onClick={() => {
                  setLocationFilter("home");
                  setActiveTab("home");
                  setLocationFilterMenu({ visible: false, x: 0, y: 0 });
                }}
              >
                <FiHome size={16} />
                <span>Home</span>
                {locationFilter === "home" && <FiCheck size={14} className="is-checked" />}
              </button>
              <button
                type="button"
                className="drive-dashboard__dropdown-item"
                onClick={() => {
                  setLocationFilter("trash");
                  setActiveTab("trash");
                  setLocationFilterMenu({ visible: false, x: 0, y: 0 });
                }}
              >
                <FiTrash2 size={16} />
                <span>Trash</span>
                {locationFilter === "trash" && <FiCheck size={14} className="is-checked" />}
              </button>
            </div>,
            document.body
          )}

        {pendingFolderDelete && (
          <div
            className="drive-dashboard__modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete folder"
            onClick={() => setPendingFolderDelete(null)}
          >
            <div
              className="drive-dashboard__modal drive-dashboard__modal--narrow"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="drive-dashboard__modal-header">
                <h3>Delete “{pendingFolderDelete.name}”?</h3>
                <button
                  type="button"
                  onClick={() => setPendingFolderDelete(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </header>
              <div className="drive-dashboard__modal-body">
                <p>
                  All contents inside this folder will be moved to Trash, including nested folders
                  and workspaces.
                </p>
                {(pendingFolderDelete.childFolders > 0 || pendingFolderDelete.childWorkspaces > 0) && (
                  <ul className="drive-dashboard__confirm-list">
                    {pendingFolderDelete.childFolders > 0 && (
                      <li>{pendingFolderDelete.childFolders} subfolder(s)</li>
                    )}
                    {pendingFolderDelete.childWorkspaces > 0 && (
                      <li>{pendingFolderDelete.childWorkspaces} workspace(s)</li>
                    )}
                  </ul>
                )}
              </div>
              <footer className="drive-dashboard__modal-footer">
                <button
                  type="button"
                  className="drive-dashboard__button-secondary"
                  onClick={() => setPendingFolderDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="drive-dashboard__new-button"
                  onClick={() => {
                    if (pendingFolderDelete?.fullPath) {
                      void handleTrashFolder(pendingFolderDelete.fullPath, pendingFolderDelete.path);
                    }
                  }}
                >
                  Move to Trash
                </button>
              </footer>
            </div>
          </div>
        )}

        {(isCreateFolderOpen || isCreateFolderClosing) && (
          <div
            className={`drive-dashboard__modal-backdrop drive-dashboard__modal-backdrop--animate ${
              isCreateFolderClosing ? "drive-dashboard__modal-backdrop--closing" : ""
            }`}
          role="dialog"
            aria-modal="true"
            aria-label="Create folder"
            onClick={closeCreateFolderModal}
          >
          <div
            className={`drive-dashboard__modal drive-dashboard__modal--narrow ${
              isCreateFolderClosing ? "drive-dashboard__modal--closing" : "drive-dashboard__modal--animate"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="drive-dashboard__modal-header">
              <h3>{createFolderMode === "rename" ? "Rename folder" : "Create folder"}</h3>
              <button
                type="button"
                onClick={closeCreateFolderModal}
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <div className="drive-dashboard__modal-body">
              <label>
                Folder name
                <input
                  value={createFolderName}
                  onChange={(e) => setCreateFolderName(e.target.value)}
                  placeholder="My projects"
                />
              </label>
            </div>
            <footer className="drive-dashboard__modal-footer">
              <button
                type="button"
                className="drive-dashboard__button-secondary"
                onClick={closeCreateFolderModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="drive-dashboard__new-button"
                onClick={handleCreateFolder}
              >
                Create
              </button>
            </footer>
          </div>
        </div>
      )}
  </div>
  );
};

export default Dashboard;
