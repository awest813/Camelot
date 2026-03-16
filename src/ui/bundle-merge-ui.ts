import type { BundleMergeSystem, MergeConflict, ConflictStrategy } from "../systems/bundle-merge-system";
import type { ContentBundleExport } from "../systems/content-bundle-system";

/**
 * HTML-based Bundle Merge Assistant overlay — Release D: Collaboration + Scale.
 *
 * Workflow:
 *   1. Load Base Bundle    — drag-and-drop or file picker for base .bundle.json
 *   2. Load Incoming Bundle — same for the incoming bundle
 *   3. Detect Conflicts    — auto-detected on load; shown in a table
 *   4. Resolve each        — per-row strategy picker
 *   5. Build + Export      — downloads the merged .bundle.json
 *
 * Keybinding: Shift+F5 (wired in game.ts).
 */
export class BundleMergeUI {
  /** Called when the user closes the panel. */
  public onClose: (() => void) | null = null;

  private readonly _sys: BundleMergeSystem;
  private _root: HTMLElement | null = null;
  private _conflictTableEl: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _baseLabel: HTMLElement | null = null;
  private _incLabel:  HTMLElement | null = null;
  private _mergeBtn:  HTMLButtonElement | null = null;

  constructor(sys: BundleMergeSystem) {
    this._sys = sys;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  open(): void {
    if (this._root) { this._root.hidden = false; return; }
    this._build();
  }

  close(): void {
    if (this._root) this._root.hidden = true;
    this.onClose?.();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "bundle-merge";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Bundle Merge Assistant");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "bundle-merge__panel";
    root.appendChild(panel);

    // ── Header ─────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "bundle-merge__header";

    const titleWrap = document.createElement("div");
    const titleEl = document.createElement("h2");
    titleEl.className   = "bundle-merge__title";
    titleEl.textContent = "🔀 Bundle Merge Assistant";
    const subtitleEl = document.createElement("p");
    subtitleEl.className   = "bundle-merge__subtitle";
    subtitleEl.textContent = "Merge two content bundles and resolve conflicting content IDs — Shift+F5";
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subtitleEl);
    header.appendChild(titleWrap);

    const closeBtn = document.createElement("button");
    closeBtn.className   = "bundle-merge__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close bundle merge assistant");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Bundle loaders ──────────────────────────────────────────────────────
    const loadRow = document.createElement("div");
    loadRow.className = "bundle-merge__load-row";

    loadRow.appendChild(this._buildLoader("Base Bundle", (bundle) => {
      this._sys.loadBase(bundle);
      if (this._baseLabel) {
        this._baseLabel.textContent = `✔ ${bundle.manifest.title || "Untitled"} (${bundle.manifest.systems.length} system${bundle.manifest.systems.length !== 1 ? "s" : ""})`;
        this._baseLabel.classList.add("bundle-merge__loader-label--loaded");
      }
      this._runDetection();
    }, (el) => { this._baseLabel = el; }));

    loadRow.appendChild(this._buildLoader("Incoming Bundle", (bundle) => {
      this._sys.loadIncoming(bundle);
      if (this._incLabel) {
        this._incLabel.textContent = `✔ ${bundle.manifest.title || "Untitled"} (${bundle.manifest.systems.length} system${bundle.manifest.systems.length !== 1 ? "s" : ""})`;
        this._incLabel.classList.add("bundle-merge__loader-label--loaded");
      }
      this._runDetection();
    }, (el) => { this._incLabel = el; }));

    panel.appendChild(loadRow);

    // ── Conflict table ─────────────────────────────────────────────────────
    const conflictSection = document.createElement("div");
    conflictSection.className = "bundle-merge__conflict-section";

    const conflictTitle = document.createElement("h3");
    conflictTitle.className   = "bundle-merge__section-title";
    conflictTitle.textContent = "Conflict Resolution";
    conflictSection.appendChild(conflictTitle);

    const conflictTable = document.createElement("div");
    conflictTable.className = "bundle-merge__conflict-table";
    this._conflictTableEl = conflictTable;

    const emptyMsg = document.createElement("p");
    emptyMsg.className   = "bundle-merge__empty";
    emptyMsg.textContent = "Load both bundles to detect conflicts.";
    conflictTable.appendChild(emptyMsg);

    conflictSection.appendChild(conflictTable);
    panel.appendChild(conflictSection);

    // ── Status ─────────────────────────────────────────────────────────────
    const statusEl = document.createElement("div");
    statusEl.className = "bundle-merge__status";
    statusEl.setAttribute("aria-live", "polite");
    this._statusEl = statusEl;
    panel.appendChild(statusEl);

    // ── Action bar ─────────────────────────────────────────────────────────
    const actions = document.createElement("div");
    actions.className = "bundle-merge__actions";

    const allBaseBtn = document.createElement("button");
    allBaseBtn.className   = "bundle-merge__btn bundle-merge__btn--secondary";
    allBaseBtn.textContent = "All → Keep Base";
    allBaseBtn.addEventListener("click", () => {
      this._sys.setAllStrategies("keep-base");
      this._renderConflicts(this._sys.findConflicts());
    });

    const allIncBtn = document.createElement("button");
    allIncBtn.className   = "bundle-merge__btn bundle-merge__btn--secondary";
    allIncBtn.textContent = "All → Keep Incoming";
    allIncBtn.addEventListener("click", () => {
      this._sys.setAllStrategies("keep-incoming");
      this._renderConflicts(this._sys.findConflicts());
    });

    const mergeBtn = document.createElement("button");
    mergeBtn.className   = "bundle-merge__btn bundle-merge__btn--primary";
    mergeBtn.textContent = "⬇ Build & Export Merge";
    mergeBtn.disabled    = true;
    mergeBtn.addEventListener("click", () => this._doMerge());
    this._mergeBtn = mergeBtn;

    const closeActionBtn = document.createElement("button");
    closeActionBtn.className   = "bundle-merge__btn bundle-merge__btn--close";
    closeActionBtn.textContent = "Close";
    closeActionBtn.addEventListener("click", () => this.close());

    actions.appendChild(allBaseBtn);
    actions.appendChild(allIncBtn);
    actions.appendChild(mergeBtn);
    actions.appendChild(closeActionBtn);
    panel.appendChild(actions);

    // ── Footer ─────────────────────────────────────────────────────────────
    const footer = document.createElement("div");
    footer.className = "bundle-merge__footer";
    footer.innerHTML =
      'Press <kbd>Esc</kbd> or click ✕ to close &nbsp;·&nbsp; ' +
      'Merged JSON uses deterministic key ordering for diff-friendly source control';
    panel.appendChild(footer);

    document.body.appendChild(root);
  }

  // ── Loader helper ──────────────────────────────────────────────────────────

  private _buildLoader(
    title: string,
    onLoaded: (bundle: ContentBundleExport) => void,
    getLabelRef: (el: HTMLElement) => void,
  ): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "bundle-merge__loader";

    const h = document.createElement("h4");
    h.className   = "bundle-merge__loader-title";
    h.textContent = title;
    wrap.appendChild(h);

    const label = document.createElement("div");
    label.className   = "bundle-merge__loader-label";
    label.textContent = "No file loaded";
    getLabelRef(label);
    wrap.appendChild(label);

    const btn = document.createElement("button");
    btn.className   = "bundle-merge__btn bundle-merge__btn--file";
    btn.textContent = "📂 Choose .bundle.json";
    btn.addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type   = "file";
      inp.accept = ".json,.bundle.json";
      inp.addEventListener("change", () => {
        const file = inp.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result as string) as ContentBundleExport;
            onLoaded(parsed);
          } catch {
            this._setStatus("Failed to parse bundle JSON.", "error");
          }
        };
        reader.readAsText(file);
      });
      inp.click();
    });
    wrap.appendChild(btn);

    return wrap;
  }

  // ── Conflict detection + rendering ─────────────────────────────────────────

  private _runDetection(): void {
    if (!this._sys.hasBase || !this._sys.hasIncoming) return;
    const conflicts = this._sys.findConflicts();
    this._renderConflicts(conflicts);
    if (this._mergeBtn) this._mergeBtn.disabled = false;

    if (conflicts.length === 0) {
      this._setStatus("No conflicts detected. Ready to merge.", "ok");
    } else {
      this._setStatus(`${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""} detected. Choose a resolution strategy for each.`, "warn");
    }
  }

  private _renderConflicts(conflicts: MergeConflict[]): void {
    if (!this._conflictTableEl) return;
    this._conflictTableEl.innerHTML = "";

    if (conflicts.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "bundle-merge__empty";
      empty.textContent =
        this._sys.hasBase && this._sys.hasIncoming
          ? "No conflicts — all content IDs are unique. Ready to merge."
          : "Load both bundles to detect conflicts.";
      this._conflictTableEl.appendChild(empty);
      return;
    }

    // Table header
    const thead = document.createElement("div");
    thead.className = "bundle-merge__thead";
    ["System", "Conflict ID", "Base", "Incoming", "Resolution"].forEach((h) => {
      const cell = document.createElement("span");
      cell.className   = "bundle-merge__th";
      cell.textContent = h;
      thead.appendChild(cell);
    });
    this._conflictTableEl.appendChild(thead);

    for (const conflict of conflicts) {
      this._conflictTableEl.appendChild(this._buildConflictRow(conflict));
    }
  }

  private _buildConflictRow(conflict: MergeConflict): HTMLElement {
    const row = document.createElement("div");
    row.className = "bundle-merge__conflict-row";

    const sysCell = document.createElement("span");
    sysCell.className   = "bundle-merge__td bundle-merge__td--sys";
    sysCell.textContent = conflict.systemId;

    const idCell = document.createElement("span");
    idCell.className   = "bundle-merge__td bundle-merge__td--id";
    idCell.textContent = conflict.id;
    idCell.title       = conflict.id;

    const baseCell = document.createElement("span");
    baseCell.className   = "bundle-merge__td bundle-merge__td--label";
    baseCell.textContent = conflict.baseLabel;
    baseCell.title       = conflict.baseLabel;

    const incCell = document.createElement("span");
    incCell.className   = "bundle-merge__td bundle-merge__td--label";
    incCell.textContent = conflict.incomingLabel;
    incCell.title       = conflict.incomingLabel;

    const stratCell = document.createElement("span");
    stratCell.className = "bundle-merge__td bundle-merge__td--strat";

    const select = document.createElement("select");
    select.className = "bundle-merge__strat-select";
    select.setAttribute("aria-label", `Resolution for ${conflict.id}`);

    const options: { value: ConflictStrategy; label: string }[] = [
      { value: "keep-base",       label: "Keep Base" },
      { value: "keep-incoming",   label: "Keep Incoming" },
      { value: "rename-incoming", label: "Rename Incoming (id_merged)" },
    ];
    for (const opt of options) {
      const el = document.createElement("option");
      el.value       = opt.value;
      el.textContent = opt.label;
      if (opt.value === conflict.strategy) el.selected = true;
      select.appendChild(el);
    }
    select.addEventListener("change", () => {
      this._sys.setStrategy(conflict.id, select.value as ConflictStrategy);
    });
    stratCell.appendChild(select);

    row.appendChild(sysCell);
    row.appendChild(idCell);
    row.appendChild(baseCell);
    row.appendChild(incCell);
    row.appendChild(stratCell);

    return row;
  }

  // ── Merge action ───────────────────────────────────────────────────────────

  private _doMerge(): void {
    try {
      const result = this._sys.exportMergedToFile();
      const parts: string[] = [];
      if (result.keptBase     > 0) parts.push(`${result.keptBase} base`);
      if (result.keptIncoming > 0) parts.push(`${result.keptIncoming} incoming`);
      if (result.renamed      > 0) parts.push(`${result.renamed} renamed`);
      const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      this._setStatus(
        `Merged bundle exported${detail}. ${result.conflictCount} conflict${result.conflictCount !== 1 ? "s" : ""} resolved.`,
        "ok",
      );
    } catch (err) {
      this._setStatus(`Merge failed: ${String(err)}`, "error");
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _setStatus(msg: string, type: "ok" | "error" | "warn" | "info"): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = msg;
    this._statusEl.className   = `bundle-merge__status bundle-merge__status--${type}`;
  }
}
