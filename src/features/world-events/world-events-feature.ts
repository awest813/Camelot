/**
 * World events as a kernel feature: hourly dynamic events (caches, lost
 * supplies, chained follow-ups), hourly ambient flavour, and the travel
 * events rolled on fast-travel arrival.
 *
 * Inputs:   event `time:hour`; services clock, player, world-state, feedback,
 *           loot.  Fast travel rolls travel events through the `world-events`
 *           service.
 * Outputs:  the `world-events` service (the three systems, for saving and rolls).
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { DynamicWorldEventSystem } from "../../systems/dynamic-world-event-system";
import { TravelEventSystem } from "../../systems/travel-event-system";
import { AmbientEventSystem } from "../../systems/ambient-event-system";
import { FeedbackKey, LootKey, PlayerKey, WorldStateKey } from "../services";

export interface WorldEventsService {
  readonly dynamic: DynamicWorldEventSystem;
  readonly travel: TravelEventSystem;
  readonly ambient: AmbientEventSystem;
}

export const WorldEventsKey = createServiceKey<WorldEventsService>("world-events");

export class WorldEventsFeature implements Feature {
  public readonly id = "world-events";
  public readonly dynamic = new DynamicWorldEventSystem();
  public readonly travel = new TravelEventSystem();
  public readonly ambient = new AmbientEventSystem();

  constructor() {
    // ── Dynamic world events ────────────────────────────────────────────────
    this.dynamic.addTemplate({
      id: "roadside_bandit_cache",
      label: "Roadside Bandit Cache",
      description: "Fresh tracks lead to a small stash left by raiders.",
      tableId: "treasure_chest",
      minCount: 1,
      maxCount: 1,
      cooldownHours: 36,
      baseChance: 0.08,
      hostileFactionIds: ["bandits"],
      factionThreatMultiplier: 1.75,
      nightMultiplier: 1.4,
      rewards: { xp: 20, gold: 15, label: "Recovered a roadside cache" },
      chainEventId: "hidden_cache_followup",
    });
    this.dynamic.addTemplate({
      id: "storm_lost_supplies",
      label: "Lost Supplies",
      description: "Bad weather uncovers a dropped bundle near the road.",
      tableId: "common_loot",
      minCount: 1,
      maxCount: 2,
      cooldownHours: 24,
      baseChance: 0.05,
      boostedWeatherIds: ["rain", "storm"],
      weatherBoostMultiplier: 2.5,
      rewards: { xp: 10, gold: 8, label: "Found storm-scattered supplies" },
    });
    this.dynamic.addTemplate({
      id: "hidden_cache_followup",
      label: "Hidden Cache",
      description: "The first stash points toward a better-hidden cache nearby.",
      tableId: "treasure_chest",
      minCount: 1,
      maxCount: 1,
      cooldownHours: 72,
      baseChance: 0.12,
      rewards: { xp: 35, gold: 30, label: "Uncovered a hidden cache" },
    });

    // ── Travel events (rolled on fast-travel arrival) ───────────────────────
    this.travel.addEvent({
      id: "travel_wanderer_rumor",
      label: "Wandering Hunter",
      description: "A hunter by the road shares rumors of old ruins.",
      conditions: { biomeIds: ["plains", "forest"] },
      outcome: { notification: "A wandering hunter trades rumors with you about old ruins nearby." },
      weight: 2,
      cooldownHours: 24,
    });
    this.travel.addEvent({
      id: "travel_sandstorm_tales",
      label: "Desert Caravan",
      description: "A caravan merchant warns of sandstorms ahead.",
      conditions: { biomeIds: ["desert"] },
      outcome: { notification: "A caravan merchant warns you: 'The dunes are restless this season.'" },
      weight: 2,
      cooldownHours: 24,
    });
    this.travel.addEvent({
      id: "travel_storm_refuge",
      label: "Storm Refuge",
      description: "You share shelter with a fellow traveler during a downpour.",
      conditions: { weather: ["rain", "storm"] },
      outcome: { notification: "You shelter from the storm beside a fellow traveler and swap stories." },
      weight: 3,
      cooldownHours: 12,
    });
    this.travel.addEvent({
      id: "travel_frost_warning",
      label: "Frostbitten Scout",
      description: "A half-frozen scout stumbles out of the snow.",
      conditions: { biomeIds: ["tundra"], minPlayerLevel: 2 },
      outcome: { notification: "A frostbitten scout mutters about shapes moving in the whiteout before wandering off." },
      weight: 2,
      cooldownHours: 24,
    });

    // ── Ambient events (hourly flavour) ─────────────────────────────────────
    this.ambient.addEvent({
      id: "ambient_wolf_howl",
      label: "Wolf Howl",
      conditions: { timeRange: { minHour: 20, maxHour: 5 }, biomeIds: ["forest", "tundra"] },
      effect: { notification: "A wolf howls somewhere in the dark." },
      cooldownHours: 8,
    });
    this.ambient.addEvent({
      id: "ambient_shooting_star",
      label: "Shooting Star",
      conditions: { timeRange: { minHour: 22, maxHour: 4 }, weather: ["clear"] },
      effect: { notification: "A shooting star streaks across the night sky." },
      cooldownHours: 12,
    });
    this.ambient.addEvent({
      id: "ambient_market_news",
      label: "Traveling News",
      conditions: { timeRange: { minHour: 8, maxHour: 18 } },
      effect: { notification: "You overhear travelers gossiping about bandit trouble on the trade road." },
      cooldownHours: 10,
    });
    this.ambient.addEvent({
      id: "ambient_birdsong",
      label: "Birdsong",
      conditions: { timeRange: { minHour: 6, maxHour: 10 }, biomeIds: ["forest", "plains"], weather: ["clear", "overcast"] },
      effect: { notification: "Birdsong fills the morning air." },
      cooldownHours: 6,
    });
  }

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    ctx.provide(WorldEventsKey, { dynamic: this.dynamic, travel: this.travel, ambient: this.ambient });

    this.dynamic.onEventFired = (result) => {
      s.get(FeedbackKey).notify(`World event: ${result.label}`, 2500);
      // The event's goods appear as findable caches near the player; the
      // XP / gold reward arrives through onRewardGranted.
      s.get(LootKey).dropNear(result.tableId, Math.max(1, Math.min(3, result.count)));
    };
    this.dynamic.onRewardGranted = (reward) => s.get(FeedbackKey).grant({ ...reward, label: reward.label ?? "World event" });
    this.ambient.onEventTriggered = (_id, effect) => {
      if (effect.notification) s.get(FeedbackKey).notify(effect.notification, 3000);
    };
    ctx.scope.add(() => {
      this.dynamic.onEventFired = null;
      this.dynamic.onRewardGranted = null;
      this.ambient.onEventTriggered = null;
    });

    ctx.on("time:hour", ({ hour, elapsedHours }) => {
      const world = s.get(WorldStateKey);
      const player = s.get(PlayerKey);
      this.dynamic.update({
        gameTimeHours: elapsedHours,
        playerLevel: player.level(),
        activeFactionIds: world.hasBounty() ? ["bandits"] : [],
        weatherId: world.weather() as never,
      });
      const p = player.position();
      this.ambient.update({
        gameTimeHours: elapsedHours % 24,
        weatherId: world.weather() as never,
        activeBiomeIds: [world.biomeAt(p.x, p.z)],
        playerLevel: player.level(),
      });
      void hour;
    });
  }
}
