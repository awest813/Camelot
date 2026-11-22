/**
 * Headless simulation harness (engine overhaul, Phase 0).
 *
 * Runs real gameplay modules without Babylon rendering or Havok physics, so
 * feature behaviour can be tested in Vitest instead of Playwright:
 *
 *  - the village planner (`planVillage`) and its building wall colliders;
 *  - the real `ScheduleSystem` and `NpcScheduleSystem` with the shipped
 *    archetype schedules from the base content;
 *  - a tiny 2D physics stand-in: bodies integrate the velocity the schedule
 *    system asks for and are pushed out of wall boxes and the well.
 *
 * This is the seed of the kernel's headless mode: once the kernel exists,
 * the same scenarios run through it with stub render/physics adapters.
 * Nothing here is imported by the game.
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { NPC, ScheduleBlock } from "../../entities/npc";
import { AIState } from "../../entities/npc";
import { ScheduleSystem } from "../../systems/schedule-system";
import { NpcScheduleSystem } from "../../systems/npc-schedule-system";
import { frameworkBaseContent } from "../../framework/content/base-content";
import { planVillage, hasVillage, type VillagePlan, type VillageResident } from "../../world/village-settlement";
import { buildingFootprint, buildingWallColliders, toWorld } from "../../world/village-buildings";
import { WELL_RADIUS } from "../../world/village-well";

/** Capsule radius used for push-out (matches the game's NPC capsule). */
const BODY_RADIUS = 0.35;

/** An oriented wall box in world space. */
interface WallBox { x: number; z: number; cos: number; sin: number; hw: number; hd: number }

/** Minimal physics body: integrates velocity in XZ, gravity ignored. */
class HeadlessBody {
  public readonly velocity = new Vector3();
  constructor(private readonly _position: Vector3) {}
  public getLinearVelocityToRef(out: Vector3): Vector3 { return out.copyFrom(this.velocity); }
  public setLinearVelocity(v: Vector3): void { this.velocity.set(v.x, 0, v.z); }
  public step(dt: number): void {
    this._position.x += this.velocity.x * dt;
    this._position.z += this.velocity.z * dt;
  }
}

export interface HeadlessNpc {
  npc: NPC;
  archetype: string;
  resident: VillageResident;
  body: HeadlessBody;
}

/** The first village chunk found scanning out from the origin. */
export function firstVillageChunk(): [number, number] {
  for (let r = 3; r < 60; r++) {
    for (let cx = -r; cx <= r; cx++) {
      for (const cz of [-r, r]) if (hasVillage(cx, cz, "plains")) return [cx, cz];
    }
  }
  throw new Error("no village within 60 chunks");
}

export class HeadlessVillage {
  public readonly plan: VillagePlan;
  public readonly schedules = new ScheduleSystem();
  public readonly npcs: HeadlessNpc[] = [];
  public readonly walls: WallBox[] = [];
  /** Simulated hour of day (fractional). */
  public hour: number;

  constructor(opts: { chunk?: [number, number]; chunkSize?: number; startHour?: number } = {}) {
    const [cx, cz] = opts.chunk ?? firstVillageChunk();
    this.plan = planVillage(cx, cz, opts.chunkSize ?? 50);
    this.hour = opts.startHour ?? 8;

    for (const b of this.plan.buildings) {
      for (const w of buildingWallColliders(b.kind)) {
        const p = toWorld(w, b);
        this.walls.push({ x: p.x, z: p.z, cos: Math.cos(b.rot), sin: Math.sin(b.rot), hw: w.width / 2, hd: w.depth / 2 });
      }
    }
    // Same keep-out the game feeds the schedule system.
    // (A negative inset grows the footprint: 0.5 m margin, as in the game.)
    this.schedules.walkable = (x, z) => !this.insideBuilding(x, z, -0.5) && !this.inWell(x, z, 0.5);

    const library = new NpcScheduleSystem();
    const archetypes = frameworkBaseContent.npcArchetypes ?? [];
    this.plan.residents.forEach((r, i) => {
      const def = archetypes.find((a) => a.id === r.archetype);
      const npc = makeNpc(`${def?.name ?? r.archetype}_${i}`, r.x, r.z);
      if (def?.scheduleId) library.applySchedule(npc, def.scheduleId);
      if (r.work) npc.workPosition = new Vector3(r.work.x, 2, r.work.z);
      if (r.home) npc.homePosition = new Vector3(r.home.x, 2, r.home.z);
      if (r.patrol) npc.patrolPoints = r.patrol.map((p) => new Vector3(p.x, 2, p.z));
      if (r.nightWatch) {
        npc.scheduleBlocks = [
          { startHour: 18, endHour: 8, behavior: "patrol" },
          { startHour: 8, endHour: 18, behavior: "sleep" },
        ] as ScheduleBlock[];
      }
      this.schedules.addNPC(npc);
      this.npcs.push({ npc, archetype: r.archetype, resident: r, body: npc.physicsAggregate!.body as unknown as HeadlessBody });
    });
  }

  /** Whether (x, z) is inside a building's walls (shrunk by `inset` m; negative grows it). */
  public insideBuilding(x: number, z: number, inset = 0): boolean {
    for (const b of this.plan.buildings) {
      const { width, depth } = buildingFootprint(b.kind);
      const dx = x - b.x, dz = z - b.z;
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < width / 2 - inset && Math.abs(lz) < depth / 2 - inset) return true;
    }
    return false;
  }

  public inWell(x: number, z: number, margin = 0): boolean {
    const well = this.plan.props.find((p) => p.key === "qWell");
    return !!well && Math.hypot(x - well.x, z - well.z) < WELL_RADIUS + margin;
  }

  /** Advance the simulation by `seconds` of game time at `dt` per step. */
  public run(seconds: number, dt = 0.1, minutesPerSecond = 1): void {
    for (let t = 0; t < seconds; t += dt) {
      this.hour = (this.hour + (dt * minutesPerSecond) / 60) % 24;
      this.schedules.currentHour = Math.floor(this.hour);
      this.schedules.update(dt);
      for (const h of this.npcs) {
        h.body.step(dt);
        this._collide(h.npc.mesh.position);
      }
    }
  }

  /** Push a body out of wall boxes and the well (circle vs. oriented box). */
  private _collide(p: Vector3): void {
    for (const w of this.walls) {
      const dx = p.x - w.x, dz = p.z - w.z;
      const lx = dx * w.cos - dz * w.sin, lz = dx * w.sin + dz * w.cos;
      const cx = Math.max(-w.hw, Math.min(w.hw, lx)), cz = Math.max(-w.hd, Math.min(w.hd, lz));
      let ox = lx - cx, oz = lz - cz;
      const d = Math.hypot(ox, oz);
      if (d >= BODY_RADIUS) continue;
      if (d < 1e-6) {
        // Centre inside the box: leave along the shallowest axis.
        const px = w.hw - Math.abs(lx), pz = w.hd - Math.abs(lz);
        if (px < pz) { ox = Math.sign(lx) || 1; oz = 0; } else { ox = 0; oz = Math.sign(lz) || 1; }
        const push = (px < pz ? px : pz) + BODY_RADIUS;
        const nlx = lx + ox * push, nlz = lz + oz * push;
        p.x = w.x + nlx * w.cos + nlz * w.sin;
        p.z = w.z - nlx * w.sin + nlz * w.cos;
        continue;
      }
      const k = (BODY_RADIUS - d) / d;
      const nlx = lx + ox * k, nlz = lz + oz * k;
      p.x = w.x + nlx * w.cos + nlz * w.sin;
      p.z = w.z - nlx * w.sin + nlz * w.cos;
    }
    const well = this.plan.props.find((q) => q.key === "qWell");
    if (well) {
      const dx = p.x - well.x, dz = p.z - well.z, d = Math.hypot(dx, dz) || 1e-6;
      const min = WELL_RADIUS + BODY_RADIUS;
      if (d < min) { p.x = well.x + (dx / d) * min; p.z = well.z + (dz / d) * min; }
    }
  }
}

/** An NPC-shaped object with just what the schedule system uses. */
function makeNpc(name: string, x: number, z: number): NPC {
  const position = new Vector3(x, 2, z);
  const body = new HeadlessBody(position);
  return {
    mesh: {
      name,
      position,
      lookAt: () => undefined,
      isEnabled: () => true,
      isDisposed: () => false,
    },
    physicsAggregate: { body },
    isDead: false,
    isAggressive: false,
    isInDialogue: false,
    aiState: AIState.IDLE,
    patrolPoints: [],
    currentPatrolIndex: 0,
    waitTime: 0,
    patrolWaitMin: 1,
    patrolWaitMax: 3,
    patrolLookAroundAngle: 0.5,
    moveSpeed: 2,
    scheduleBlocks: [],
    workPosition: null,
    homePosition: null,
    spawnPosition: position.clone(),
  } as unknown as NPC;
}
