import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { BoundingBox } from "@babylonjs/core/Culling/boundingBox";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/** A chunk's frozen props, and the box around them all. */
interface Group {
  meshes: Set<AbstractMesh>;
  box: BoundingBox | null;
  dirty: boolean;
  culled: boolean;
}

/**
 * Chunk-level culling for the frame's mesh selection.  Babylon tests every
 * mesh in the scene against the view each frame (a village loads over two
 * thousand, most of them props that never move).  The props a chunk places
 * are grouped by chunk; a group whose box lies wholly outside the view is
 * left out of the frame's candidates at the cost of one box test, instead of
 * one test per prop.  Everything else (NPCs, the player's view model, the
 * sky…) is a candidate as before.
 *
 * Only frozen props belong in a group: their bounds never change, so the
 * group's box stays true.
 */
export class ChunkCuller {
  private readonly _groups = new Map<string, Group>();
  private readonly _groupOf = new WeakMap<AbstractMesh, Group>();
  private readonly _out: AbstractMesh[] = [];
  private readonly _candidates = { data: this._out, length: 0 };
  private readonly _min = new Vector3();
  private readonly _max = new Vector3();

  constructor(private readonly _scene: Scene) {
    const scene = _scene as unknown as { getActiveMeshCandidates: () => { data: AbstractMesh[]; length: number } };
    scene.getActiveMeshCandidates = () => this._select();
  }

  /** Props of chunk `key`, placed for good (frozen). */
  public add(key: string, meshes: readonly AbstractMesh[]): void {
    let g = this._groups.get(key);
    if (!g) this._groups.set(key, (g = { meshes: new Set(), box: null, dirty: true, culled: false }));
    for (const m of meshes) {
      if (m.alwaysSelectAsActiveMesh) continue;
      g.meshes.add(m);
      this._groupOf.set(m, g);
    }
    g.dirty = true;
  }

  /** These props are gone (their chunk unloaded, or they were taken). */
  public forget(key: string, meshes: readonly AbstractMesh[]): void {
    const g = this._groups.get(key);
    if (!g) return;
    for (const m of meshes) { g.meshes.delete(m); this._groupOf.delete(m); }
    if (g.meshes.size === 0) this._groups.delete(key);
    else g.dirty = true;
  }

  /** How many chunk groups the last frame left out (for tests and the census). */
  public get culledGroups(): number {
    let n = 0;
    for (const g of this._groups.values()) if (g.culled) n++;
    return n;
  }

  private _select(): { data: AbstractMesh[]; length: number } {
    const planes = this._scene.frustumPlanes;
    for (const g of this._groups.values()) {
      if (g.dirty) this._rebox(g);
      const culled = !!g.box && !!planes && !g.box.isInFrustum(planes);
      if (culled && !g.culled) {
        // Out of the selection, so the scene won't reset this for them.
        for (const m of g.meshes) m._internalAbstractMeshDataInfo._wasActiveLastFrame = false;
      }
      g.culled = culled;
    }
    const out = this._out;
    out.length = 0;
    for (const m of this._scene.meshes) {
      const g = this._groupOf.get(m);
      if (!g || !g.culled) out.push(m);
    }
    this._candidates.length = out.length;
    return this._candidates;
  }

  private _rebox(g: Group): void {
    g.dirty = false;
    const min = this._min.setAll(Number.POSITIVE_INFINITY), max = this._max.setAll(Number.NEGATIVE_INFINITY);
    for (const m of g.meshes) {
      const b = m.getBoundingInfo().boundingBox;
      min.minimizeInPlace(b.minimumWorld);
      max.maximizeInPlace(b.maximumWorld);
    }
    g.box = Number.isFinite(min.x) ? new BoundingBox(min.clone(), max.clone()) : null;
  }
}
