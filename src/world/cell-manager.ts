import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Player } from "../entities/player";

export type CellType = "exterior" | "interior";

export interface CellDefinition {
  id: string;
  name: string;
  type: CellType;
  /** Default spawn position when entering this cell without a specific portal. */
  spawnPosition: Vector3;
  /**
   * Builder function invoked when the player first enters an interior cell.
   * Must return an array of all Mesh objects it creates so they can be
   * disposed on exit.
   */
  build?: (scene: Scene) => Mesh[];
}

export interface Portal {
  id: string;
  mesh: Mesh;
  targetCellId: string;
  targetPosition: Vector3;
  labelText: string;
}

export interface CellSaveState {
  currentCellId: string;
  visitedCellIds: string[];
}

/**
 * Manages Oblivion-style cell (level) transitions.
 *
 * World layout:
 *   - "exterior"   = the streamed chunk world managed by WorldManager.
 *   - interior cells = compact rooms/dungeons built on demand when entered.
 *
 * Portals:
 *   Portals are thin box meshes tagged with `metadata.type = "portal"`.
 *   The InteractionSystem detects them via raycast and calls `tryTransition()`.
 *
 * Transition sequence:
 *   1. Player interacts with portal mesh (E-key).
 *   2. `tryTransition(portalId)` is called.
 *   3. Active interior meshes are disposed.
 *   4. Target cell's `build()` is called (if interior).
 *   5. Player is teleported to the portal's `targetPosition`.
 *   6. `onCellChanged` fires so the UI can update the location name.
 */
export class CellManager {
  private _scene: Scene;
  private _player: Player;

  private _cells: Map<string, CellDefinition> = new Map();
  private _portals: Map<string, Portal> = new Map();
  private _currentCellId: string = "exterior";
  private _visitedCellIds: Set<string> = new Set(["exterior"]);
  private _activeCellMeshes: Mesh[] = [];
  private _isTransitioning: boolean = false;

  /** Fired after each successful cell transition with (cellId, cellName). */
  public onCellChanged: ((cellId: string, cellName: string) => void) | null = null;

  constructor(scene: Scene, player: Player) {
    this._scene  = scene;
    this._player = player;

    // The exterior world is always pre-registered
    this._cells.set("exterior", {
      id:            "exterior",
      name:          "Exterior World",
      type:          "exterior",
      spawnPosition: new Vector3(0, 5, 0),
    });
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  public get currentCellId(): string {
    return this._currentCellId;
  }

  public get currentCell(): CellDefinition | undefined {
    return this._cells.get(this._currentCellId);
  }

  public get isInterior(): boolean {
    return this.currentCell?.type === "interior";
  }

  public get isTransitioning(): boolean {
    return this._isTransitioning;
  }

  public get portals(): Map<string, Portal> {
    return this._portals;
  }

  public get visitedCellIds(): string[] {
    return Array.from(this._visitedCellIds);
  }

  // ── Registration ───────────────────────────────────────────────────────────

  /** Register or overwrite a cell definition. */
  public registerCell(def: CellDefinition): void {
    this._cells.set(def.id, def);
  }

  /**
   * Spawn a portal mesh in the world.
   * The mesh gets `metadata = { type: "portal", portal }` so the
   * InteractionSystem can detect it via raycast.
   *
   * @param id             Unique portal ID.
   * @param position       World position for the portal mesh.
   * @param targetCellId   Cell to transition to.
   * @param targetPosition Where the player spawns in the target cell.
   * @param labelText      Text shown in the interaction prompt.
   */
  public spawnPortal(
    id: string,
    position: Vector3,
    targetCellId: string,
    targetPosition: Vector3,
    labelText: string = "Enter",
  ): Portal {
    const mesh = MeshBuilder.CreateBox(
      `portal_${id}`,
      { width: 1.2, height: 2.2, depth: 0.2 },
      this._scene,
    );
    mesh.position = position.clone();

    const mat = new StandardMaterial(`portalMat_${id}`, this._scene);
    mat.diffuseColor  = new Color3(0.30, 0.50, 0.80);
    mat.emissiveColor = new Color3(0.05, 0.10, 0.25);
    mat.alpha = 0.75;
    mesh.material = mat;

    const portal: Portal = {
      id,
      mesh,
      targetCellId,
      targetPosition: targetPosition.clone(),
      labelText,
    };
    mesh.metadata = { type: "portal", portal };
    this._portals.set(id, portal);
    return portal;
  }

  // ── Transition ─────────────────────────────────────────────────────────────

  /**
   * Transition through a portal.  Returns `true` on success.
   *
   * The method is intentionally synchronous for simplicity.
   * A fade-to-black effect can be layered on top by the caller reacting to
   * `onCellChanged` (e.g. post-process overlay).
   */
  public tryTransition(portalId: string): boolean {
    if (this._isTransitioning) return false;

    const portal    = this._portals.get(portalId);
    const targetDef = portal ? this._cells.get(portal.targetCellId) : undefined;
    if (!portal || !targetDef) return false;

    this._isTransitioning = true;

    // Tear down any active interior meshes
    this._disposeActiveCellMeshes();

    // Build the target cell if it is an interior with a builder
    if (targetDef.type === "interior" && targetDef.build) {
      this._activeCellMeshes = targetDef.build(this._scene);
    }

    // Teleport the player
    this._player.camera.position.copyFrom(portal.targetPosition);
    this._currentCellId = targetDef.id;
    this._visitedCellIds.add(targetDef.id);

    this._isTransitioning = false;
    this.onCellChanged?.(targetDef.id, targetDef.name);
    return true;
  }

  // ── Built-in interior templates ───────────────────────────────────────────

  /**
   * Register a simple cave-style interior cell and place an exit portal inside it.
   *
   * Registers the cell exactly once with a single builder that constructs the
   * room geometry AND the exit portal so there's no duplicate registration.
   *
   * @param cellId           ID for the new interior cell.
   * @param cellName         Display name shown on transition.
   * @param entrancePortalId ID of the entrance portal in the exterior world.
   * @param entrancePosition Portal mesh position in the exterior world.
   * @param returnPosition   Where the player spawns when exiting back to exterior.
   */
  public buildSimpleInterior(
    cellId: string,
    cellName: string,
    entrancePortalId: string,
    entrancePosition: Vector3,
    returnPosition: Vector3,
  ): void {
    const exitId = `exit_${cellId}`;

    this.registerCell({
      id:            cellId,
      name:          cellName,
      type:          "interior",
      spawnPosition: new Vector3(0, 1, 3),
      build: (scene) => {
        const meshes = this._buildSimpleRoom(cellId, scene);

        // Spawn the exit portal inside the cell and include its mesh so it
        // is disposed when the player leaves.
        const exitPortal = this.spawnPortal(
          exitId,
          new Vector3(0, 1, -5.5),
          "exterior",
          returnPosition,
          "Exit",
        );
        meshes.push(exitPortal.mesh);
        return meshes;
      },
    });

    // Entrance portal in the exterior world
    this.spawnPortal(entrancePortalId, entrancePosition, cellId, new Vector3(0, 1, 3), "Enter " + cellName);
  }

  /**
   * Shared room-geometry builder used by `buildSimpleInterior`.
   * Creates floor, ceiling, and four walls; returns the mesh array.
   */
  private _buildSimpleRoom(cellId: string, scene: Scene): Mesh[] {
    const meshes: Mesh[] = [];

    const floorMat = new StandardMaterial("intFloor_" + cellId, scene);
    floorMat.diffuseColor = new Color3(0.35, 0.30, 0.25);
    const wallMat  = new StandardMaterial("intWall_"  + cellId, scene);
    wallMat.diffuseColor  = new Color3(0.30, 0.28, 0.25);

    const floor = MeshBuilder.CreateBox("floor_" + cellId, { width: 12, height: 0.2, depth: 12 }, scene);
    floor.position.y = 0;
    floor.material   = floorMat;
    meshes.push(floor);

    const ceiling = MeshBuilder.CreateBox("ceiling_" + cellId, { width: 12, height: 0.2, depth: 12 }, scene);
    ceiling.position.y = 3;
    ceiling.material   = floorMat;
    meshes.push(ceiling);

    const wallDefs = [
      { x:  0,  y: 1.5, z:  6,  w: 12,  d: 0.3 },
      { x:  0,  y: 1.5, z: -6,  w: 12,  d: 0.3 },
      { x:  6,  y: 1.5, z:  0,  w: 0.3, d: 12  },
      { x: -6,  y: 1.5, z:  0,  w: 0.3, d: 12  },
    ];
    for (const wd of wallDefs) {
      const wall = MeshBuilder.CreateBox("wall_" + cellId, { width: wd.w, height: 3, depth: wd.d }, scene);
      wall.position = new Vector3(wd.x, wd.y, wd.z);
      wall.material = wallMat;
      meshes.push(wall);
    }
    return meshes;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): CellSaveState {
    return {
      currentCellId:  this._currentCellId,
      visitedCellIds: Array.from(this._visitedCellIds),
    };
  }

  public restoreFromSave(state: CellSaveState): void {
    if (typeof state?.currentCellId === "string") {
      this._currentCellId = state.currentCellId;
    }
    if (Array.isArray(state?.visitedCellIds)) {
      this._visitedCellIds = new Set(state.visitedCellIds);
    }
  }

  /**
   * Rebuild interior meshes to match `currentCellId` after load or other
   * out-of-band state changes. Does not fire `onCellChanged`.
   */
  public hydrateActiveCellFromState(): void {
    this._disposeActiveCellMeshes();
    const def = this._cells.get(this._currentCellId);
    if (def?.type === "interior" && def.build) {
      this._activeCellMeshes = def.build(this._scene);
    }
  }

  /** Look up a registered cell by id (exterior or interior). */
  public getCellDefinition(id: string): CellDefinition | undefined {
    return this._cells.get(id);
  }

  /**
   * Move the player into a cell without using a portal (e.g. fast travel).
   * Rebuilds interior geometry when entering an interior from elsewhere.
   *
   * @param silent  When true, `onCellChanged` is not fired (caller handles UI).
   */
  public enterCellById(cellId: string, arrivalPosition: Vector3, silent: boolean = false): boolean {
    if (this._isTransitioning) return false;

    const targetDef = this._cells.get(cellId);
    if (!targetDef) return false;

    if (this._currentCellId === cellId && targetDef.type === "interior") {
      this._player.camera.position.copyFrom(arrivalPosition);
      return true;
    }

    this._isTransitioning = true;
    this._disposeActiveCellMeshes();

    if (targetDef.type === "interior" && targetDef.build) {
      this._activeCellMeshes = targetDef.build(this._scene);
    }

    this._player.camera.position.copyFrom(arrivalPosition);
    this._currentCellId = targetDef.id;
    this._visitedCellIds.add(targetDef.id);

    this._isTransitioning = false;

    if (!silent) {
      this.onCellChanged?.(targetDef.id, targetDef.name);
    }
    return true;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _disposeActiveCellMeshes(): void {
    for (const mesh of this._activeCellMeshes) {
      if (!mesh.isDisposed()) mesh.dispose();
    }
    this._activeCellMeshes = [];
  }
}
