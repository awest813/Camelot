/**
 * Editor Hub — central launcher for all Camelot creator tools.
 *
 * Displays a sidebar launcher (F11) showing every editor tool with a description
 * and keyboard shortcut, inspired by the Godot editor's main screen switcher.
 *
 * Supported tools:
 *   • Map Editor        (F2)  — In-engine terrain & entity placement
 *   • Quest Creator     (F10) — Quest graph authoring
 *   • Dialogue Creator  (F12) — Dialogue tree authoring
 *   • NPC Creator       (F9 when not in game — see game.ts)
 *   • Item Creator      (F8 when not in game — see game.ts)
 *
 * Usage:
 *   const hub = new EditorHubUI({ onOpen: (tool) => ... });
 *   hub.open();   // shows the hub
 *   hub.close();  // hides it
 */

export type EditorToolId =
  | "map"
  | "quest"
  | "dialogue"
  | "npc"
  | "item"
  | "faction"
  | "lootTable"
  | "spawn";

export interface EditorHubCallbacks {
  /** Called when the user clicks a tool button. */
  onOpen: (tool: EditorToolId) => void;
}

interface ToolEntry {
  id: EditorToolId;
  label: string;
  icon: string;
  description: string;
  shortcut: string;
  accentVar: string;
}

const TOOLS: ToolEntry[] = [
  {
    id:          "map",
    label:       "Map Editor",
    icon:        "🗺",
    description: "Place and configure entities, patrol routes, loot containers, quest markers, and sculpt terrain in-engine.",
    shortcut:    "F2",
    accentVar:   "#D4A017",
  },
  {
    id:          "quest",
    label:       "Quest Creator",
    icon:        "📜",
    description: "Author quest graphs with kill / pickup / talk / custom objective nodes, prerequisites, and XP rewards.",
    shortcut:    "F10",
    accentVar:   "#4ea8e0",
  },
  {
    id:          "dialogue",
    label:       "Dialogue Creator",
    icon:        "💬",
    description: "Build branching NPC dialogue trees with choice conditions, quest activations, faction effects, and item grants.",
    shortcut:    "F12",
    accentVar:   "#a78bfa",
  },
  {
    id:          "npc",
    label:       "NPC Creator",
    icon:        "🧑",
    description: "Define NPC archetypes: role, faction affiliation, combat stats, skill overrides, resistances, and links to dialogue and loot tables.",
    shortcut:    "Shift+F10",
    accentVar:   "#34d399",
  },
  {
    id:          "item",
    label:       "Item Creator",
    icon:        "⚔",
    description: "Create item definitions with equip slots, stackable quantities, tags (weapon / armor / consumable…), and JSON export for the content registry.",
    shortcut:    "Shift+F12",
    accentVar:   "#fb923c",
  },
  {
    id:          "faction",
    label:       "Faction Creator",
    icon:        "🏰",
    description: "Define factions with reputation thresholds (hostile / neutral / friendly / allied), default standing, and inter-faction relationship records.",
    shortcut:    "Shift+F9",
    accentVar:   "#f472b6",
  },
  {
    id:          "lootTable",
    label:       "Loot Table Creator",
    icon:        "💰",
    description: "Build weighted loot tables with multi-roll support, guaranteed drops, sub-table chaining, level-range conditions, and empty-roll probability.",
    shortcut:    "Shift+F8",
    accentVar:   "#fbbf24",
  },
  {
    id:          "spawn",
    label:       "Loot + Spawn Creator",
    icon:        "🏕",
    description: "Author NPC spawn groups with archetype picker, loot table linking, count, level range, and respawn interval; inline validation hints flag issues before export.",
    shortcut:    "Shift+F11",
    accentVar:   "#6ee7b7",
  },
];

export class EditorHubUI {
  public onClose: (() => void) | null = null;

  private readonly _callbacks: EditorHubCallbacks;
  private _root: HTMLElement | null = null;

  constructor(callbacks: EditorHubCallbacks) {
    this._callbacks = callbacks;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  open(): void {
    if (this._root) {
      this._root.hidden = false;
      return;
    }
    this._build();
  }

  close(): void {
    if (this._root) this._root.hidden = true;
    this.onClose?.();
  }

  toggle(): boolean {
    if (this.isVisible) { this.close(); return false; }
    this.open(); return true;
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "editor-hub";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Editor Hub");
    this._root = root;

    const panel = document.createElement("div");
    panel.className = "editor-hub__panel";
    root.appendChild(panel);

    // Click backdrop to close
    root.addEventListener("click", (e) => {
      if (e.target === root) this.close();
    });

    // Header
    const header = document.createElement("div");
    header.className = "editor-hub__header";

    const logoWrap = document.createElement("div");
    logoWrap.className = "editor-hub__logo-wrap";

    const logo = document.createElement("div");
    logo.className   = "editor-hub__logo";
    logo.textContent = "⚙";
    logoWrap.appendChild(logo);

    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.className   = "editor-hub__title";
    title.textContent = "Camelot Editor";
    const subtitle = document.createElement("p");
    subtitle.className   = "editor-hub__subtitle";
    subtitle.textContent = "RPG Creator Tools — press F11 to toggle";
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    logoWrap.appendChild(titleWrap);

    header.appendChild(logoWrap);

    const closeBtn = document.createElement("button");
    closeBtn.className   = "editor-hub__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close editor hub");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Tool grid
    const grid = document.createElement("div");
    grid.className = "editor-hub__grid";
    panel.appendChild(grid);

    for (const tool of TOOLS) {
      grid.appendChild(this._buildToolCard(tool));
    }

    // Footer
    const footer = document.createElement("div");
    footer.className = "editor-hub__footer";

    const span1 = document.createElement("span");
    span1.textContent = "Press ";
    const kbd = document.createElement("kbd");
    kbd.textContent = "Esc";
    span1.appendChild(kbd);
    span1.appendChild(document.createTextNode(" or click outside to close \u00A0·\u00A0 "));

    const span2 = document.createElement("span");
    span2.textContent = "Each tool can also be opened directly with its shortcut key";

    footer.appendChild(span1);
    footer.appendChild(span2);

    panel.appendChild(footer);

    document.body.appendChild(root);
  }

  private _buildToolCard(tool: ToolEntry): HTMLElement {
    const card = document.createElement("button");
    card.className        = "editor-hub__tool-card";
    card.style.setProperty("--tool-accent", tool.accentVar);
    card.setAttribute("aria-label", `Open ${tool.label}`);

    const iconEl = document.createElement("div");
    iconEl.className   = "editor-hub__tool-icon";
    iconEl.textContent = tool.icon;

    const body = document.createElement("div");
    body.className = "editor-hub__tool-body";

    const nameRow = document.createElement("div");
    nameRow.className = "editor-hub__tool-name-row";

    const name = document.createElement("span");
    name.className   = "editor-hub__tool-name";
    name.textContent = tool.label;

    const shortcut = document.createElement("kbd");
    shortcut.className   = "editor-hub__shortcut";
    shortcut.textContent = tool.shortcut;

    nameRow.appendChild(name);
    nameRow.appendChild(shortcut);

    const desc = document.createElement("p");
    desc.className   = "editor-hub__tool-desc";
    desc.textContent = tool.description;

    body.appendChild(nameRow);
    body.appendChild(desc);

    card.appendChild(iconEl);
    card.appendChild(body);

    card.addEventListener("click", () => {
      this.close();
      this._callbacks.onOpen(tool.id);
    });

    return card;
  }
}
