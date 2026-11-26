/**
 * Villages as a kernel feature: planning, building them as chunks load,
 * discovery, and the queries other features ask about villages.
 *
 * Builds through the site-builder service (buildings, props, smithy,
 * ownership), so everything placed belongs to the chunk and goes when it
 * unloads.  The well, the notice board and the night candles are built
 * here directly.
 *
 * Inputs:   `populate(chunkKey, cx, cz)` from the chunk loader; events
 *           `chunk:unloaded`; services world-info, site-builder, actors,
 *           player, fast-travel, feedback, jobs.
 * Outputs:  the `villages` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Feature, FeatureContext } from "../../core/kernel";
import type { ServiceRegistry } from "../../core/kernel";
import {
  hasVillage, planVillage, VILLAGE_CLEAR_RADIUS, VILLAGE_DISCOVER_RADIUS, type VillagePlan,
} from "../../world/village-settlement";
import { toWorld } from "../../world/village-buildings";
import { buildVillageWell, WELL_RADIUS } from "../../world/village-well";
import { createNoticeMaterials } from "../../rendering/notice-texture";
import { getQuaterniusBasePath } from "../../systems/fantasy-asset-loader";
import { ActorsKey, JobsKey, RoutinesKey, FastTravelKey, FeedbackKey, PlayerKey, SiteBuilderKey, VillagesKey, WorldInfoKey, type SiteBuilderService, declareStateless } from "../services";

export { VillagesKey } from "../services";
export type { VillagesService } from "../services";
import { markNavObstacle } from "../../systems/navmesh-build";



export class VillagesFeature implements Feature {
  public readonly id = "villages";
  private readonly _plans = new Map<string, VillagePlan | null>();
  private readonly _loaded = new Map<string, VillagePlan>();
  private _discoverTimer = 0;
  private _noticeMats: StandardMaterial[] | null = null;
  private _services: ServiceRegistry | null = null;

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "plans come from the world seed, and discovery belongs to fast travel");
    const s = ctx.kernel.services;
    this._services = s;
    const world = () => s.get(WorldInfoKey);

    const planFor = (cx: number, cz: number): VillagePlan | null => {
      const key = `${cx},${cz}`;
      let plan = this._plans.get(key);
      if (plan === undefined) {
        const w = world();
        plan = hasVillage(cx, cz, w.biome(cx, cz)) && !w.pondAt(cx, cz) ? planVillage(cx, cz, w.chunkSize) : null;
        this._plans.set(key, plan);
      }
      return plan;
    };

    const currentVillage = () => {
      const p = s.get(PlayerKey).position();
      const travel = s.get(FastTravelKey);
      for (const [chunkKey, plan] of this._loaded) {
        if (Math.hypot(p.x - plan.center.x, p.z - plan.center.z) > VILLAGE_CLEAR_RADIUS + 4) continue;
        if (!travel.isDiscovered(plan.id)) continue;
        return { chunkKey, plan };
      }
      return null;
    };

    ctx.provide(VillagesKey, {
      planFor,
      clearingAt: (cx, cz) => {
        const v = planFor(cx, cz);
        return v ? { x: v.center.x, z: v.center.z, radius: v.clearRadius } : null;
      },
      populate: (chunkKey, cx, cz) => {
        const plan = planFor(cx, cz);
        if (!plan) return false;
        this._build(s.get(SiteBuilderKey), chunkKey, plan);
        return true;
      },
      loaded: () => this._loaded,
      loadedVillage: (id) => [...this._loaded.values()].find((v) => v.id === id) ?? null,
      currentVillage,
      innBoardOf: (npcName) => {
        const npc = s.get(ActorsKey).byName(npcName);
        if (!npc) return null;
        const size = world().chunkSize;
        const cx = Math.round(npc.spawnPosition.x / size);
        const cz = Math.round(npc.spawnPosition.z / size);
        const village = this._plans.get(`${cx},${cz}`) ?? null;
        return { boardId: `inn_${cx}_${cz}`, placeName: village?.name ?? "the inn" };
      },
    });

    ctx.on("chunk:unloaded", ({ chunkKey }) => { this._loaded.delete(chunkKey); });

    // Walking into a village's square discovers it as a fast-travel destination.
    ctx.system({
      id: "villages.discover",
      phase: "sim",
      update: (dt) => {
        this._discoverTimer -= dt;
        if (this._discoverTimer > 0 || this._loaded.size === 0) return;
        this._discoverTimer = 0.5;
        const p = s.get(PlayerKey).position();
        const travel = s.get(FastTravelKey);
        for (const v of this._loaded.values()) {
          const dx = p.x - v.center.x, dz = p.z - v.center.z;
          if (dx * dx + dz * dz > VILLAGE_DISCOVER_RADIUS * VILLAGE_DISCOVER_RADIUS) continue;
          if (travel.isDiscovered(v.id)) continue;
          // Arrive on the entrance road, not inside the well at the centre.
          travel.discover(v.id, v.name, { x: v.arrival.x, y: 2, z: v.arrival.z });
          const fb = s.get(FeedbackKey);
          fb.notify(`Discovered: ${v.name}`, 3200);
          ctx.kernel.events.emit("location:discovered", { id: v.id, name: v.name });
          fb.markDirty();
        }
      },
    });

    ctx.scope.add(() => {
      this._loaded.clear();
      for (const m of this._noticeMats ?? []) m.dispose();
      this._noticeMats = null;
      this._services = null;
    });
  }

  /** Build a planned village: buildings, square, smithy, notice board, residents. */
  private _build(site: SiteBuilderService, chunkKey: string, plan: VillagePlan): void {
    for (const b of plan.buildings) site.placeBuilding(chunkKey, b.kind, { x: b.x, z: b.z, rot: b.rot });
    for (const p of plan.props) {
      if (p.key === "qWell") this._placeWell(site, chunkKey, p.x, p.z, p.rot);
      else site.placeProp(chunkKey, p.key, p.x, p.z, p.rot);
      if (p.key === "qLantern") {
        const flame = site.nightFlame(`candle_${chunkKey}_${p.x.toFixed(1)}_${p.z.toFixed(1)}`, p.x, 1.33, p.z);
        if (flame) site.own(chunkKey, flame);
      }
    }
    site.placeSmithy(chunkKey, plan.forge.x, plan.forge.z, plan.forge.rot);
    this._placeNoticeBoard(site, chunkKey, plan);

    const actors = this._services?.tryGet(ActorsKey);
    const at = (p: { x: number; z: number }) => new Vector3(p.x, 2, p.z);
    for (const r of plan.residents) {
      const npc = actors?.spawnArchetype(chunkKey, r.archetype, r.x, r.z);
      if (!npc) continue;
      // Daily routine anchors (ScheduleSystem: work / wander / sleep / patrol).
      if (r.work) npc.workPosition = at(r.work);
      if (r.home) npc.homePosition = at(r.home);
      if (r.patrol) npc.patrolPoints = r.patrol.map(at);
      // Night watch: patrols 18:00–08:00 (overlapping the day guard's
      // 06:00–22:00), sleeps by day.
      if (r.nightWatch) {
        npc.scheduleBlocks = [
          { startHour: 18, endHour: 8, behavior: "patrol" },
          { startHour: 8, endHour: 18, behavior: "sleep" },
        ];
      }
      // Where its routine has it right now (at the forge by day, indoors at night).
      this._services?.tryGet(RoutinesKey)?.place(npc);
    }
    this._loaded.set(chunkKey, plan);
  }

  /** The well on a village square: stone curb, winch and roof, with a collider. */
  private _placeWell(site: SiteBuilderService, chunkKey: string, x: number, z: number, rot: number): void {
    if (!site.isLive(chunkKey)) return;
    const well = buildVillageWell(site.scene, `village_well_${chunkKey}`,
      `${getQuaterniusBasePath()}village/textures/medieval-village-megakit/`);
    well.position.set(x, 0, z);
    well.rotation.y = rot;
    well.freezeWorldMatrix();
    for (const part of well.getChildMeshes(false)) part.freezeWorldMatrix();
    site.ownStructure(chunkKey, well);

    const col = MeshBuilder.CreateCylinder(`village_well_collider_${chunkKey}`, { diameter: WELL_RADIUS * 2, height: 1, tessellation: 12 }, site.scene);
    col.position.set(x, 0.5, z);
    col.isVisible = false;
    col.isPickable = false;
    markNavObstacle(col);
    col.freezeWorldMatrix();
    const removeKeepOut = site.addKeepOut({ x, z, cos: 1, sin: 0, hw: WELL_RADIUS + 0.5, hd: WELL_RADIUS + 0.5 });
    col.onDisposeObservable.addOnce(removeKeepOut);
    // No physics engine (headless tools, tests): the keep-out still applies.
    const scene = site.scene as { getPhysicsEngine?: () => unknown };
    if (typeof scene.getPhysicsEngine === "function" && scene.getPhysicsEngine()) {
      try {
        const agg = new PhysicsAggregate(col, PhysicsShapeType.CYLINDER, { mass: 0 }, site.scene);
        col.onDisposeObservable.addOnce(() => agg.dispose());
      } catch (err) {
        console.warn("[village] well collider unavailable", err);
      }
    }
    site.own(chunkKey, col);
  }

  /** The notice board: the same job board as the village inn, read with E. */
  private _placeNoticeBoard(site: SiteBuilderService, chunkKey: string, plan: VillagePlan): void {
    const nb = plan.noticeBoard;
    site.placeProp(chunkKey, "qNoticeBoard", nb.x, nb.z, nb.rot);
    if (!site.isLive(chunkKey)) return;
    const [cx, cz] = chunkKey.split(",").map(Number);
    const board = { boardId: `inn_${cx}_${cz}`, placeName: plan.name };
    // Invisible (visibility 0, still pickable) hit box over the board face.
    const hit = MeshBuilder.CreateBox(`notice_board_${chunkKey}`, { width: 1.6, height: 1.2, depth: 0.4 }, site.scene);
    hit.position.set(nb.x, 1.45, nb.z);
    hit.rotation.y = nb.rot;
    hit.visibility = 0;
    hit.isPickable = true;
    // Pinned notices: parchment quads (a few shared materials) on the board face.
    const mats = (this._noticeMats ??= createNoticeMaterials(site.scene));
    const notices: Array<[number, number, number]> = [[-0.42, 1.55, 0.08], [0.05, 1.62, -0.05], [0.45, 1.5, 0.12], [-0.15, 1.24, -0.1], [0.36, 1.2, 0.04]];
    notices.forEach(([lx, ly, tilt], i) => {
      const q = MeshBuilder.CreatePlane(`notice_${chunkKey}_${i}`, { width: 0.3, height: 0.36, sideOrientation: Mesh.DOUBLESIDE }, site.scene);
      // The board model is mirrored in X by the glTF handedness conversion.
      const w = toWorld({ x: -lx, z: 0.07 }, { x: nb.x, z: nb.z, rot: nb.rot });
      q.position.set(w.x, ly, w.z);
      q.rotation.set(0, nb.rot, tilt);
      q.material = mats[(((i + cx * 7 + cz * 3) % mats.length) + mats.length) % mats.length];
      q.isPickable = false;
      q.freezeWorldMatrix();
      site.own(chunkKey, q);
    });
    const services = this._services;
    hit.metadata = {
      type: "activator",
      label: `Read the ${plan.name} notice board`,
      onActivate: () => services?.tryGet(JobsKey)?.open(board),
    };
    site.own(chunkKey, hit);
  }
}
