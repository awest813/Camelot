import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";

export type EditorGizmoMode = "position" | "rotation" | "scale";
export type EditorPlacementType = "marker" | "loot" | "npc-spawn" | "quest-marker" | "structure";
export type EditorTerrainTool = "none" | "sculpt" | "paint";

// ── Undo/redo command types ──────────────────────────────────────────────────

interface PlaceEntityCommand {
  type: "place";
  entry: MapExportEntry;
  patrolGroupId?: string;
}

interface RemoveEntityCommand {
  type: "remove";
  entry: MapExportEntry;
  patrolGroupId?: string;
}

interface SetPropertiesCommand {
  type: "set-properties";
  entityId: string;
  before: EditorEntityProperties;
  after: EditorEntityProperties;
}

interface MoveEntityCommand {
  type: "move";
  entityId: string;
  before: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } };
  after: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } };
}

type EditorCommand = PlaceEntityCommand | RemoveEntityCommand | SetPropertiesCommand | MoveEntityCommand;

export interface MapExportEntry {
  id: string;
  type: EditorPlacementType;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  patrolGroupId?: string;
  properties?: EditorEntityProperties;
}

export interface EditorEntityProperties {
  label?: string;
  lootTableId?: string;
  spawnTemplateId?: string;
  objectiveId?: string;
  dialogueTriggerId?: string;
  structureId?: string;
}

export interface MapExportData {
  version: 1;
  entries: MapExportEntry[];
  patrolRoutes: Array<{
    id: string;
    waypoints: Array<{ x: number; y: number; z: number }>;
  }>;
}

export interface MapValidationIssue {
  code:
    | "missing-patrol-group"
    | "patrol-route-too-short"
    | "entity-overlap"
    | "orphaned-quest-marker"
    | "duplicate-objective-id"
    | "unknown-objective-id"
    | "missing-loot-table"
    | "missing-spawn-template";
  message: string;
  entityIds?: string[];
  patrolGroupId?: string;
}

export interface MapValidationReport {
  isValid: boolean;
  issues: MapValidationIssue[];
}

/**
 * Optional cross-system reference tables for deeper validation.
 * When provided, the validator checks entity property references against
 * the supplied sets of known IDs.
 */
export interface MapValidationContext {
  /** Set of valid quest objective IDs from the quest system. */
  knownObjectiveIds?: ReadonlySet<string> | ReadonlyArray<string>;
  /** Set of valid loot table IDs from the loot table system. */
  knownLootTableIds?: ReadonlySet<string> | ReadonlyArray<string>;
  /** Set of valid NPC spawn template / archetype IDs. */
  knownSpawnTemplateIds?: ReadonlySet<string> | ReadonlyArray<string>;
}

interface EditorEntity {
  mesh: Mesh;
  type: EditorPlacementType;
  patrolGroupId?: string;
  properties: EditorEntityProperties;
}

interface PatrolGroup {
  id: string;
  waypoints: Vector3[];
  lineMesh: LinesMesh | null;
}

/** Colours used for each placement type in the editor viewport. */
const PLACEMENT_COLORS: Record<EditorPlacementType, Color3> = {
  marker:       new Color3(0.25, 0.70, 1.00),
  loot:         new Color3(1.00, 0.85, 0.10),
  "npc-spawn":  new Color3(1.00, 0.50, 0.05),
  "quest-marker": new Color3(0.15, 0.90, 0.30),
  structure:    new Color3(0.75, 0.25, 1.00),
};

/** Emissive contribution for each placement type (subtle glow). */
const PLACEMENT_EMISSIVE: Record<EditorPlacementType, Color3> = {
  marker:         new Color3(0.05, 0.15, 0.25),
  loot:           new Color3(0.20, 0.16, 0.00),
  "npc-spawn":    new Color3(0.20, 0.08, 0.00),
  "quest-marker": new Color3(0.00, 0.18, 0.06),
  structure:      new Color3(0.12, 0.00, 0.20),
};

const PLACEMENT_TYPE_ORDER: EditorPlacementType[] = [
  "marker",
  "loot",
  "npc-spawn",
  "quest-marker",
  "structure",
];

/**
 * Phase-1 + Phase-2 map editor:
 * - Runtime-safe edit mode toggle
 * - Transform gizmos with grid snapping
 * - Multi-type entity placement (marker, loot, NPC spawn, quest marker, structure)
 * - Patrol route authoring and visualization for NPC spawn groups
 * - JSON export / import for the full editor layout
 */
export class MapEditorSystem {
  public isEnabled: boolean = false;
  public snapSize: number = 1;
  public currentPlacementType: EditorPlacementType = "marker";
  public terrainTool: EditorTerrainTool = "none";
  public terrainSculptStep: number = 0.5;

  /**
   * Called whenever the selected entity changes.
   * Receives `null` when the selection is cleared.
   */
  public onEntitySelectionChanged:
    | ((entityId: string | null) => void)
    | null = null;

  private readonly scene: Scene;
  private readonly gizmoManager: GizmoManager;
  private readonly gridMesh: Mesh;
  private _mode: EditorGizmoMode = "position";
  private _entityCounter: number = 0;
  private _entities: EditorEntity[] = [];
  private _patrolGroups: Map<string, PatrolGroup> = new Map();
  private _activePatrolGroupId: string | null = null;
  private _patrolGroupCounter: number = 0;
  private _selectedEntityId: string | null = null;

  // ── Undo/redo stacks ─────────────────────────────────────────────────────
  private _undoStack: EditorCommand[] = [];
  private _redoStack: EditorCommand[] = [];
  private static readonly MAX_HISTORY = 100;
  /** Snapshot of the selected mesh position/rotation taken at drag-start. */
  private _preDragSnapshot: { position: Vector3; rotation: Vector3 } | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.gizmoManager = new GizmoManager(scene);
    this.gizmoManager.clearGizmoOnEmptyPointerEvent = false;
    this.gizmoManager.positionGizmoEnabled = true;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;

    const snapAxes = [
      this.gizmoManager.gizmos.positionGizmo?.xGizmo,
      this.gizmoManager.gizmos.positionGizmo?.yGizmo,
      this.gizmoManager.gizmos.positionGizmo?.zGizmo,
      this.gizmoManager.gizmos.scaleGizmo?.xGizmo,
      this.gizmoManager.gizmos.scaleGizmo?.yGizmo,
      this.gizmoManager.gizmos.scaleGizmo?.zGizmo,
    ];
    for (const ax of snapAxes) {
      ax?.dragBehavior.onDragStartObservable.add(() => this._captureDragSnapshot());
      ax?.dragBehavior.onDragEndObservable.add(() => {
        this._snapAttachedMesh();
        this._commitDragCommand();
      });
    }

    const rotAxes = [
      this.gizmoManager.gizmos.rotationGizmo?.xGizmo,
      this.gizmoManager.gizmos.rotationGizmo?.yGizmo,
      this.gizmoManager.gizmos.rotationGizmo?.zGizmo,
    ];
    for (const ax of rotAxes) {
      ax?.dragBehavior.onDragStartObservable.add(() => this._captureDragSnapshot());
      ax?.dragBehavior.onDragEndObservable.add(() => this._commitDragCommand());
    }

    this.gridMesh = this._createGridMesh();
    this.gridMesh.setEnabled(false);

    this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.isEnabled || pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;

      if (this.terrainTool !== "none") {
        this._applyTerrainToolFromPointer();
        return;
      }

      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
        if (!mesh || mesh === this.gridMesh) return false;
        return mesh.metadata?.editable === true;
      });

      if (pick?.hit && pick.pickedMesh) {
        this._selectMesh(pick.pickedMesh as Mesh);
      } else {
        this._clearSelection();
      }
    });
  }

  // ─── Mode / toggle ──────────────────────────────────────────────────────────

  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    this.gridMesh.setEnabled(this.isEnabled);
    if (!this.isEnabled) {
      this._clearSelection();
    }
    return this.isEnabled;
  }

  /** Returns the editor entity ID of the currently selected entity, or null. */
  get selectedEntityId(): string | null {
    return this._selectedEntityId;
  }

  /** Total number of entities currently placed in the editor. */
  get entityCount(): number {
    return this._entities.length;
  }

  /**
   * Returns a lightweight summary of every placed entity: `{ id, type }`.
   * Useful for hierarchy panels that only need to list names without reading
   * full property data.
   */
  listEntitySummaries(): Array<{ id: string; type: EditorPlacementType }> {
    return this._entities.map((e) => ({
      id: e.mesh.metadata?.editorEntityId ?? e.mesh.name,
      type: e.type,
    }));
  }

  /**
   * Programmatically select an entity by its editor entity ID.
   * Fires `onEntitySelectionChanged` if the selection changes.
   * Returns `true` if the entity was found and selected, `false` otherwise.
   */
  selectEntityById(entityId: string): boolean {
    const entity = this._findEntityById(entityId);
    if (!entity) return false;
    this._selectMesh(entity.mesh);
    return true;
  }

  // ─── Undo / redo ────────────────────────────────────────────────────────────

  /** Whether there are commands available to undo. */
  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /** Whether there are commands available to redo. */
  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /** Number of commands in each stack (`{ undo, redo }`). */
  get historySize(): { undo: number; redo: number } {
    return { undo: this._undoStack.length, redo: this._redoStack.length };
  }

  /**
   * Undo the most recent recorded editor command.
   * Returns `true` if a command was undone, `false` if the stack was empty.
   */
  undo(): boolean {
    const cmd = this._undoStack.pop();
    if (!cmd) return false;
    this._applyUndo(cmd);
    this._redoStack.push(cmd);
    return true;
  }

  /**
   * Redo the most recently undone editor command.
   * Returns `true` if a command was redone, `false` if the stack was empty.
   */
  redo(): boolean {
    const cmd = this._redoStack.pop();
    if (!cmd) return false;
    this._applyRedo(cmd);
    this._undoStack.push(cmd);
    return true;
  }

  cycleGizmoMode(): EditorGizmoMode {
    this._mode = this._mode === "position" ? "rotation" : this._mode === "rotation" ? "scale" : "position";
    this.gizmoManager.positionGizmoEnabled = this._mode === "position";
    this.gizmoManager.rotationGizmoEnabled = this._mode === "rotation";
    this.gizmoManager.scaleGizmoEnabled    = this._mode === "scale";
    return this._mode;
  }

  /** Directly set the gizmo mode without cycling through intermediate states. */
  setGizmoMode(mode: EditorGizmoMode): void {
    this._mode = mode;
    this.gizmoManager.positionGizmoEnabled = mode === "position";
    this.gizmoManager.rotationGizmoEnabled = mode === "rotation";
    this.gizmoManager.scaleGizmoEnabled    = mode === "scale";
  }

  get mode(): EditorGizmoMode {
    return this._mode;
  }

  cycleTerrainTool(): EditorTerrainTool {
    this.terrainTool = this.terrainTool === "none"
      ? "sculpt"
      : this.terrainTool === "sculpt"
        ? "paint"
        : "none";
    return this.terrainTool;
  }

  adjustTerrainSculptStep(delta: number): number {
    this.terrainSculptStep = Math.min(4, Math.max(0.1, this.terrainSculptStep + delta));
    return this.terrainSculptStep;
  }

  /** Advance to the next placement type and return it. */
  cyclePlacementType(): EditorPlacementType {
    const idx = PLACEMENT_TYPE_ORDER.indexOf(this.currentPlacementType);
    this.currentPlacementType = PLACEMENT_TYPE_ORDER[(idx + 1) % PLACEMENT_TYPE_ORDER.length];
    return this.currentPlacementType;
  }

  // ─── Entity placement ───────────────────────────────────────────────────────

  /**
   * Place a generic editor marker at `position` (Phase-1 API, kept for compatibility).
   * Internally delegates to `placeEntity` with type "marker".
   */
  placeMarkerAt(position: Vector3): Mesh {
    return this.placeEntity(position, "marker");
  }

  /**
   * Place an entity of `type` (defaults to `currentPlacementType`) at `position`.
   * NPC spawn points are automatically appended to the active patrol group if one exists.
   */
  placeEntity(position: Vector3, type: EditorPlacementType = this.currentPlacementType): Mesh {
    const snapped = this._snapVector(position);
    const id = `editor_entity_${this._entityCounter++}`;

    const mesh = this._buildEntityMesh(id, snapped, type);
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      editable: true,
      editorEntityId: id,
      editorType: type,
    };

    const entity: EditorEntity = { mesh, type, properties: {} };

    if (type === "npc-spawn" && this._activePatrolGroupId !== null) {
      entity.patrolGroupId = this._activePatrolGroupId;
      mesh.metadata.patrolGroupId = this._activePatrolGroupId;
      this._addWaypointToGroup(this._activePatrolGroupId, snapped);
    }

    mesh.metadata.editorProperties = entity.properties;

    this._entities.push(entity);
    this._selectMesh(mesh);

    this._pushCommand({
      type: "place",
      entry: {
        id,
        type,
        position: { x: snapped.x, y: snapped.y, z: snapped.z },
        rotation: { x: 0, y: 0, z: 0 },
      },
      patrolGroupId: entity.patrolGroupId,
    });

    return mesh;
  }

  getEntityProperties(entityId: string): Readonly<EditorEntityProperties> | null {
    return this._findEntityById(entityId)?.properties ?? null;
  }

  setEntityProperties(entityId: string, properties: EditorEntityProperties): boolean {
    const entity = this._findEntityById(entityId);
    if (!entity) return false;

    const before = { ...entity.properties };
    entity.properties = { ...entity.properties, ...properties };
    entity.mesh.metadata = {
      ...(entity.mesh.metadata ?? {}),
      editorProperties: entity.properties,
    };

    this._pushCommand({
      type: "set-properties",
      entityId,
      before,
      after: { ...entity.properties },
    });

    return true;
  }

  /**
   * Remove the entity with the given ID from the editor, disposing its mesh.
   * Returns true if the entity was found and removed, false otherwise.
   */
  removeEntity(entityId: string): boolean {
    const idx = this._entities.findIndex(
      (e) => e.mesh.metadata?.editorEntityId === entityId,
    );
    if (idx === -1) return false;

    const entity = this._entities[idx];
    const { x: px, y: py, z: pz } = entity.mesh.position;
    const { x: rx, y: ry, z: rz } = entity.mesh.rotation;

    if (this._selectedEntityId === entityId) {
      this._clearSelection();
    }

    this._pushCommand({
      type: "remove",
      entry: {
        id: entityId,
        type: entity.type,
        position: { x: px, y: py, z: pz },
        rotation: { x: rx, y: ry, z: rz },
        ...(Object.keys(entity.properties).length > 0 ? { properties: { ...entity.properties } } : {}),
      },
      patrolGroupId: entity.patrolGroupId,
    });

    entity.mesh.dispose();
    this._entities.splice(idx, 1);
    return true;
  }

  // ─── Patrol route authoring ─────────────────────────────────────────────────

  /**
   * Start a new named patrol group (for NPC spawn point chaining).
   * Any subsequent NPC-spawn placements are added to this group until
   * `startNewPatrolGroup` is called again or `_activePatrolGroupId` is cleared.
   * Returns the new group ID.
   */
  startNewPatrolGroup(): string {
    const id = `patrol_group_${this._patrolGroupCounter++}`;
    this._patrolGroups.set(id, { id, waypoints: [], lineMesh: null });
    this._activePatrolGroupId = id;
    return id;
  }

  /** Stop appending to any patrol group. */
  clearActivePatrolGroup(): void {
    this._activePatrolGroupId = null;
  }

  /** Returns a read-only snapshot of all patrol groups and their waypoints. */
  getPatrolGroups(): ReadonlyMap<string, Readonly<PatrolGroup>> {
    return this._patrolGroups as ReadonlyMap<string, Readonly<PatrolGroup>>;
  }

  get activePatrolGroupId(): string | null {
    return this._activePatrolGroupId;
  }

  /**
   * Record a move command explicitly (useful when transforms are applied
   * programmatically rather than via gizmo drag).
   * The caller is responsible for updating the mesh position/rotation to match
   * `after` before or after calling this.
   */
  recordMove(
    entityId: string,
    before: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } },
    after: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } },
  ): void {
    this._pushCommand({ type: "move", entityId, before, after });
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  /** Serialize the entire editor layout to a portable JSON-safe object. */
  exportMap(): MapExportData {
    const entries: MapExportEntry[] = this._entities.map((e) => ({
      id: e.mesh.metadata?.editorEntityId ?? e.mesh.name,
      type: e.type,
      position: {
        x: e.mesh.position.x,
        y: e.mesh.position.y,
        z: e.mesh.position.z,
      },
      rotation: {
        x: e.mesh.rotation.x,
        y: e.mesh.rotation.y,
        z: e.mesh.rotation.z,
      },
      ...(e.patrolGroupId !== undefined ? { patrolGroupId: e.patrolGroupId } : {}),
      ...(Object.keys(e.properties).length > 0 ? { properties: { ...e.properties } } : {}),
    }));

    const patrolRoutes = Array.from(this._patrolGroups.values()).map((g) => ({
      id: g.id,
      waypoints: g.waypoints.map((w) => ({ x: w.x, y: w.y, z: w.z })),
    }));

    return { version: 1, entries, patrolRoutes };
  }

  /**
   * Validate editor map data for common authoring issues before sharing.
   * - NPC spawns referencing missing patrol groups
   * - Patrol routes that have too few waypoints to form a route
   * - Entity overlap (same/near-identical position)
   * - Quest markers with no objectiveId set (orphaned)
   * - Quest markers sharing the same objectiveId (duplicate)
   * - Loot entities referencing unknown loot table IDs (requires context)
   * - NPC spawns referencing unknown spawn template IDs (requires context)
   */
  validateMap(minEntitySpacing: number = 0.5, context?: MapValidationContext): MapValidationReport {
    const issues: MapValidationIssue[] = [];
    const data = this.exportMap();
    const patrolGroupIds = new Set(data.patrolRoutes.map((route) => route.id));

    // ── Missing patrol group ───────────────────────────────────────────────
    for (const entry of data.entries) {
      if (entry.type !== "npc-spawn" || !entry.patrolGroupId) continue;
      if (!patrolGroupIds.has(entry.patrolGroupId)) {
        issues.push({
          code: "missing-patrol-group",
          message: `NPC spawn '${entry.id}' references missing patrol group '${entry.patrolGroupId}'.`,
          entityIds: [entry.id],
          patrolGroupId: entry.patrolGroupId,
        });
      }
    }

    // ── Patrol route too short ─────────────────────────────────────────────
    for (const route of data.patrolRoutes) {
      if (route.waypoints.length >= 2) continue;
      issues.push({
        code: "patrol-route-too-short",
        message: `Patrol group '${route.id}' has ${route.waypoints.length} waypoint(s); at least 2 are required.`,
        patrolGroupId: route.id,
      });
    }

    // ── Entity overlap ────────────────────────────────────────────────────
    for (let i = 0; i < data.entries.length; i++) {
      for (let j = i + 1; j < data.entries.length; j++) {
        const a = data.entries[i];
        const b = data.entries[j];
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const dz = a.position.z - b.position.z;
        const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
        if (distance > minEntitySpacing) continue;
        issues.push({
          code: "entity-overlap",
          message: `Entities '${a.id}' and '${b.id}' overlap (distance ${distance.toFixed(2)}).`,
          entityIds: [a.id, b.id],
        });
      }
    }

    // ── Orphaned quest markers (no objectiveId) ────────────────────────────
    for (const entry of data.entries) {
      if (entry.type !== "quest-marker") continue;
      if (!entry.properties?.objectiveId) {
        issues.push({
          code: "orphaned-quest-marker",
          message: `Quest marker '${entry.id}' has no objectiveId set.`,
          entityIds: [entry.id],
        });
      }
    }

    // ── Duplicate objectiveIds across quest markers ────────────────────────
    const objectiveIdCount = new Map<string, string[]>();
    for (const entry of data.entries) {
      if (entry.type !== "quest-marker" || !entry.properties?.objectiveId) continue;
      const oid = entry.properties.objectiveId;
      const existing = objectiveIdCount.get(oid) ?? [];
      existing.push(entry.id);
      objectiveIdCount.set(oid, existing);
    }
    for (const [oid, ids] of objectiveIdCount) {
      if (ids.length < 2) continue;
      issues.push({
        code: "duplicate-objective-id",
        message: `ObjectiveId '${oid}' is used by ${ids.length} quest markers: ${ids.join(", ")}.`,
        entityIds: ids,
      });
    }

    if (context) {
      const knownObjIds   = context.knownObjectiveIds    ? new Set(context.knownObjectiveIds)    : null;
      const knownLootIds  = context.knownLootTableIds    ? new Set(context.knownLootTableIds)    : null;
      const knownSpawnIds = context.knownSpawnTemplateIds ? new Set(context.knownSpawnTemplateIds) : null;

      for (const entry of data.entries) {
        // ── Invalid cross-system: objectiveId ────────────────────────────
        if (knownObjIds && entry.type === "quest-marker" && entry.properties?.objectiveId) {
          if (!knownObjIds.has(entry.properties.objectiveId)) {
            issues.push({
              code: "unknown-objective-id",
              message: `Quest marker '${entry.id}' references unknown objectiveId '${entry.properties.objectiveId}'.`,
              entityIds: [entry.id],
            });
          }
        }

        // ── Invalid cross-system: lootTableId ────────────────────────────
        if (knownLootIds && entry.type === "loot" && entry.properties?.lootTableId) {
          if (!knownLootIds.has(entry.properties.lootTableId)) {
            issues.push({
              code: "missing-loot-table",
              message: `Loot entity '${entry.id}' references unknown loot table '${entry.properties.lootTableId}'.`,
              entityIds: [entry.id],
            });
          }
        }

        // ── Invalid cross-system: spawnTemplateId ─────────────────────────
        if (knownSpawnIds && entry.type === "npc-spawn" && entry.properties?.spawnTemplateId) {
          if (!knownSpawnIds.has(entry.properties.spawnTemplateId)) {
            issues.push({
              code: "missing-spawn-template",
              message: `NPC spawn '${entry.id}' references unknown spawn template '${entry.properties.spawnTemplateId}'.`,
              entityIds: [entry.id],
            });
          }
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Re-create editor entities from a previously exported layout.
   * Existing entities are preserved; duplicate IDs are skipped.
   */
  importMap(data: MapExportData): void {
    const existingIds = new Set(this._entities.map((e) => e.mesh.metadata?.editorEntityId));

    for (const entry of data.entries) {
      if (existingIds.has(entry.id)) continue;
      const pos = new Vector3(entry.position.x, entry.position.y, entry.position.z);
      const mesh = this._buildEntityMesh(entry.id, pos, entry.type);
      mesh.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z);
      mesh.metadata = {
        editable: true,
        editorEntityId: entry.id,
        editorType: entry.type,
        ...(entry.patrolGroupId !== undefined ? { patrolGroupId: entry.patrolGroupId } : {}),
        ...(entry.properties !== undefined ? { editorProperties: { ...entry.properties } } : {}),
      };
      this._entities.push({
        mesh,
        type: entry.type,
        patrolGroupId: entry.patrolGroupId,
        properties: { ...(entry.properties ?? {}) },
      });
    }

    for (const route of data.patrolRoutes) {
      if (this._patrolGroups.has(route.id)) continue;
      const waypoints = route.waypoints.map((w) => new Vector3(w.x, w.y, w.z));
      const group: PatrolGroup = { id: route.id, waypoints, lineMesh: null };
      this._patrolGroups.set(route.id, group);
      this._refreshRouteVisualization(route.id);
    }
  }

  /**
   * Import a map layout from a raw JSON string.
   * Returns `true` on success, `false` if the string is not valid JSON or not
   * a recognised MapExportData structure.
   */
  importFromJson(json: string): boolean {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return false;
    }

    if (!this._isMapExportData(parsed)) return false;
    this.importMap(parsed as MapExportData);
    return true;
  }

  /**
   * Import a map layout from a browser File object (e.g. from an
   * `<input type="file">` element).  Returns a Promise that resolves to `true`
   * on success and `false` on parse / structure errors.
   */
  importFromFile(file: File): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(this.importFromJson(text));
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }

  /**
   * Serialize the current editor layout to a JSON file and trigger a browser
   * download.  No-ops in non-browser (headless / SSR) environments.
   *
   * @param filename  Optional filename override (defaults to a timestamped name).
   */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return; // headless / SSR guard

    const json = JSON.stringify(this.exportMap(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `camelot_map_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  /** Remove all editor entities and patrol visualizations from the scene. */
  clearAll(): void {
    for (const entity of this._entities) {
      entity.mesh.dispose();
    }
    this._entities = [];

    for (const group of this._patrolGroups.values()) {
      group.lineMesh?.dispose();
    }
    this._patrolGroups.clear();
    this._activePatrolGroupId = null;
    this._clearSelection();
    this._undoStack = [];
    this._redoStack = [];
  }


  // ─── Private helpers ────────────────────────────────────────────────────────

  private _selectMesh(mesh: Mesh): void {
    this.gizmoManager.attachToMesh(mesh);
    const newId = mesh.metadata?.editorEntityId as string | undefined ?? null;
    if (newId !== this._selectedEntityId) {
      this._selectedEntityId = newId;
      this.onEntitySelectionChanged?.(this._selectedEntityId);
    }
  }

  private _clearSelection(): void {
    this.gizmoManager.attachToMesh(null);
    if (this._selectedEntityId !== null) {
      this._selectedEntityId = null;
      this.onEntitySelectionChanged?.(null);
    }
  }

  private _buildEntityMesh(id: string, position: Vector3, type: EditorPlacementType): Mesh {
    let mesh: Mesh;

    switch (type) {
      case "loot":
        mesh = MeshBuilder.CreateSphere(id, { diameter: 0.8 }, this.scene);
        break;
      case "npc-spawn":
        mesh = MeshBuilder.CreateCapsule(id, { radius: 0.4, height: 1.6 }, this.scene);
        break;
      case "quest-marker":
        mesh = MeshBuilder.CreateCylinder(id, { height: 1.2, diameter: 0.6, tessellation: 6 }, this.scene);
        break;
      case "structure":
        mesh = MeshBuilder.CreateBox(id, { size: 1.5 }, this.scene);
        break;
      case "marker":
      default:
        mesh = MeshBuilder.CreateBox(id, { size: 1 }, this.scene);
        break;
    }

    mesh.position = position.clone();

    const mat = new StandardMaterial(`${id}_mat`, this.scene);
    mat.diffuseColor  = PLACEMENT_COLORS[type].clone();
    mat.emissiveColor = PLACEMENT_EMISSIVE[type].clone();
    mesh.material = mat;

    return mesh;
  }

  private _addWaypointToGroup(groupId: string, position: Vector3): void {
    const group = this._patrolGroups.get(groupId);
    if (!group) return;
    group.waypoints.push(position.clone());
    this._refreshRouteVisualization(groupId);
  }

  private _refreshRouteVisualization(groupId: string): void {
    const group = this._patrolGroups.get(groupId);
    if (!group || group.waypoints.length < 2) return;

    group.lineMesh?.dispose();

    const lines: Vector3[][] = [];
    for (let i = 0; i < group.waypoints.length; i++) {
      const from = group.waypoints[i];
      const to   = group.waypoints[(i + 1) % group.waypoints.length];
      lines.push([from.add(new Vector3(0, 0.1, 0)), to.add(new Vector3(0, 0.1, 0))]);
    }

    const lineMesh = MeshBuilder.CreateLineSystem(
      `${groupId}_route`,
      { lines, updatable: false },
      this.scene,
    ) as LinesMesh;
    lineMesh.color = PLACEMENT_COLORS["npc-spawn"].clone();
    lineMesh.isPickable = false;
    group.lineMesh = lineMesh;
  }

  private _snapAttachedMesh(): void {
    const attached = this.gizmoManager.attachedMesh;
    if (!attached) return;
    attached.position = this._snapVector(attached.position);
  }

  private _snapVector(value: Vector3): Vector3 {
    const s = this.snapSize;
    return new Vector3(
      Math.round(value.x / s) * s,
      Math.round(value.y / s) * s,
      Math.round(value.z / s) * s,
    );
  }

  private _findEntityById(entityId: string): EditorEntity | undefined {
    return this._entities.find((entity) => {
      return entity.mesh.metadata?.editorEntityId === entityId;
    });
  }

  private _isMapExportData(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    if (v["version"] !== 1) return false;
    if (!Array.isArray(v["entries"])) return false;
    if (!Array.isArray(v["patrolRoutes"])) return false;
    return true;
  }

  // ── Undo/redo internals ──────────────────────────────────────────────────

  private _pushCommand(cmd: EditorCommand): void {
    this._undoStack.push(cmd);
    if (this._undoStack.length > MapEditorSystem.MAX_HISTORY) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  private _captureDragSnapshot(): void {
    const attached = this.gizmoManager.attachedMesh;
    if (!attached) return;
    this._preDragSnapshot = {
      position: attached.position.clone(),
      rotation: attached.rotation.clone(),
    };
  }

  private _commitDragCommand(): void {
    const attached = this.gizmoManager.attachedMesh;
    if (!attached || !this._preDragSnapshot) return;
    const entityId = attached.metadata?.editorEntityId as string | undefined;
    if (!entityId) return;

    const before = this._preDragSnapshot;
    const after = {
      position: attached.position.clone(),
      rotation: attached.rotation.clone(),
    };
    this._preDragSnapshot = null;

    const posChanged =
      Math.abs(before.position.x - after.position.x) > 1e-6 ||
      Math.abs(before.position.y - after.position.y) > 1e-6 ||
      Math.abs(before.position.z - after.position.z) > 1e-6;
    const rotChanged =
      Math.abs(before.rotation.x - after.rotation.x) > 1e-6 ||
      Math.abs(before.rotation.y - after.rotation.y) > 1e-6 ||
      Math.abs(before.rotation.z - after.rotation.z) > 1e-6;

    if (!posChanged && !rotChanged) return;

    this._pushCommand({
      type: "move",
      entityId,
      before: {
        position: { x: before.position.x, y: before.position.y, z: before.position.z },
        rotation: { x: before.rotation.x, y: before.rotation.y, z: before.rotation.z },
      },
      after: {
        position: { x: after.position.x, y: after.position.y, z: after.position.z },
        rotation: { x: after.rotation.x, y: after.rotation.y, z: after.rotation.z },
      },
    });
  }

  private _applyUndo(cmd: EditorCommand): void {
    switch (cmd.type) {
      case "place":
        this._removeEntityById(cmd.entry.id);
        break;
      case "remove":
        this._restoreEntity(cmd.entry, cmd.patrolGroupId);
        break;
      case "set-properties": {
        const entity = this._findEntityById(cmd.entityId);
        if (!entity) break;
        entity.properties = { ...cmd.before };
        entity.mesh.metadata = { ...(entity.mesh.metadata ?? {}), editorProperties: entity.properties };
        break;
      }
      case "move": {
        const entity = this._findEntityById(cmd.entityId);
        if (!entity) break;
        entity.mesh.position.set(cmd.before.position.x, cmd.before.position.y, cmd.before.position.z);
        entity.mesh.rotation.set(cmd.before.rotation.x, cmd.before.rotation.y, cmd.before.rotation.z);
        break;
      }
    }
  }

  private _applyRedo(cmd: EditorCommand): void {
    switch (cmd.type) {
      case "place":
        this._restoreEntity(cmd.entry, cmd.patrolGroupId);
        break;
      case "remove":
        this._removeEntityById(cmd.entry.id);
        break;
      case "set-properties": {
        const entity = this._findEntityById(cmd.entityId);
        if (!entity) break;
        entity.properties = { ...cmd.after };
        entity.mesh.metadata = { ...(entity.mesh.metadata ?? {}), editorProperties: entity.properties };
        break;
      }
      case "move": {
        const entity = this._findEntityById(cmd.entityId);
        if (!entity) break;
        entity.mesh.position.set(cmd.after.position.x, cmd.after.position.y, cmd.after.position.z);
        entity.mesh.rotation.set(cmd.after.rotation.x, cmd.after.rotation.y, cmd.after.rotation.z);
        break;
      }
    }
  }

  private _removeEntityById(entityId: string): void {
    const idx = this._entities.findIndex(
      (e) => e.mesh.metadata?.editorEntityId === entityId,
    );
    if (idx === -1) return;
    const entity = this._entities[idx];
    if (this._selectedEntityId === entityId) this._clearSelection();
    entity.mesh.dispose();
    this._entities.splice(idx, 1);
  }

  private _restoreEntity(entry: MapExportEntry, patrolGroupId?: string): void {
    const pos = new Vector3(entry.position.x, entry.position.y, entry.position.z);
    const mesh = this._buildEntityMesh(entry.id, pos, entry.type);
    mesh.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z);
    mesh.metadata = {
      editable: true,
      editorEntityId: entry.id,
      editorType: entry.type,
      ...(patrolGroupId !== undefined ? { patrolGroupId } : {}),
      ...(entry.properties !== undefined ? { editorProperties: { ...entry.properties } } : {}),
    };
    this._entities.push({
      mesh,
      type: entry.type,
      patrolGroupId,
      properties: { ...(entry.properties ?? {}) },
    });
  }

  private _createGridMesh(): Mesh {
    const lines: Vector3[][] = [];
    const half = 50;
    for (let i = -half; i <= half; i++) {
      lines.push([new Vector3(-half, 0.05, i), new Vector3(half, 0.05, i)]);
      lines.push([new Vector3(i, 0.05, -half), new Vector3(i, 0.05, half)]);
    }
    const grid = MeshBuilder.CreateLineSystem("editor_grid", { lines, updatable: false }, this.scene);
    grid.color = new Color3(0.2, 0.6, 0.9);
    grid.isPickable = false;
    return grid;
  }

  applyTerrainToolToMesh(mesh: Mesh): void {
    if (this.terrainTool === "none") return;

    if (this.terrainTool === "sculpt") {
      mesh.position.y += this.terrainSculptStep;
      return;
    }

    const sourceMat = mesh.material;
    const mat = sourceMat instanceof StandardMaterial
      ? sourceMat
      : new StandardMaterial(`${mesh.name}_paint`, this.scene);

    if (mesh.material !== mat) {
      mesh.material = mat;
    }

    const next = (mat.diffuseColor ?? new Color3(0.3, 0.7, 0.3)).clone();
    next.r = Math.min(1, next.r + 0.05);
    next.g = Math.max(0.1, next.g - 0.05);
    next.b = Math.max(0.1, next.b - 0.03);
    mat.diffuseColor = next;
  }

  private _applyTerrainToolFromPointer(): void {
    const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
      return Boolean(mesh?.name?.startsWith("chunk_"));
    });
    if (!pick?.hit || !pick.pickedMesh) return;

    this.applyTerrainToolToMesh(pick.pickedMesh as Mesh);
  }
}
