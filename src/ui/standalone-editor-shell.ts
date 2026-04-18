import type { EditorToolId } from "./editor-hub-ui";
import type { RecentProjectEntry } from "../systems/recent-projects-system";

// ── Tool catalogue ────────────────────────────────────────────────────────────

interface ShellToolEntry {
  id: EditorToolId;
  label: string;
  icon: string;
  description: string;
  shortcut: string;
  section: "content" | "world" | "tools";
  accent: string;
}

const SHELL_TOOLS: ShellToolEntry[] = [
  // Content section
  {
    id: "quest",
    label: "Quest Creator",
    icon: "📜",
    description: "Author quest graphs with objective nodes, prerequisites, and XP rewards.",
    shortcut: "F10",
    section: "content",
    accent: "#4ea8e0",
  },
  {
    id: "dialogue",
    label: "Dialogue Creator",
    icon: "💬",
    description: "Build branching NPC dialogue trees with choice conditions and effects.",
    shortcut: "F12",
    section: "content",
    accent: "#a78bfa",
  },
  {
    id: "npc",
    label: "NPC Creator",
    icon: "🧑",
    description: "Define NPC archetypes with roles, stats, skills, and dialogue links.",
    shortcut: "Shift+F10",
    section: "content",
    accent: "#34d399",
  },
  {
    id: "item",
    label: "Item Creator",
    icon: "⚔",
    description: "Create item definitions with equip slots, tags, and export them for the content registry.",
    shortcut: "Shift+F12",
    section: "content",
    accent: "#fb923c",
  },
  // World section
  {
    id: "map",
    label: "Map Editor",
    icon: "🗺",
    description: "Place entities, patrol routes, loot containers, and quest markers in-engine.",
    shortcut: "F2",
    section: "world",
    accent: "#D4A017",
  },
  {
    id: "faction",
    label: "Faction Creator",
    icon: "🏰",
    description: "Define factions with reputation thresholds and inter-faction relationships.",
    shortcut: "Shift+F9",
    section: "world",
    accent: "#f472b6",
  },
  {
    id: "lootTable",
    label: "Loot Table Creator",
    icon: "💰",
    description: "Build weighted loot tables with multi-roll support and sub-table chaining.",
    shortcut: "Shift+F8",
    section: "world",
    accent: "#fbbf24",
  },
  {
    id: "spawn",
    label: "Spawn Creator",
    icon: "🏕",
    description: "Author NPC spawn groups with archetype, level range, and respawn intervals.",
    shortcut: "Shift+F11",
    section: "world",
    accent: "#6ee7b7",
  },
  // Tools section
  {
    id: "bundle",
    label: "Content Bundle",
    icon: "📦",
    description: "Aggregate validation dashboard and bundle export across all creator systems.",
    shortcut: "Shift+F7",
    section: "tools",
    accent: "#818cf8",
  },
  {
    id: "assets",
    label: "Asset Browser",
    icon: "🗂",
    description: "Searchable asset library with dependency graphs and insert-into-editor support.",
    shortcut: "Shift+F6",
    section: "tools",
    accent: "#67e8f9",
  },
  {
    id: "merge",
    label: "Bundle Merge",
    icon: "🔀",
    description: "Load two content bundles, resolve conflicting IDs, and export the merged result.",
    shortcut: "Shift+F5",
    section: "tools",
    accent: "#86efac",
  },
  {
    id: "modManifest",
    label: "Mod Manifest",
    icon: "📋",
    description: "Author and export mod manifests with ordered load lists and duplicate detection.",
    shortcut: "Ctrl+Shift+M",
    section: "tools",
    accent: "#a5b4fc",
  },
];

/** Subset shown as quick-access cards on the welcome dashboard. */
const FEATURED_TOOL_IDS: EditorToolId[] = ["map", "quest", "dialogue", "bundle"];

// ── Section metadata ──────────────────────────────────────────────────────────

interface SectionMeta {
  id: "content" | "world" | "tools";
  label: string;
  icon: string;
}

const SECTIONS: SectionMeta[] = [
  { id: "content", label: "Content",   icon: "✏" },
  { id: "world",   label: "World",     icon: "🌍" },
  { id: "tools",   label: "Tools",     icon: "🔧" },
];

// ── Public API ────────────────────────────────────────────────────────────────

export interface StandaloneEditorShellCallbacks {
  /** Fired when the user clicks a tool in the sidebar or welcome dashboard. */
  onToolSelect: (toolId: EditorToolId) => void;
  /** Fired when the user clicks the New toolbar button. */
  onNew?: () => void;
  /** Fired when the user clicks the Open toolbar button. */
  onOpen?: () => void;
  /** Fired when the user clicks the Save toolbar button. */
  onSave?: () => void;
  /** Fired when the user clicks the Export toolbar button. */
  onExport?: () => void;
  /** Fired when the user clicks a recent-project card on the welcome dashboard. */
  onRecentProjectOpen?: (projectId: string) => void;
  /** Fired when the user clicks the ✕ remove button on a recent-project card. */
  onRecentProjectRemove?: (projectId: string) => void;
}

/**
 * Standalone editor shell — an HTML-based full-screen workspace for non-programmer
 * content creators.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  🗡 Camelot Editor   [New] [Open] [Save] [Export]  [✕] │
 *   ├──────────────┬──────────────────────────────────────────┤
 *   │ ✏ Content    │                                          │
 *   │   📜 Quest   │   Welcome screen (featured tool cards)   │
 *   │   💬 Dial    │   — or —                                  │
 *   │   🧑 NPC     │   Active tool placeholder                │
 *   │   ⚔  Item    │                                          │
 *   │ 🌍 World     │                                          │
 *   │   🗺 Map     │                                          │
 *   │   🏰 Faction │                                          │
 *   │   💰 Loot    │                                          │
 *   │   🏕 Spawn   │                                          │
 *   │ 🔧 Tools     │                                          │
 *   │   📦 Bundle  │                                          │
 *   │   🗂 Assets  │                                          │
 *   │   🔀 Merge   │                                          │
 *   │   📋 Manifest│                                          │
 *   ├──────────────┴──────────────────────────────────────────┤
 *   │ ● Ready  ·  No project loaded                           │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   const shell = new StandaloneEditorShell({ onToolSelect: (id) => ... });
 *   shell.open();
 *   shell.setStatus("Map loaded — 42 entities");
 *   shell.setActiveSection("map");
 */
export class StandaloneEditorShell {
  /** Fired when the shell is dismissed (✕ button or Escape key). */
  public onClose: (() => void) | null = null;

  private readonly _cb: StandaloneEditorShellCallbacks;
  private _root: HTMLElement | null = null;
  private _statusDot: HTMLElement | null = null;
  private _statusText: HTMLElement | null = null;
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;

  /** Maps toolId → sidebar nav button for highlight management. */
  private readonly _navBtns = new Map<EditorToolId, HTMLElement>();

  private _activeToolId: EditorToolId | null = null;

  /** Container element for recent project cards on the welcome dashboard. */
  private _recentList: HTMLElement | null = null;

  constructor(callbacks: StandaloneEditorShellCallbacks) {
    this._cb = callbacks;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  /** Show the shell, building the DOM on first call. */
  open(): void {
    if (this._root) {
      this._root.hidden = false;
    } else {
      this._build();
    }
    if (!this._keyHandler) {
      this._keyHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") this.close();
      };
      document.addEventListener("keydown", this._keyHandler);
    }
  }

  /** Hide the shell and remove the Escape key listener. */
  close(): void {
    if (this._root) this._root.hidden = true;
    if (this._keyHandler) {
      document.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
    this.onClose?.();
  }

  /** Toggle visibility. Returns `true` if now visible. */
  toggle(): boolean {
    if (this.isVisible) { this.close(); return false; }
    this.open(); return true;
  }

  /**
   * Update the status bar message.
   * @param message Human-readable status text (e.g. "Map saved successfully").
   * @param isError When true the dot turns amber to signal a warning/error.
   */
  setStatus(message: string, isError = false): void {
    if (this._statusText) this._statusText.textContent = message;
    if (this._statusDot) {
      this._statusDot.style.color = isError ? "#E08830" : "#5EC45E";
      this._statusDot.setAttribute("aria-label", isError ? "status: error" : "status: ok");
    }
  }

  /**
   * Highlight the given tool in the sidebar navigation and update the
   * internal active-tool tracker.
   */
  setActiveSection(toolId: EditorToolId): void {
    if (this._activeToolId) {
      const prev = this._navBtns.get(this._activeToolId);
      if (prev) {
        prev.classList.remove("standalone-editor__nav-item--active");
        prev.removeAttribute("aria-current");
      }
    }
    this._activeToolId = toolId;
    const next = this._navBtns.get(toolId);
    if (next) {
      next.classList.add("standalone-editor__nav-item--active");
      next.setAttribute("aria-current", "page");
    }
  }

  /**
   * Update the recent-projects list on the welcome dashboard.
   *
   * Call this after the shell is opened and whenever the underlying
   * `RecentProjectsSystem` changes.  Replaces all existing recent-project
   * cards with the supplied entries.
   */
  updateRecentProjects(projects: ReadonlyArray<RecentProjectEntry>): void {
    if (!this._recentList) return;

    // Clear existing children.
    this._recentList.innerHTML = "";

    if (projects.length === 0) {
      const empty = document.createElement("p");
      empty.className = "standalone-editor__recent-empty";
      empty.textContent = "No recent projects.";
      this._recentList.appendChild(empty);
      return;
    }

    for (const proj of projects) {
      const row = document.createElement("div");
      row.className = "standalone-editor__recent-item";
      row.setAttribute("role", "listitem");
      row.setAttribute("data-project-id", proj.id);

      // Open button (entire row is clickable).
      const openBtn = document.createElement("button");
      openBtn.className = "standalone-editor__recent-open";
      openBtn.setAttribute("aria-label", `Open project ${proj.name}`);

      const nameSpan = document.createElement("span");
      nameSpan.className = "standalone-editor__recent-name";
      nameSpan.textContent = proj.name;
      openBtn.appendChild(nameSpan);

      if (proj.filePath) {
        const pathSpan = document.createElement("span");
        pathSpan.className = "standalone-editor__recent-path";
        pathSpan.textContent = proj.filePath;
        openBtn.appendChild(pathSpan);
      }

      const dateSpan = document.createElement("span");
      dateSpan.className = "standalone-editor__recent-date";
      dateSpan.textContent = this._formatDate(proj.lastOpenedAt);
      openBtn.appendChild(dateSpan);

      if (this._cb.onRecentProjectOpen) {
        const handler = this._cb.onRecentProjectOpen;
        openBtn.addEventListener("click", () => handler(proj.id));
      } else {
        openBtn.disabled = true;
      }

      row.appendChild(openBtn);

      // Remove button.
      const removeBtn = document.createElement("button");
      removeBtn.className = "standalone-editor__recent-remove";
      removeBtn.textContent = "✕";
      removeBtn.setAttribute("aria-label", `Remove ${proj.name} from recent projects`);

      if (this._cb.onRecentProjectRemove) {
        const handler = this._cb.onRecentProjectRemove;
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handler(proj.id);
        });
      } else {
        removeBtn.disabled = true;
      }

      row.appendChild(removeBtn);
      this._recentList.appendChild(row);
    }
  }

  // ── DOM construction ───────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "standalone-editor";
    root.setAttribute("role", "application");
    root.setAttribute("aria-label", "Camelot Standalone Editor");
    this._root = root;

    root.appendChild(this._buildTitleBar());

    const workspace = document.createElement("div");
    workspace.className = "standalone-editor__workspace";

    workspace.appendChild(this._buildSidebar());
    workspace.appendChild(this._buildMain());

    root.appendChild(workspace);
    root.appendChild(this._buildStatusBar());

    document.body.appendChild(root);
  }

  // ── Title bar ──────────────────────────────────────────────────────────────

  private _buildTitleBar(): HTMLElement {
    const bar = document.createElement("header");
    bar.className = "standalone-editor__title-bar";

    // Branding
    const brand = document.createElement("div");
    brand.className = "standalone-editor__brand";

    const logo = document.createElement("span");
    logo.className   = "standalone-editor__logo";
    logo.textContent = "🗡";
    logo.setAttribute("aria-hidden", "true");
    brand.appendChild(logo);

    const appName = document.createElement("span");
    appName.className   = "standalone-editor__app-name";
    appName.textContent = "Camelot Editor";
    brand.appendChild(appName);

    bar.appendChild(brand);

    // File action buttons
    const actions = document.createElement("div");
    actions.className = "standalone-editor__title-actions";
    actions.setAttribute("role", "toolbar");
    actions.setAttribute("aria-label", "File actions");

    const fileActions: Array<{ label: string; icon: string; cb: (() => void) | undefined }> = [
      { label: "New Project",    icon: "🆕", cb: this._cb.onNew },
      { label: "Open Project",   icon: "📂", cb: this._cb.onOpen },
      { label: "Save Project",   icon: "💾", cb: this._cb.onSave },
      { label: "Export Bundle",  icon: "⬇",  cb: this._cb.onExport },
    ];

    for (const fa of fileActions) {
      const btn = document.createElement("button");
      btn.className = "standalone-editor__title-btn";
      btn.setAttribute("aria-label", fa.label);
      btn.title = fa.label;

      const icon = document.createElement("span");
      icon.className   = "standalone-editor__title-btn-icon";
      icon.textContent = fa.icon;
      icon.setAttribute("aria-hidden", "true");
      btn.appendChild(icon);

      const text = document.createElement("span");
      text.className   = "standalone-editor__title-btn-text";
      text.textContent = fa.label.replace(" Project", "").replace(" Bundle", "");
      btn.appendChild(text);

      if (fa.cb) {
        const handler = fa.cb;
        btn.addEventListener("click", () => handler());
      } else {
        btn.disabled = true;
      }

      actions.appendChild(btn);
    }

    bar.appendChild(actions);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className   = "standalone-editor__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close editor shell");
    closeBtn.addEventListener("click", () => this.close());
    bar.appendChild(closeBtn);

    return bar;
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────

  private _buildSidebar(): HTMLElement {
    const nav = document.createElement("nav");
    nav.className = "standalone-editor__sidebar";
    nav.setAttribute("aria-label", "Editor tools navigation");

    for (const section of SECTIONS) {
      const tools = SHELL_TOOLS.filter(t => t.section === section.id);

      const sectionEl = document.createElement("div");
      sectionEl.className = "standalone-editor__nav-section";

      const sectionHeader = document.createElement("div");
      sectionHeader.className = "standalone-editor__nav-section-header";
      sectionHeader.setAttribute("aria-hidden", "true");

      const sectionIcon = document.createElement("span");
      sectionIcon.className   = "standalone-editor__nav-section-icon";
      sectionIcon.textContent = section.icon;
      sectionHeader.appendChild(sectionIcon);

      const sectionLabel = document.createElement("span");
      sectionLabel.textContent = section.label;
      sectionHeader.appendChild(sectionLabel);

      sectionEl.appendChild(sectionHeader);

      for (const tool of tools) {
        const btn = document.createElement("button");
        btn.className = "standalone-editor__nav-item";
        btn.setAttribute("aria-label", `Open ${tool.label} (${tool.shortcut})`);
        btn.setAttribute("data-tool-id", tool.id);

        const icon = document.createElement("span");
        icon.className   = "standalone-editor__nav-item-icon";
        icon.textContent = tool.icon;
        icon.setAttribute("aria-hidden", "true");
        btn.appendChild(icon);

        const label = document.createElement("span");
        label.className   = "standalone-editor__nav-item-label";
        label.textContent = tool.label;
        btn.appendChild(label);

        const shortcut = document.createElement("kbd");
        shortcut.className   = "standalone-editor__nav-item-shortcut";
        shortcut.textContent = tool.shortcut;
        btn.appendChild(shortcut);

        btn.addEventListener("click", () => {
          this.setActiveSection(tool.id);
          this._cb.onToolSelect(tool.id);
        });

        this._navBtns.set(tool.id, btn);
        sectionEl.appendChild(btn);
      }

      nav.appendChild(sectionEl);
    }

    return nav;
  }

  // ── Main content area ──────────────────────────────────────────────────────

  private _buildMain(): HTMLElement {
    const main = document.createElement("main");
    main.className = "standalone-editor__main";
    main.setAttribute("aria-label", "Editor workspace");

    main.appendChild(this._buildWelcome());

    return main;
  }

  private _buildWelcome(): HTMLElement {
    const welcome = document.createElement("div");
    welcome.className = "standalone-editor__welcome";
    welcome.setAttribute("role", "region");
    welcome.setAttribute("aria-label", "Welcome dashboard");

    // Heading
    const heading = document.createElement("h1");
    heading.className   = "standalone-editor__welcome-heading";
    heading.textContent = "Welcome to Camelot Editor";
    welcome.appendChild(heading);

    const sub = document.createElement("p");
    sub.className   = "standalone-editor__welcome-sub";
    sub.textContent =
      "A non-programmer-friendly workspace for building RPG worlds. " +
      "Pick a tool from the sidebar or start with one of the quick-access cards below.";
    welcome.appendChild(sub);

    // Featured tools grid
    const grid = document.createElement("div");
    grid.className = "standalone-editor__welcome-grid";
    grid.setAttribute("role", "list");

    for (const id of FEATURED_TOOL_IDS) {
      const tool = SHELL_TOOLS.find(t => t.id === id);
      if (!tool) continue;

      const card = document.createElement("button");
      card.className = "standalone-editor__welcome-card";
      card.style.setProperty("--card-accent", tool.accent);
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-label", `Open ${tool.label}`);
      card.setAttribute("data-tool-id", tool.id);

      const cardIcon = document.createElement("div");
      cardIcon.className   = "standalone-editor__welcome-card-icon";
      cardIcon.textContent = tool.icon;
      cardIcon.setAttribute("aria-hidden", "true");
      card.appendChild(cardIcon);

      const cardName = document.createElement("div");
      cardName.className   = "standalone-editor__welcome-card-name";
      cardName.textContent = tool.label;
      card.appendChild(cardName);

      const cardDesc = document.createElement("p");
      cardDesc.className   = "standalone-editor__welcome-card-desc";
      cardDesc.textContent = tool.description;
      card.appendChild(cardDesc);

      const cardShortcut = document.createElement("kbd");
      cardShortcut.className   = "standalone-editor__welcome-card-shortcut";
      cardShortcut.textContent = tool.shortcut;
      card.appendChild(cardShortcut);

      card.addEventListener("click", () => {
        this.setActiveSection(tool.id);
        this._cb.onToolSelect(tool.id);
      });

      grid.appendChild(card);
    }

    welcome.appendChild(grid);

    // Recent projects section
    const recentSection = document.createElement("div");
    recentSection.className = "standalone-editor__recent";
    recentSection.setAttribute("aria-label", "Recent projects");

    const recentHeading = document.createElement("h2");
    recentHeading.className = "standalone-editor__recent-heading";
    recentHeading.textContent = "Recent Projects";
    recentSection.appendChild(recentHeading);

    const recentList = document.createElement("div");
    recentList.className = "standalone-editor__recent-list";
    recentList.setAttribute("role", "list");
    recentList.setAttribute("aria-live", "polite");

    const emptyMsg = document.createElement("p");
    emptyMsg.className = "standalone-editor__recent-empty";
    emptyMsg.textContent = "No recent projects.";
    recentList.appendChild(emptyMsg);

    this._recentList = recentList;
    recentSection.appendChild(recentList);
    welcome.appendChild(recentSection);

    // Tip row
    const tip = document.createElement("p");
    tip.className   = "standalone-editor__welcome-tip";
    tip.textContent =
      "💡 Tip: use the sidebar to navigate between tools. " +
      "Press Esc to close the editor shell at any time.";
    welcome.appendChild(tip);

    return welcome;
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  private _buildStatusBar(): HTMLElement {
    const bar = document.createElement("footer");
    bar.className = "standalone-editor__status-bar";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    bar.setAttribute("aria-label", "Editor status");

    const dot = document.createElement("span");
    dot.className   = "standalone-editor__status-dot";
    dot.textContent = "●";
    dot.style.color = "#5EC45E";
    dot.setAttribute("aria-label", "status: ok");
    this._statusDot = dot;
    bar.appendChild(dot);

    const text = document.createElement("span");
    text.className   = "standalone-editor__status-text";
    text.textContent = "Ready  ·  No project loaded";
    this._statusText = text;
    bar.appendChild(text);

    return bar;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Format an ISO-8601 timestamp as a short human-readable date string. */
  private _formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }
}
