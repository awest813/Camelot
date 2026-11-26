/**
 * Village raids as a kernel feature.
 *
 * Rules live in VillageRaidSystem (pure); this module turns them into the
 * world: hourly rolls while the player is in a village, raiders marching up
 * the entrance road, townsfolk sheltering, win and abandon outcomes.
 *
 * Each raid is a framework radiant quest ("Raid on <village>", one step per
 * raider): the quest log shows it, the engine counts the raiders down and
 * the quest bridge pays when the last one falls. Leaving fails it.
 *
 * Inputs:   events `time:hour`, `player:kill`, `save:loaded`, `npc:released`;
 *           services clock, player, feedback, quests, village-world.
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
import type { IndoorsService } from "../indoors/indoors-feature";
import { defendEvent, type RadiantTemplate } from "../../framework/quests/radiant";

/** Hold name used to keep sheltering townsfolk inside. */
const SHELTER_HOLD = "raid";
import { ActorsKey, IndoorsKey, ClockKey, FeedbackKey, PlayerKey, QuestsKey, VillagesKey, type ActorsService, type FeedbackService, type GameClockService, type PlayerService, type QuestsService, type VillagesService, ownSave, ownTransient } from "../services";

/** The raid quest: beat every raider; gold and XP per raider. */
export const RAID_TEMPLATE: RadiantTemplate = {
  id: "village_raid", kind: "defend", name: "Raid on {place}",
  description: "Bandits are raiding {place}. Drive them off before they take the village.",
  objective: "Drive off the raiders ({required})", targetId: "", required: 2,
  rewardGold: 35, xpReward: 25, fameReward: 10, perCount: true,
};

/** Service accessors, resolved at call time (the game provides them). */
interface RaidDeps {
  readonly villages: VillagesService;
  readonly actors: ActorsService;
  readonly indoors: IndoorsService;
  readonly player: PlayerService;
  readonly clock: GameClockService;
  readonly feedback: FeedbackService;
  readonly quests: QuestsService;
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
    ownSave(ctx, { key: "villageRaids", save: () => this.rules.getSaveState(), load: (data) => this.rules.restoreFromSave(data as never) });
    const s = ctx.kernel.services;
    const deps: RaidDeps = {
      get villages() { return s.get(VillagesKey); },
      get actors() { return s.get(ActorsKey); },
      get indoors() { return s.get(IndoorsKey); },
      get player() { return s.get(PlayerKey); },
      get clock() { return s.get(ClockKey); },
      get feedback() { return s.get(FeedbackKey); },
      get quests() { return s.get(QuestsKey); },
    };
    deps.quests.engine.registerRadiantTemplate(RAID_TEMPLATE);
    this._deps = deps;
    const rng = ctx.kernel.rng.stream("raids");

    ctx.provide(RaidsKey, {
      rules: this.rules,
      start: (chunkKey, plan) => this._start(chunkKey, plan),
      isSheltered: (npc) => this._sheltered.has(npc),
    });

    // Hourly roll while the player is in a discovered village.
    ctx.on("time:hour", ({ elapsedHours }) => {
      const here = deps.villages.currentVillage();
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

    // Each raider down is a step of the raid's quest; the last one completes
    // it, and the quest bridge pays.
    ctx.on("player:kill", ({ npcId }) => {
      const raid = this.rules.active;
      if (!raid?.remaining.has(npcId)) return;
      const questId = this._questId(raid);
      const won = this.rules.onKill(npcId);
      deps.quests.apply("custom", defendEvent(questId));
      if (!won) return;
      this._raiders.clear();
      this._endShelter();
      deps.feedback.notify(`${won.villageName} is safe — the raiders are beaten`, 4000);
      deps.feedback.markDirty();
    });

    // Raids aren't saved: a load mid-raid sends the raiders off, and the
    // raid's quest (in the engine's snapshot) fails.
    ownTransient(ctx, "a raid in progress (a load sends the raiders off)", () => {
      this._clearAftermath();
      const engine = deps.quests.engine;
      for (const [id, r] of Object.entries(engine.getSnapshot().radiant ?? {})) {
        if (r.templateId === RAID_TEMPLATE.id) engine.failQuest(id);
      }
    });

    ctx.on("npc:released", ({ npcName }) => {
      for (const set of [this._raiders, this._sheltered]) {
        for (const npc of set) if (npc.key === npcName) set.delete(npc);
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
        const plan = deps.villages.loadedVillage(raid.villageId);
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
    const world = services.actors;
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
    const raid = this.rules.start(plan.id, plan.name, raiders.map((r) => r.key), services.clock.elapsedHours());
    services.quests.engine.startRadiant(RAID_TEMPLATE.id, this._questId(raid), { place: plan.name, required: String(raiders.length) });
    // Townsfolk hide; guards stay out; nobody vanishes mid-conversation.
    for (const npc of world.residents(chunkKey)) {
      if (npc.isDead || raiders.includes(npc) || world.isTalkingTo(npc)) continue;
      if (/^(Town Guard|Guard)_/.test(npc.key) || npc.factionId === "bandits") continue;
      // (Already asleep inside? The hold keeps them in for the raid too.)
      services.indoors.hold(npc, SHELTER_HOLD);
      this._sheltered.add(npc);
    }
    services.feedback.notify(`⚔ Bandits are raiding ${plan.name}! Drive them off.`, 5000);
    services.feedback.markDirty();
    return raiders;
  }

  /** Townsfolk may come out (their schedules decide when). */
  private _endShelter(): void {
    this._sheltered.clear();
    this._deps?.indoors.releaseHolds(SHELTER_HOLD);
  }

  /** The raid's quest: one per raid (village and start hour). */
  private _questId(raid: { villageId: string; startedAt: number }): string {
    return `raid_${raid.villageId}_${Math.round(raid.startedAt)}`;
  }

  /** An unbeaten raid ends: raiders leave, townsfolk come out, its quest fails. */
  private _clearAftermath(): void {
    const raid = this.rules.active;
    if (raid) this._deps?.quests.engine.failQuest(this._questId(raid));
    const world = this._deps?.actors;
    for (const npc of this._raiders) {
      if (npc.isDead || npc.mesh.isDisposed()) continue;
      world?.despawn(npc);
    }
    this._raiders.clear();
    this.rules.abandon();
    this._endShelter();
  }
}
