/**
 * Village raids as a kernel feature.
 *
 * Rules live in VillageRaidSystem (pure); this module turns them into the
 * world: hourly rolls while the player is in a village, raiders marching up
 * the entrance road, townsfolk sheltering, win and abandon outcomes.
 *
 * Inputs:   events `time:hour`, `player:kill`, `save:loaded`, `npc:released`;
 *           services clock, player, feedback, village-world.
 * Outputs:  the `raids` service (state for saves, sheltering queries, start).
 *
 * First feature extracted from game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AIState, type NPC } from "../../entities/npc";
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { VillageRaidSystem, raiderCount } from "../../systems/village-raids";
import type { VillagePlan } from "../../world/village-settlement";
import {
  ClockKey, FeedbackKey, PlayerKey, VillageWorldKey,
  type FeedbackService, type GameClockService, type PlayerService, type VillageWorldService,
} from "../services";

/** Service accessors, resolved at call time (the game provides them). */
interface RaidDeps {
  readonly world: VillageWorldService;
  readonly player: PlayerService;
  readonly clock: GameClockService;
  readonly feedback: FeedbackService;
}

/** The player counts as having left a raided village past this distance (m). */
export const RAID_LEAVE_DISTANCE = 80;

export interface RaidsService {
  /** Rules and state (cooldowns are saved through this). */
  readonly rules: VillageRaidSystem;
  /** Start a raid on a loaded village now; returns the raiders. */
  start(chunkKey: string, plan: VillagePlan): NPC[];
  /** Whether this NPC is hiding from a raid (keep them indoors). */
  isSheltered(npc: NPC): boolean;
}

export const RaidsKey = createServiceKey<RaidsService>("raids");

export class VillageRaidFeature implements Feature {
  public readonly id = "village-raids";
  public readonly rules = new VillageRaidSystem();
  private readonly _raiders = new Set<NPC>();
  private readonly _sheltered = new Set<NPC>();
  private _checkTimer = 0;
  private _deps: RaidDeps | null = null;

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    const deps: RaidDeps = {
      get world() { return s.get(VillageWorldKey); },
      get player() { return s.get(PlayerKey); },
      get clock() { return s.get(ClockKey); },
      get feedback() { return s.get(FeedbackKey); },
    };
    this._deps = deps;
    const rng = ctx.kernel.rng.stream("raids");

    ctx.provide(RaidsKey, {
      rules: this.rules,
      start: (chunkKey, plan) => this._start(chunkKey, plan),
      isSheltered: (npc) => this._sheltered.has(npc),
    });

    // Hourly roll while the player is in a discovered village.
    ctx.on("time:hour", ({ elapsedHours }) => {
      const here = deps.world.currentVillage();
      if (!here) return;
      const go = this.rules.shouldRaid({
        villageId: here.plan.id,
        elapsedHours,
        hourOfDay: deps.clock.hour(),
        playerLevel: deps.player.level(),
        rand: rng.next(),
      });
      if (go) this._start(here.chunkKey, here.plan);
    });

    ctx.on("player:kill", ({ npcId }) => {
      const won = this.rules.onKill(npcId);
      if (!won) return;
      this._raiders.clear();
      this._sheltered.clear();
      deps.feedback.addFame(10);
      deps.feedback.grant({
        gold: won.rewardGold,
        xp: won.rewardXp,
        label: `${won.villageName} is safe — the raiders are beaten`,
      });
      deps.feedback.markDirty();
    });

    // Raids aren't saved: a load mid-raid sends the raiders off.
    ctx.on("save:loaded", () => this._clearAftermath());

    ctx.on("npc:released", ({ npcName }) => {
      for (const set of [this._raiders, this._sheltered]) {
        for (const npc of set) if (npc.mesh.name === npcName) set.delete(npc);
      }
    });

    // Twice a second during a raid: has the player left the village to it?
    ctx.system({
      id: "village-raids.watch",
      phase: "sim",
      update: (dt) => {
        const raid = this.rules.active;
        if (!raid) return;
        this._checkTimer -= dt;
        if (this._checkTimer > 0) return;
        this._checkTimer = 0.5;
        const plan = deps.world.loadedVillage(raid.villageId);
        const p = deps.player.position();
        if (plan && Math.hypot(p.x - plan.center.x, p.z - plan.center.z) < RAID_LEAVE_DISTANCE) return;
        this._clearAftermath();
        deps.feedback.notify(`You left ${raid.villageName} to the raiders.`, 4000);
      },
    });

    ctx.scope.add(() => {
      this._clearAftermath();
      this._deps = null;
    });
  }

  /** Bandits come up the entrance road into the square; townsfolk run indoors. */
  private _start(chunkKey: string, plan: VillagePlan): NPC[] {
    const services = this._deps;
    if (!services) return [];
    const world = services.world;
    const c = plan.center;
    const rx = plan.arrival.x - c.x, rz = plan.arrival.z - c.z;
    const len = Math.hypot(rx, rz) || 1;
    const dir = { x: rx / len, z: rz / len };
    const side = { x: dir.z, z: -dir.x };
    const n = raiderCount(services.player.level());
    const raiders: NPC[] = [];
    for (let i = 0; i < n; i++) {
      const archetype = i === 0 && n >= 4 ? "archetype_bandit_chief"
        : i % 3 === 2 ? "archetype_bandit_archer" : "archetype_bandit";
      const lateral = (i - (n - 1) / 2) * 2.2;
      const back = 26 + (i % 2) * 2;
      const npc = world.spawnArchetype(chunkKey, archetype, c.x + dir.x * back + side.x * lateral, c.z + dir.z * back + side.z * lateral);
      if (!npc) continue;
      this._raiders.add(npc);
      // March in along the road to the square; the combat AI takes over as
      // soon as the player is in range.
      npc.scheduleBlocks = [];
      npc.patrolPoints = [
        new Vector3(plan.arrival.x + side.x * lateral * 0.5, 2, plan.arrival.z + side.z * lateral * 0.5),
        new Vector3(c.x + dir.x * 3 + side.x * lateral, 2, c.z + dir.z * 3 + side.z * lateral),
      ];
      npc.currentPatrolIndex = 0;
      npc.waitTime = 0;
      npc.aiState = AIState.PATROL;
      // Spawned hostiles start flagged aggressive, which leaves movement to
      // the combat AI (which doesn't walk patrols); combat sets it again once
      // they spot the player.
      npc.isAggressive = false;
      raiders.push(npc);
    }
    if (raiders.length === 0) return raiders;
    this.rules.start(plan.id, plan.name, raiders.map((r) => r.mesh.name), services.clock.elapsedHours());
    // Townsfolk hide; guards stay out; nobody vanishes mid-conversation.
    for (const npc of world.residents(chunkKey)) {
      if (npc.isDead || raiders.includes(npc) || world.isIndoors(npc) || world.isTalkingTo(npc)) continue;
      if (/^(Town Guard|Guard)_/.test(npc.mesh.name) || npc.factionId === "bandits") continue;
      world.sendIndoors(npc);
      this._sheltered.add(npc);
    }
    services.feedback.notify(`⚔ Bandits are raiding ${plan.name}! Drive them off.`, 5000);
    services.feedback.markDirty();
    return raiders;
  }

  /** An unbeaten raid ends: raiders leave, townsfolk come out. */
  private _clearAftermath(): void {
    const world = this._deps?.world;
    for (const npc of this._raiders) {
      if (npc.isDead || npc.mesh.isDisposed()) continue;
      world?.despawn(npc);
    }
    this._raiders.clear();
    this.rules.abandon();
    this._sheltered.clear();
  }
}
