/**
 * What the world puts in each loaded chunk: props, village buildings (with
 * wall colliders and keep-out footprints), smithies, night flames, and the
 * chunk's own NPCs.  Everything placed for a chunk goes when it unloads.
 *
 * The world-sites feature decides what goes where; this places it.
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { Scene } from "@babylonjs/core/scene";
import type { NPC } from "../entities/npc";
import type { LodSystem } from "../systems/lod-system";
import type { FireFx } from "../rendering/particles-fx";
import type { ForgeRegistry } from "../systems/smithing-controller";
import { setInstanceYaw, type FantasyAssetKey, type FantasyAssetLoader } from "../systems/fantasy-asset-loader";
import { buildingFootprint, buildingLayout, buildingWallColliders, toWorld, WALL_HEIGHT, type BuildingKind } from "./village-buildings";

/** A chunk's placed meshes and its own NPCs. */
export interface ChunkRecord { roots: AbstractMesh[]; npcs: NPC[] }

/** A building's ground (centre, yaw, half sizes incl. margin) that NPCs keep out of. */
export interface Footprint { x: number; z: number; cos: number; sin: number; hw: number; hd: number }

/** How far each kind of prop stays drawn. */
export type PropTier = "structure" | "scene" | "prop" | "boss";
const DRAW_DISTANCE: Record<PropTier, number> = { boss: 210, scene: 185, structure: 145, prop: 88 };

export interface ChunkContentDeps {
  scene: Scene;
  assets: FantasyAssetLoader;
  lod: LodSystem;
  shadows(): ShadowGenerator | null;
  fireFx(): FireFx | null;
  forges(): ForgeRegistry;
  /** Unregister a chunk NPC from every system and dispose it. */
  releaseNpc(npc: NPC): void;
}

type Origin = { x: number; z: number; rot: number };

export class ChunkContent {
  private readonly _records = new Map<string, ChunkRecord>();
  public readonly footprints = new Set<Footprint>();
  private _candleMat: StandardMaterial | null = null;

  constructor(private readonly _d: ChunkContentDeps) {}

  /** The live record for a chunk, if it is loaded. */
  public record(chunkKey: string): ChunkRecord | undefined {
    return this._records.get(chunkKey);
  }

  /** A chunk loaded: start its record. */
  public open(chunkKey: string): ChunkRecord {
    const record: ChunkRecord = { roots: [], npcs: [] };
    this._records.set(chunkKey, record);
    return record;
  }

  /** A chunk unloaded: dispose what was placed for it and release its NPCs. */
  public close(chunkKey: string): void {
    const record = this._records.get(chunkKey);
    if (!record) return;
    this._records.delete(chunkKey);
    for (const root of record.roots) {
      this._d.lod.unregister(root);
      this._d.shadows()?.removeShadowCaster(root, true);
      // Materials and textures belong to the shared asset template: keep them.
      root.dispose();
    }
    for (const npc of record.npcs) this._d.releaseNpc(npc);
  }

  /** Take an NPC off its chunk's list (it is being removed some other way). */
  public forget(npc: NPC): void {
    for (const record of this._records.values()) {
      const i = record.npcs.indexOf(npc);
      if (i >= 0) { record.npcs.splice(i, 1); return; }
    }
  }

  /** Whether (x, z) is within `margin` m of a loaded building. */
  public nearBuilding(x: number, z: number, margin: number): boolean {
    for (const f of this.footprints) {
      const dx = x - f.x, dz = z - f.z;
      const lx = dx * f.cos - dz * f.sin;
      const lz = dx * f.sin + dz * f.cos;
      if (Math.abs(lx) < f.hw + margin && Math.abs(lz) < f.hd + margin) return true;
    }
    return false;
  }

  /** Whether (x, z) is open ground, i.e. not inside a loaded building. */
  public isWalkable(x: number, z: number): boolean {
    for (const f of this.footprints) {
      const dx = x - f.x, dz = z - f.z;
      if (Math.abs(dx) > f.hw + f.hd || Math.abs(dz) > f.hw + f.hd) continue; // cheap reject
      const lx = dx * f.cos - dz * f.sin;
      const lz = dx * f.sin + dz * f.cos;
      if (Math.abs(lx) < f.hw && Math.abs(lz) < f.hd) return false;
    }
    return true;
  }

  /**
   * Keep a placed root with its chunk (disposed on unload), casting shadows
   * and drawn to its tier's distance.  A root that finished loading after its
   * chunk went (or came back) is dropped instead of leaking.
   */
  public track(chunkKey: string, record: ChunkRecord, root: AbstractMesh, tier: PropTier): void {
    if (this._records.get(chunkKey) !== record) {
      root.dispose();
      return;
    }
    record.roots.push(root);
    this._d.shadows()?.addShadowCaster(root, true);
    this._d.lod.registerHierarchy(root, DRAW_DISTANCE[tier]);
  }

  /** One prop, offset from a site origin and turned with it. */
  public placeProp(
    chunkKey: string, record: ChunkRecord, key: FantasyAssetKey, origin: Origin,
    dx: number, dz: number, rotY = 0, tier: "structure" | "prop" = "prop",
  ): void {
    const { x, z } = toWorld({ x: dx, z: dz }, origin);
    this._d.assets.getInstance(key, (root) => {
      if (!root) return;
      root.position.set(x, 0, z);
      setInstanceYaw(root, origin.rot + rotY);
      this.track(chunkKey, record, root, tier);
    });
  }

  /**
   * A village building from Medieval Village modules (see
   * village-buildings.ts).  Its meshes don't take picks, so talking or
   * looting through a doorway still works; walls collide.
   */
  public placeBuilding(chunkKey: string, record: ChunkRecord, kind: BuildingKind, origin: Origin): void {
    this._addWallColliders(chunkKey, record, kind, origin);
    for (const part of buildingLayout(kind)) {
      const { x, z } = toWorld(part, origin);
      this._d.assets.getInstance(part.key, (root) => {
        if (!root) return;
        root.position.set(x, part.y, z);
        setInstanceYaw(root, origin.rot + part.rotY);
        // Walls stop the player (and block NPC sight lines for stealth and
        // crime witnesses); the doorway stays open, roofs and panels don't collide.
        const solid = part.key.startsWith("vWall") || part.key.startsWith("vCorner");
        root.isPickable = false;
        for (const m of root.getChildMeshes(false)) {
          m.isPickable = false;
          m.checkCollisions = solid;
        }
        this.track(chunkKey, record, root, "structure");
      });
    }
  }

  /**
   * One invisible static box per wall (the front split around the doorway),
   * so NPC bodies and projectiles can't pass through walls while the inside
   * stays open.  The player collides with the real walls.
   */
  private _addWallColliders(chunkKey: string, record: ChunkRecord, kind: BuildingKind, origin: Origin): void {
    if (this._records.get(chunkKey) !== record) return;
    const { scene } = this._d;
    const { width, depth } = buildingFootprint(kind);
    const fp: Footprint = {
      x: origin.x, z: origin.z, cos: Math.cos(origin.rot), sin: Math.sin(origin.rot), hw: width / 2 + 0.5, hd: depth / 2 + 0.5,
    };
    buildingWallColliders(kind).forEach((w, i) => {
      const p = toWorld(w, origin);
      const box = MeshBuilder.CreateBox(`bldg_wall_${chunkKey}_${record.roots.length}_${i}`, {
        width: w.width, depth: w.depth, height: WALL_HEIGHT,
      }, scene);
      box.position.set(p.x, WALL_HEIGHT / 2, p.z);
      box.rotation.y = origin.rot;
      box.isVisible = false;
      box.isPickable = false;
      box.checkCollisions = false;
      box.freezeWorldMatrix();
      try {
        const agg = new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene);
        box.onDisposeObservable.addOnce(() => agg.dispose());
      } catch (err) {
        // No physics engine (e.g. headless tooling): the box is harmless.
        if (i === 0) console.warn("[buildings] collider unavailable", err);
      }
      // The footprint (plus a body's width) for NPC wander and path checks,
      // registered with the first wall and dropped with it.
      if (i === 0) {
        this.footprints.add(fp);
        box.onDisposeObservable.addOnce(() => this.footprints.delete(fp));
      }
      record.roots.push(box);
    });
  }

  /** Keep NPCs out of a footprint; returns the undo. */
  public addKeepOut(fp: Footprint): () => void {
    this.footprints.add(fp);
    return () => { this.footprints.delete(fp); };
  }

  /**
   * A forge and anvil, registered as a smithing station.  With no chunk
   * (the starting forge) they stay for good.
   */
  public placeSmithy(chunkKey: string | null, record: ChunkRecord | null, x: number, z: number, yaw = 0): void {
    this._d.forges().add(`forge_${x.toFixed(1)}_${z.toFixed(1)}`, x, z, chunkKey);
    // The anvil sits beside the forge in the forge's own frame, so it stays
    // clear of whatever wall the forge backs onto.
    const anvil = toWorld({ x: 1.5, z: 1 }, { x, z, rot: yaw });
    const props: Array<["qForge" | "qAnvil", number, number]> = [["qForge", x, z], ["qAnvil", anvil.x, anvil.z]];
    for (const [key, px, pz] of props) {
      this._d.assets.getInstance(key, (root) => {
        if (!root) return;
        root.position.set(px, 0, pz);
        setInstanceYaw(root, yaw);
        if (chunkKey && record) this.track(chunkKey, record, root, "structure");
        else this._d.shadows()?.addShadowCaster(root, true);
      });
    }
  }

  /**
   * A night-only flame: a small glowing core plus a warm point light (the
   * fire effects manage flicker, particles and which few lights are on).
   * The caller owns the mesh; disposing it removes the light.
   */
  public nightFlame(name: string, x: number, y: number, z: number): Mesh | null {
    const fx = this._d.fireFx();
    if (!fx) return null;
    const { scene } = this._d;
    this._candleMat ??= (() => {
      const m = new StandardMaterial("candle_flame", scene);
      m.emissiveColor = new Color3(1.0, 0.62, 0.22);
      m.diffuseColor = new Color3(0, 0, 0);
      m.disableLighting = true;
      m.freeze();
      return m;
    })();
    const flame = MeshBuilder.CreateSphere(name, { diameter: 0.14, segments: 6 }, scene);
    flame.position.set(x, y, z);
    flame.material = this._candleMat;
    flame.isPickable = false;
    flame.freezeWorldMatrix();
    const light = new PointLight(`${name}_light`, new Vector3(x, y + 0.1, z), scene);
    light.diffuse = new Color3(1.0, 0.6, 0.22);
    light.specular = new Color3(0.4, 0.25, 0.08);
    light.intensity = 1.1;
    light.range = 9;
    flame.onDisposeObservable.addOnce(() => light.dispose());
    fx.attach({ flame, light, kind: "torch", nightOnly: true });
    return flame;
  }
}
