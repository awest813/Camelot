/**
 * EditorLayout — Dockable editor panel layout manager and unified selection model.
 *
 * Provides:
 *  - Dockable panel registry: panels can be docked to left, right, bottom, or floated.
 *  - Unified selection model: single source of truth for the currently selected entity
 *    across all editor panels (hierarchy, palette, property inspector, validation).
 *
 * This is a pure-logic layer — no BabylonJS GUI dependencies — so it is usable
 * in headless tests and can be wired to any GUI implementation.
 *
 * Content GUI Release A deliverable.
 */

/** Valid dock positions for an editor panel. */
export type DockSide = "left" | "right" | "bottom" | "float";

export interface PanelDockState {
  panelId: string;
  side: DockSide;
  /** Pixel width for left/right docks, height for bottom. Undefined = auto. */
  size?: number;
  /** Whether this panel is currently visible. */
  isVisible: boolean;
}

/**
 * EditorLayout
 *
 * Manages the layout and visibility state of dockable editor panels, and
 * maintains a unified selection model shared across all panels.
 */
export class EditorLayout {
  private _panels: Map<string, PanelDockState> = new Map();
  private _selectedEntityId: string | null = null;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * Fired whenever the selected entity changes.
   * Receives the new entity id, or null when the selection is cleared.
   */
  public onSelectionChanged: ((entityId: string | null) => void) | null = null;

  /**
   * Fired when a panel's dock position or visibility changes.
   */
  public onLayoutChanged: ((state: PanelDockState) => void) | null = null;

  // ── Panel management ──────────────────────────────────────────────────────

  /**
   * Register a panel and assign it an initial dock position.
   * If the panel was previously registered its state is preserved unless
   * `opts.force` is true.
   */
  public registerPanel(panelId: string, opts: {
    side?: DockSide;
    size?: number;
    isVisible?: boolean;
    force?: boolean;
  } = {}): void {
    if (this._panels.has(panelId) && !opts.force) return;

    this._panels.set(panelId, {
      panelId,
      side: opts.side ?? "float",
      size: opts.size,
      isVisible: opts.isVisible ?? true,
    });
  }

  /**
   * Dock a panel to the specified side.
   * Registers the panel automatically if not yet registered.
   */
  public dock(panelId: string, side: DockSide, size?: number): void {
    const existing = this._panels.get(panelId);
    const state: PanelDockState = existing
      ? { ...existing, side, ...(size !== undefined ? { size } : {}) }
      : { panelId, side, size, isVisible: true };

    this._panels.set(panelId, state);
    this.onLayoutChanged?.(state);
  }

  /**
   * Move a panel to floating mode (undock).
   */
  public undock(panelId: string): void {
    const existing = this._panels.get(panelId);
    if (!existing) return;

    const state: PanelDockState = { ...existing, side: "float" };
    this._panels.set(panelId, state);
    this.onLayoutChanged?.(state);
  }

  /**
   * Show or hide a panel without changing its dock position.
   */
  public setVisible(panelId: string, visible: boolean): void {
    const existing = this._panels.get(panelId);
    if (!existing) return;

    const state: PanelDockState = { ...existing, isVisible: visible };
    this._panels.set(panelId, state);
    this.onLayoutChanged?.(state);
  }

  /**
   * Show all registered panels.
   */
  public showAll(): void {
    for (const [panelId] of this._panels) {
      this.setVisible(panelId, true);
    }
  }

  /**
   * Hide all registered panels.
   */
  public hideAll(): void {
    for (const [panelId] of this._panels) {
      this.setVisible(panelId, false);
    }
  }

  /**
   * Returns the current dock state for a panel, or null if not registered.
   */
  public getPanelState(panelId: string): PanelDockState | null {
    return this._panels.get(panelId) ?? null;
  }

  /**
   * Returns all registered panel states.
   */
  public get allPanels(): PanelDockState[] {
    return Array.from(this._panels.values());
  }

  /**
   * Returns all panels currently docked to the given side.
   */
  public getPanelsBySide(side: DockSide): PanelDockState[] {
    return Array.from(this._panels.values()).filter(p => p.side === side);
  }

  // ── Unified selection model ───────────────────────────────────────────────

  /**
   * The currently selected entity id, or null when nothing is selected.
   */
  public get selectedEntityId(): string | null {
    return this._selectedEntityId;
  }

  /**
   * Set the selected entity.
   * Fires `onSelectionChanged` whenever the selection actually changes.
   * Passing null clears the selection.
   */
  public setSelection(entityId: string | null): void {
    if (entityId === this._selectedEntityId) return;
    this._selectedEntityId = entityId;
    this.onSelectionChanged?.(entityId);
  }

  /**
   * Clear the current selection (alias for `setSelection(null)`).
   */
  public clearSelection(): void {
    this.setSelection(null);
  }

  /**
   * Returns true if the given entity is currently selected.
   */
  public isSelected(entityId: string): boolean {
    return this._selectedEntityId === entityId;
  }

  // ── Serialisation helpers ─────────────────────────────────────────────────

  /**
   * Return a plain serialisable snapshot of the current layout.
   * Useful for persisting the editor's panel arrangement between sessions.
   */
  public getLayoutSnapshot(): PanelDockState[] {
    return this.allPanels.map(p => ({ ...p }));
  }

  /**
   * Restore a previously captured layout snapshot.
   * Panels not present in the snapshot are left unchanged.
   */
  public restoreLayoutSnapshot(snapshot: PanelDockState[]): void {
    for (const state of snapshot) {
      this._panels.set(state.panelId, { ...state });
      this.onLayoutChanged?.(state);
    }
  }
}
