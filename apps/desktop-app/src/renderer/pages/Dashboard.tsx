import React, { useEffect, useMemo, useRef, useState } from "react";
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
import "../styles/Dashboard.css";

type FileRecord = {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
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

const fileData: FileRecord[] = [
  {
    id: "doc-1",
    name: "Systems Design Doc",
    description: "Architecture proposal for BROS2 orchestrator.",
    updatedAt: "Edited · Oct 28, 2025",
    owner: "You",
    badge: "doc",
    color: "#5b7fff",
    isRecent: true,
  },
  {
    id: "sheet-1",
    name: "Robotics BOM",
    description: "Bill of material for current hardware kit.",
    updatedAt: "Opened · Oct 26, 2025",
    owner: "Jules",
    badge: "sheet",
    color: "#34a853",
    isRecent: true,
  },
  {
    id: "slide-1",
    name: "Investor Pitch Deck",
    description: "Latest deck with adoption metrics.",
    updatedAt: "Edited · Oct 19, 2025",
    owner: "Marie",
    badge: "slide",
    color: "#fbbc04",
  },
  {
    id: "pdf-1",
    name: "ROS2 Node Checklist",
    description: "Reference checklist before publishing packages.",
    updatedAt: "Opened · Sep 30, 2025",
    owner: "You",
    badge: "pdf",
    color: "#ea4335",
  },
  {
    id: "img-1",
    name: "Simulation Screenshot",
    description: "Gazebo capture from the latest run.",
    updatedAt: "Opened · Aug 12, 2025",
    owner: "Devon",
    badge: "image",
    color: "#8e24aa",
  },
  {
    id: "trash-1",
    name: "Deprecated Pipeline",
    description: "Old YAML manifest no longer needed.",
    updatedAt: "Trashed · Jul 07, 2025",
    owner: "You",
    badge: "doc",
    color: "#9e9e9e",
    isTrashed: true,
  },
];

const badgeLabel: Record<FileRecord["badge"], string> = {
  doc: "Doc",
  sheet: "Sheet",
  slide: "Slide",
  pdf: "PDF",
  image: "Image",
};

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

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

    return fileData.filter((file) => {
      if (activeTab === "trash" && !file.isTrashed) return false;
      if (activeTab === "recent" && !file.isRecent) return false;
      if (activeTab === "home" && file.isTrashed) return false;

      return (
        file.name.toLowerCase().includes(query) ||
        file.description.toLowerCase().includes(query)
      );
    });
  }, [activeTab, searchQuery]);

  const emptyStateMessage =
    activeTab === "trash"
      ? "Your trash is empty."
      : "Nothing to show here yet.";

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

        <button className="drive-dashboard__new-button">
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
                ? "Recent files"
                : "Suggested files"}
            </h2>
          </div>

          {visibleFiles.length === 0 ? (
            <div className="drive-dashboard__empty">
              <p>{emptyStateMessage}</p>
              <span>Try adjusting your search or upload new content.</span>
            </div>
          ) : viewMode === "grid" ? (
            <div className="drive-dashboard__file-grid">
              {visibleFiles.map((file) => (
                <article key={file.id} className="drive-dashboard__file-card">
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
                  <tr key={file.id}>
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
