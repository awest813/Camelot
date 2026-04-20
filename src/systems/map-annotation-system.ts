/**
 * MapAnnotationSystem — Freehand ink annotation layer for the map editor.
 *
 * Provides an in-memory model for pen-drawn annotations on top of the tile
 * map.  Annotations are serialised as arrays of 2D points (strokes), each
 * with a colour, width, and optional label.  The data model is headless —
 * it stores and validates stroke data without any Babylon.js dependency.
 *
 * Inspired by the BabylonJS Ink Sample (https://github.com/sebavan/BabylonjsInkSample).
 *
 * At runtime, the consuming code (e.g. a DynamicTexture renderer) reads
 * the stroke data and renders it; this system only manages the data.
 *
 * Integration:
 *   - Annotations are included in `MapExportData` via the `annotations` field.
 *   - The map editor UI can toggle the annotation layer on/off.
 *   - Annotations are editor-only by default (stripped in play mode).
 *
 * @example
 * ```ts
 * const ink = new MapAnnotationSystem();
 * const id = ink.beginStroke({ color: "#ff0000", width: 2 });
 * ink.addPoint(id, 10, 15);
 * ink.addPoint(id, 12, 18);
 * ink.endStroke(id);
 * const data = ink.export();
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** A single 2D point in an annotation stroke. */
export interface AnnotationPoint {
  x: number;
  z: number;
}

/** Visual properties for a stroke. */
export interface StrokeStyle {
  /** CSS colour string (e.g. "#ff0000", "rgba(255,0,0,0.5)"). Default: "#ff0000". */
  color: string;
  /** Line width in pixels/world units. Default: 2. */
  width: number;
}

/** A complete annotation stroke (series of connected points). */
export interface AnnotationStroke {
  /** Unique identifier for this stroke. */
  id: string;
  /** Ordered points forming the stroke path. */
  points: AnnotationPoint[];
  /** Visual style of the stroke. */
  style: StrokeStyle;
  /** Optional human-readable label (e.g. "blocked area", "boss trigger"). */
  label?: string;
  /** Whether the stroke is complete (no more points will be added). */
  completed: boolean;
}

/** Serialisable snapshot of all annotations. */
export interface AnnotationSnapshot {
  strokes: Array<{
    id: string;
    points: AnnotationPoint[];
    style: StrokeStyle;
    label?: string;
  }>;
}

/** Validation issue with annotations. */
export interface AnnotationValidationIssue {
  code: "empty-stroke" | "single-point" | "too-many-strokes";
  message: string;
  strokeId?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_STYLE: StrokeStyle = { color: "#ff0000", width: 2 };
const MAX_STROKES = 500;

// ── System ─────────────────────────────────────────────────────────────────────

export class MapAnnotationSystem {
  private _strokes = new Map<string, AnnotationStroke>();
  private _nextId = 1;
  private _visible = true;

  // ── Callbacks ──────────────────────────────────────────────────────────────

  /** Fired when a new stroke is created. */
  public onStrokeBegin: ((stroke: AnnotationStroke) => void) | null = null;

  /** Fired when a point is added to a stroke. */
  public onPointAdded: ((strokeId: string, point: AnnotationPoint) => void) | null = null;

  /** Fired when a stroke is completed (endStroke called). */
  public onStrokeEnd: ((stroke: AnnotationStroke) => void) | null = null;

  /** Fired when a stroke is removed. */
  public onStrokeRemoved: ((strokeId: string) => void) | null = null;

  /** Fired when all strokes are cleared. */
  public onClear: (() => void) | null = null;

  // ── Layer visibility ──────────────────────────────────────────────────────

  /** Whether the annotation layer is visible. */
  get isVisible(): boolean {
    return this._visible;
  }

  /** Toggle or set annotation layer visibility. */
  setVisible(visible: boolean): void {
    this._visible = visible;
  }

  // ── Stroke creation ───────────────────────────────────────────────────────

  /**
   * Begin a new stroke with the given style.
   *
   * @param style  Optional stroke style. Defaults to red, width 2.
   * @param label  Optional human-readable label for the stroke.
   * @returns      The stroke id (used to add points and end the stroke).
   */
  public beginStroke(style?: Partial<StrokeStyle>, label?: string): string {
    const id = `stroke_${this._nextId++}`;
    const stroke: AnnotationStroke = {
      id,
      points: [],
      style: { ...DEFAULT_STYLE, ...style },
      label,
      completed: false,
    };
    this._strokes.set(id, stroke);
    this.onStrokeBegin?.(stroke);
    return id;
  }

  /**
   * Add a point to an in-progress stroke.
   *
   * @returns `true` if the point was added, `false` if the stroke is not found
   *          or already completed.
   */
  public addPoint(strokeId: string, x: number, z: number): boolean {
    const stroke = this._strokes.get(strokeId);
    if (!stroke || stroke.completed) return false;
    const point: AnnotationPoint = { x, z };
    stroke.points.push(point);
    this.onPointAdded?.(strokeId, point);
    return true;
  }

  /**
   * End (finalise) a stroke so no more points can be added.
   *
   * @returns `true` if the stroke was ended, `false` if not found or already
   *          completed.
   */
  public endStroke(strokeId: string): boolean {
    const stroke = this._strokes.get(strokeId);
    if (!stroke || stroke.completed) return false;
    stroke.completed = true;
    this.onStrokeEnd?.(stroke);
    return true;
  }

  // ── Stroke management ─────────────────────────────────────────────────────

  /** Get a stroke by id, or undefined if not found. */
  public getStroke(strokeId: string): AnnotationStroke | undefined {
    return this._strokes.get(strokeId);
  }

  /** Get all strokes (completed and in-progress). */
  public getAllStrokes(): AnnotationStroke[] {
    return Array.from(this._strokes.values());
  }

  /** Get only completed strokes. */
  public getCompletedStrokes(): AnnotationStroke[] {
    return Array.from(this._strokes.values()).filter(s => s.completed);
  }

  /** Total number of strokes. */
  public get strokeCount(): number {
    return this._strokes.size;
  }

  /**
   * Remove a stroke by id.
   *
   * @returns `true` if the stroke was removed, `false` if not found.
   */
  public removeStroke(strokeId: string): boolean {
    if (!this._strokes.has(strokeId)) return false;
    this._strokes.delete(strokeId);
    this.onStrokeRemoved?.(strokeId);
    return true;
  }

  /** Remove all strokes. */
  public clear(): void {
    this._strokes.clear();
    this.onClear?.();
  }

  /**
   * Update the label on a stroke.
   *
   * @returns `true` if the stroke was found and updated.
   */
  public setStrokeLabel(strokeId: string, label: string | undefined): boolean {
    const stroke = this._strokes.get(strokeId);
    if (!stroke) return false;
    stroke.label = label;
    return true;
  }

  /**
   * Update the style of an existing stroke.
   *
   * @returns `true` if the stroke was found and updated.
   */
  public setStrokeStyle(strokeId: string, style: Partial<StrokeStyle>): boolean {
    const stroke = this._strokes.get(strokeId);
    if (!stroke) return false;
    if (style.color !== undefined) stroke.style.color = style.color;
    if (style.width !== undefined) stroke.style.width = style.width;
    return true;
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  /**
   * Remove the last completed stroke (simple undo).
   *
   * @returns The removed stroke, or `null` if there are no completed strokes.
   */
  public undoLastStroke(): AnnotationStroke | null {
    const completed = this.getCompletedStrokes();
    if (completed.length === 0) return null;
    const last = completed[completed.length - 1];
    this._strokes.delete(last.id);
    this.onStrokeRemoved?.(last.id);
    return last;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /** Validate all strokes and return any issues. */
  public validate(): AnnotationValidationIssue[] {
    const issues: AnnotationValidationIssue[] = [];

    if (this._strokes.size > MAX_STROKES) {
      issues.push({
        code: "too-many-strokes",
        message: `Annotation count (${this._strokes.size}) exceeds maximum (${MAX_STROKES}).`,
      });
    }

    for (const stroke of this._strokes.values()) {
      if (!stroke.completed) continue; // Only validate completed strokes
      if (stroke.points.length === 0) {
        issues.push({
          code: "empty-stroke",
          message: `Stroke "${stroke.id}" has no points.`,
          strokeId: stroke.id,
        });
      } else if (stroke.points.length === 1) {
        issues.push({
          code: "single-point",
          message: `Stroke "${stroke.id}" has only one point (not a line).`,
          strokeId: stroke.id,
        });
      }
    }

    return issues;
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  /**
   * Export all completed strokes as a serialisable snapshot.
   * In-progress strokes are excluded.
   */
  public export(): AnnotationSnapshot {
    return {
      strokes: this.getCompletedStrokes().map(s => ({
        id: s.id,
        points: s.points.map(p => ({ ...p })),
        style: { ...s.style },
        label: s.label,
      })),
    };
  }

  /**
   * Import strokes from a snapshot, replacing all existing strokes.
   */
  public import(snapshot: AnnotationSnapshot): void {
    this.clear();
    if (!snapshot || !Array.isArray(snapshot.strokes)) return;
    for (const s of snapshot.strokes) {
      const stroke: AnnotationStroke = {
        id: s.id,
        points: s.points.map(p => ({ ...p })),
        style: { ...s.style },
        label: s.label,
        completed: true,
      };
      this._strokes.set(stroke.id, stroke);
      // Update nextId to avoid collisions
      const numPart = parseInt(stroke.id.replace("stroke_", ""), 10);
      if (!isNaN(numPart) && numPart >= this._nextId) {
        this._nextId = numPart + 1;
      }
    }
  }

  // ── Snapshot / Restore (save system integration) ──────────────────────────

  public getSnapshot(): AnnotationSnapshot {
    return this.export();
  }

  public restoreSnapshot(state: AnnotationSnapshot): void {
    this.import(state);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Find all strokes whose bounding box contains the given point.
   * Useful for hit-testing in the editor UI.
   */
  public strokesAt(x: number, z: number, tolerance: number = 2): AnnotationStroke[] {
    return Array.from(this._strokes.values()).filter(stroke => {
      for (const p of stroke.points) {
        if (Math.abs(p.x - x) <= tolerance && Math.abs(p.z - z) <= tolerance) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Get the bounding box of all strokes.
   *
   * @returns `{ minX, minZ, maxX, maxZ }` or `null` if no strokes exist.
   */
  public getBounds(): { minX: number; minZ: number; maxX: number; maxZ: number } | null {
    if (this._strokes.size === 0) return null;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const stroke of this._strokes.values()) {
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.x > maxX) maxX = p.x;
        if (p.z > maxZ) maxZ = p.z;
      }
    }
    if (minX === Infinity) return null;
    return { minX, minZ, maxX, maxZ };
  }
}
