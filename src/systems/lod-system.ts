import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import type { QualityTier } from "./graphics-system";

export interface LodEntry {
  mesh: AbstractMesh;
  cullDistance: number;
}

export interface LodLevel {
  mesh: AbstractMesh;
  maxDistance: number;
}

/** A whole node hierarchy (e.g. a glTF asset root) culled by distance as one. */
interface LodHierarchyEntry {
  root: AbstractMesh;
  cullDistance: number;
  /** Bounding centre of a static (unparented) hierarchy, captured at registration. */
  center: Vector3 | null;
  culled: boolean;
}

interface LodLevelEntry {
  levels: LodLevel[];
}

interface CullPriority {
  mesh: AbstractMesh;
  distanceSq: number;
}

export enum LODQuality {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  ULTRA = 3,
}

export interface LODConfig {
  updateEveryNFrames: number;
  frustumCull: boolean;
  priorityCull: boolean;
  maxCulledPerFrame: number;
  distanceThresholds: {
    near: number;
    medium: number;
    far: number;
    ultraFar: number;
  };
}

const DEFAULT_CONFIG: LODConfig = {
  updateEveryNFrames: 5,
  frustumCull: true,
  priorityCull: true,
  maxCulledPerFrame: 100,
  distanceThresholds: {
    near: 30,
    medium: 80,
    far: 150,
    ultraFar: 250,
  },
};

export class LodSystem {
  private _entries: LodEntry[] = [];
  private _hierarchies: LodHierarchyEntry[] = [];
  private _levelGroups: LodLevelEntry[] = [];
  private _frameCounter: number = 0;
  private _updateInterval: number;
  private _config: LODConfig;
  private _camera: Camera | null = null;
  private _frustumPlanes: Plane[] = [];
  private _lastCulled: number = 0;

  constructor(config?: Partial<LODConfig>) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._updateInterval = Math.max(1, this._config.updateEveryNFrames);
  }

  public setCamera(camera: Camera): void {
    this._camera = camera;
  }

  public setConfig(config: Partial<LODConfig>): void {
    this._config = { ...this._config, ...config };
    if (config.updateEveryNFrames !== undefined) {
      this._updateInterval = Math.max(1, this._config.updateEveryNFrames);
    }
  }

  public getConfig(): Readonly<LODConfig> {
    return this._config;
  }

  /**
   * Configure distance culling thresholds and update frequency based on a
   * graphics quality tier or LODQuality enum value.
   */
  public setQuality(quality: QualityTier | LODQuality): void {
    const isLow = quality === "low" || quality === LODQuality.LOW;
    const isMed = quality === "medium" || quality === LODQuality.MEDIUM;
    const isUltra = quality === "ultra" || quality === LODQuality.ULTRA;

    if (isLow) {
      this.setConfig({
        updateEveryNFrames: 3,
        maxCulledPerFrame: 150,
        distanceThresholds: {
          near: 20,
          medium: 50,
          far: 90,
          ultraFar: 140,
        },
      });
    } else if (isMed) {
      this.setConfig({
        updateEveryNFrames: 4,
        maxCulledPerFrame: 120,
        distanceThresholds: {
          near: 25,
          medium: 70,
          far: 120,
          ultraFar: 200,
        },
      });
    } else if (isUltra) {
      this.setConfig({
        updateEveryNFrames: 6,
        maxCulledPerFrame: 80,
        distanceThresholds: {
          near: 40,
          medium: 100,
          far: 200,
          ultraFar: 350,
        },
      });
    } else {
      // High tier (default)
      this.setConfig({
        updateEveryNFrames: 5,
        maxCulledPerFrame: 100,
        distanceThresholds: {
          near: 30,
          medium: 80,
          far: 150,
          ultraFar: 250,
        },
      });
    }
  }

  /**
   * Register a mesh for distance-based culling.
   *
   * Duplicate registrations for the same mesh are silently ignored.
   *
   * @param mesh         - The mesh to manage.  Must not be disposed.
   * @param cullDistance - Distance in world units beyond which the mesh is
   *   hidden.  Must be a positive finite number; invalid values are clamped to 1.
   */
  /**
   * Register a node hierarchy (an asset root whose children hold the
   * geometry) to be distance-culled as a unit: past `cullDistance` the root
   * is disabled, which hides every descendant and takes them out of the
   * scene's per-mesh evaluation.  (Toggling `isVisible` on a geometry-less
   * root wouldn't hide anything.)  Frustum culling is left to Babylon's
   * per-mesh culling.  Static roots are measured from their bounding centre.
   */
  public registerHierarchy(root: AbstractMesh, cullDistance: number): void {
    if (this._hierarchies.some(e => e.root === root)) return;
    const safeDist = Number.isFinite(cullDistance) && cullDistance > 0 ? cullDistance : 1;
    let center: Vector3 | null = null;
    if (!root.parent) {
      const { min, max } = root.getHierarchyBoundingVectors(true);
      if (Number.isFinite(min.x) && Number.isFinite(max.x)) center = min.add(max).scaleInPlace(0.5);
    }
    this._hierarchies.push({ root, cullDistance: safeDist, center, culled: false });
  }

  public register(mesh: AbstractMesh, cullDistance: number): void {
    if (this._entries.some(e => e.mesh === mesh)) return;
    const safeDist = Number.isFinite(cullDistance) && cullDistance > 0 ? cullDistance : 1;
    this._entries.push({ mesh, cullDistance: safeDist });
  }

  /**
   * Unregister a mesh and restore its visibility before removing it from the
   * tracking list.  Safe to call with a mesh that was never registered.
   */
  public unregister(mesh: AbstractMesh): void {
    const h = this._hierarchies.findIndex(e => e.root === mesh);
    if (h !== -1) {
      const entry = this._hierarchies[h];
      if (entry.culled && !entry.root.isDisposed()) entry.root.setEnabled(true);
      this._hierarchies.splice(h, 1);
      return;
    }
    const idx = this._entries.findIndex(e => e.mesh === mesh);
    if (idx === -1) return;
    const entry = this._entries[idx];
    if (!entry.mesh.isDisposed()) entry.mesh.isVisible = true;
    this._entries.splice(idx, 1);
  }

  /**
   * Register a set of meshes representing the same world object at decreasing
   * levels of detail.
   *
   * `levels` must be provided in ascending `maxDistance` order.  On each
   * `update()` call only the mesh whose `maxDistance` band contains the current
   * player distance is made visible; all others are hidden.  When the player is
   * beyond the last level's `maxDistance`, every mesh is hidden (fully culled).
   *
   * Duplicate group registrations (same mesh array reference) are silently
   * ignored.
   *
   * @param levels  Array of `{ mesh, maxDistance }` from closest to furthest.
   */
  public registerLevels(levels: LodLevel[]): void {
    if (levels.length === 0) return;
    // Silently ignore if any mesh in the new group is already part of an existing group
    const newMeshes = new Set(levels.map(l => l.mesh));
    const alreadyTracked = this._levelGroups.some(g =>
      g.levels.some(l => newMeshes.has(l.mesh)),
    );
    if (alreadyTracked) return;
    this._levelGroups.push({ levels: [...levels] });
  }

  /**
   * Unregister a multi-level LOD group by its first mesh reference and restore
   * all mesh visibilities.  Safe to call with a mesh that was never registered.
   */
  public unregisterLevels(firstMesh: AbstractMesh): void {
    const idx = this._levelGroups.findIndex(g => g.levels[0]?.mesh === firstMesh);
    if (idx === -1) return;
    for (const level of this._levelGroups[idx].levels) {
      if (!level.mesh.isDisposed()) level.mesh.isVisible = true;
    }
    this._levelGroups.splice(idx, 1);
  }

  private _updateFrustumPlanes(): void {
    if (!this._camera || !this._config.frustumCull) return;
    const proj = this._camera.getProjectionMatrix();
    const view = this._camera.getViewMatrix();
    const m = proj.multiply(view);
    const extract = (row: number, sign: number) => {
      const a = m.m[3 + row] + sign * m.m[row];
      const b = m.m[7 + row] + sign * m.m[4 + row];
      const c = m.m[11 + row] + sign * m.m[8 + row];
      const d = m.m[15 + row] + sign * m.m[12 + row];
      return new Plane(a, b, c, d);
    };
    this._frustumPlanes = [
      extract(0, -1), extract(0, 1),
      extract(1, -1), extract(1, 1),
      extract(2, -1), extract(2, 1),
    ];
    for (const p of this._frustumPlanes) p.normalize();
  }

  private _isInFrustum(mesh: AbstractMesh): boolean {
    if (!this._config.frustumCull || this._frustumPlanes.length === 0) return true;
    const boundingInfo = (mesh as any).getBoundingInfo?.();
    const pos = boundingInfo?.boundingSphere?.centerWorld ?? mesh.position;
    const radius = boundingInfo?.boundingSphere?.radiusWorld ?? boundingInfo?.boundingSphere?.radius ?? 1;
    for (const plane of this._frustumPlanes) {
      const d = plane.normal.x * pos.x + plane.normal.y * pos.y + plane.normal.z * pos.z + plane.d;
      if (d < -radius) return false;
    }
    return true;
  }

  /**
   * Run the distance-culling pass with integrated frustum and priority culling.
   *
   * Returns the number of meshes currently culled (hidden) — useful for the
   * debug/performance overlay.
   *
   * Disposed meshes are pruned from the tracking list during the pass so they
   * do not accumulate over time.
   */
  public update(playerPosition: Vector3): number {
    if (++this._frameCounter % this._updateInterval !== 0) {
      return this._lastCulled;
    }

    this._updateFrustumPlanes();

    const cullFarSq = this._config.distanceThresholds.ultraFar ** 2;
    const candidates: CullPriority[] = [];

    // ── Simple binary-cull entries ─────────────────────────────────────────
    const aliveEntries: LodEntry[] = [];
    let culled = 0;

    for (const entry of this._entries) {
      if (entry.mesh.isDisposed()) continue;
      aliveEntries.push(entry);

      const boundingInfo = (entry.mesh as any).getBoundingInfo?.();
      const pos = boundingInfo?.boundingSphere?.centerWorld ?? entry.mesh.position;
      const distSq = Vector3.DistanceSquared(pos, playerPosition);
      const cullSq = entry.cullDistance * entry.cullDistance;
      const distCulled = distSq > cullSq;

      if (distCulled) {
        candidates.push({ mesh: entry.mesh, distanceSq: distSq });
        entry.mesh.isVisible = false;
        culled++;
        continue;
      }

      if (!this._isInFrustum(entry.mesh)) {
        candidates.push({ mesh: entry.mesh, distanceSq: distSq });
        entry.mesh.isVisible = false;
        culled++;
        continue;
      }

      entry.mesh.isVisible = true;
    }

    this._entries = aliveEntries;

    // ── Hierarchies: distance only, toggled via enabled state ──────────────
    const aliveHierarchies: LodHierarchyEntry[] = [];
    for (const h of this._hierarchies) {
      if (h.root.isDisposed()) continue;
      aliveHierarchies.push(h);
      const pos = h.center ?? h.root.getAbsolutePosition();
      const far = Vector3.DistanceSquared(pos, playerPosition) > h.cullDistance * h.cullDistance;
      if (far !== h.culled) {
        h.culled = far;
        h.root.setEnabled(!far);
      }
      if (far) culled++;
    }
    this._hierarchies = aliveHierarchies;

    // ── Multi-level LOD groups ─────────────────────────────────────────────
    const aliveLevelGroups: LodLevelEntry[] = [];

    for (const group of this._levelGroups) {
      const anyAlive = group.levels.some(l => !l.mesh.isDisposed());
      if (!anyAlive) continue;
      aliveLevelGroups.push(group);

      const originMesh = group.levels.find(l => !l.mesh.isDisposed());
      if (!originMesh) continue;

      const originInfo = (originMesh.mesh as any).getBoundingInfo?.();
      const originPos = originInfo?.boundingSphere?.centerWorld ?? originMesh.mesh.position;
      const distSq = Vector3.DistanceSquared(originPos, playerPosition);

      let chosen = false;
      for (const level of group.levels) {
        if (level.mesh.isDisposed()) continue;
        if (!chosen && distSq <= level.maxDistance * level.maxDistance) {
          if (distSq <= cullFarSq && this._isInFrustum(level.mesh)) {
            level.mesh.isVisible = true;
          } else {
            level.mesh.isVisible = false;
            culled++;
          }
          chosen = true;
        } else {
          level.mesh.isVisible = false;
          culled++;
        }
      }
    }

    this._levelGroups = aliveLevelGroups;

    // ── Priority-based culling ─────────────────────────────────────────────
    // Culling budget: when more meshes than `maxCulledPerFrame` are candidates,
    // only the farthest ones stay hidden and the closest are restored.
    if (this._config.priorityCull && candidates.length > this._config.maxCulledPerFrame) {
      candidates.sort((a, b) => b.distanceSq - a.distanceSq);
      for (const entry of candidates.slice(this._config.maxCulledPerFrame)) {
        entry.mesh.isVisible = true;
      }
      culled = this._config.maxCulledPerFrame;
    }

    this._lastCulled = culled;
    return culled;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // ── Debug accessors ───────────────────────────────────────────────────────────

  /** Total number of currently tracked meshes (registered and not yet disposed). */
  public get entryCount(): number {
    const singles = this._entries.filter(e => !e.mesh.isDisposed()).length
      + this._hierarchies.filter(e => !e.root.isDisposed()).length;
    const levels  = this._levelGroups.reduce(
      (sum, g) => sum + g.levels.filter(l => !l.mesh.isDisposed()).length,
      0,
    );
    return singles + levels;
  }

  /**
   * Restore visibility on all registered meshes and clear the registry.
   * Call when transitioning between cells so stale mesh references are released.
   */
  public clear(): void {
    for (const entry of this._entries) {
      if (!entry.mesh.isDisposed()) entry.mesh.isVisible = true;
    }
    this._entries = [];
    for (const h of this._hierarchies) {
      if (h.culled && !h.root.isDisposed()) h.root.setEnabled(true);
    }
    this._hierarchies = [];

    for (const group of this._levelGroups) {
      for (const level of group.levels) {
        if (!level.mesh.isDisposed()) level.mesh.isVisible = true;
      }
    }
    this._levelGroups = [];

    this._frameCounter = 0;
  }
}
