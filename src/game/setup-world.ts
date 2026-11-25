/**
 * Start-up, the world's systems: skill progression, projectiles and combat links, cells and structures, fame, effects, respawns, restocks, the character, daily schedules, swimming, disease, world events, animation and the fantasy asset loader.
 *
 * Part of the composition root: a stretch of the game's start-up, moved out
 * of game.ts.
 */
import type { Game } from "../game";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { ChunkContent } from "../world/chunk-content";
import { SkillProgressionSystem } from "../systems/skill-progression-system";
import { LevelScalingSystem } from "../systems/level-scaling-system";
import { FameSystem } from "../systems/fame-system";
import { ActiveEffectsSystem } from "../systems/active-effects-system";
import { JailSystem } from "../systems/jail-system";
import { RespawnSystem } from "../systems/respawn-system";
import { MerchantRestockSystem } from "../systems/merchant-restock-system";
import { DailyScheduleSystem } from "../systems/daily-schedule-system";
import { SwimmingSystem } from "../systems/swimming-system";
import { DiseaseSystem } from "../systems/disease-system";
import { EventManagerSystem } from "../systems/event-manager-system";
import { AnimationSystem } from "../systems/animation-system";
import { FantasyAssetLoader } from "../systems/fantasy-asset-loader";
import { beginPortalTransition, onCellEntered } from "./cells";
import { releaseNpc } from "./npcs";

export function setupWorldSystems(g: Game): void {
  // ── v8 system wiring (Oblivion depth: skill progression, fast travel, level scaling) ──
  g.skillProgressionSystem = new SkillProgressionSystem();
  g.skillProgressionSystem.events = g.eventBus;
  g.saveSystem.setSkillProgressionSystem(g.skillProgressionSystem);
  g.combatSystem.setScalingSystems({
    skillSystem: g.skillProgressionSystem,
    attributeSystem: g.attributeSystem,
  });
  // Lets ranged/magic NPCs fire arrows and bolts at the player.
  g.combatSystem.setProjectileSystem(g.projectileSystem);
  // Bolt-riding status effects (burn, freeze, …) land on the player.
  // Combat reports (hits, blocks, blows taken) go on the bus; gear wear
  // listens in the crafting feature.
  g.projectileSystem.events = g.eventBus;
  g.spellSystem.events = g.eventBus;
  g.combatSystem.events = g.eventBus;
  g.eventBus.on("projectile:playerHit", ({ statusEffect }) => {
    if (statusEffect) g.combatSystem.applyPlayerStatusEffect(statusEffect);
  });
  g.projectileSystem.isPlayerDodging = () => g.combatSystem.isDodging;
  // An arrow or spell that hurts a hostile alerts it, as a blow would.
  g.eventBus.on("combat:hostileHit", ({ npc, damage }) => g.combatSystem.notifyHostileHit(npc, damage));
  g.projectileSystem.setScalingSystems({
    skillSystem: g.skillProgressionSystem,
    attributeSystem: g.attributeSystem,
  });

  // Auto-discover locations when the player enters a new cell (portals use fade + tryTransition)
  g.cellManager.events = g.eventBus;
  g.eventBus.on("cell:changed", ({ cellId, cellName }) => onCellEntered(g, cellId, cellName));
  g.eventBus.on("portal:entered", ({ portalId }) => beginPortalTransition(g, portalId));

  g.levelScalingSystem = new LevelScalingSystem();
  // Scale newly spawned structure NPCs and register them for cleanup
  g.world.structures.events = g.eventBus;
  g.eventBus.on("npc:spawned", ({ npc }) => g._roster.add(npc));
  // The structure disposes its own NPCs.
  g.eventBus.on("npc:removed", ({ npc }) => g._roster.remove(npc, { dispose: false }));

  /** Unified world-state persistence: check if an item belongs to the player or was already taken. */
  // One-off loot the player already holds is not placed again.
  g.world.structures.isLootCollected = (itemId) =>
    g.inventorySystem.items.some((item) => item.id === itemId)
    || [...g.equipmentSystem.getEquipped().values()].some((item) => item.id === itemId);

  // Wire skill XP into spell cast and potion craft callbacks
  // Spell school XP.
  g.eventBus.on("spell:cast", ({ damage, heal }) => {
    if (damage && damage > 0) {
      g.skillProgressionSystem.gainXP("destruction", 10 * g.classSystem.xpMultiplierFor("destruction"));
    } else if (heal && heal > 0) {
      g.skillProgressionSystem.gainXP("restoration", 10 * g.classSystem.xpMultiplierFor("restoration"));
    }
  });

  // ── v9 system wiring (Oblivion parity: fame, active effects, jail) ─────────
  g.fameSystem = new FameSystem();
  g.fameSystem.events = g.eventBus;
  g.saveSystem.setFameSystem(g.fameSystem);

  g.activeEffectsSystem = new ActiveEffectsSystem();
  g.activeEffectsSystem.events = g.eventBus;
  g.saveSystem.setActiveEffectsSystem(g.activeEffectsSystem);

  g.jailSystem = new JailSystem();
  g.saveSystem.setJailSystem(g.jailSystem);

  // ── v10 system wiring (Oblivion depth: spell making, respawn, merchant restock) ──
  g.spellMakingUI.setAnimator(g.uiAnimator);

  g.levelUpUI.setAnimator(g.uiAnimator);

  // RespawnSystem — register the test cave as a respawnable zone (72 game-hours)
  g.respawnSystem = new RespawnSystem();
  g.respawnSystem.registerZone("cave_01", 72);
  g.respawnSystem.events = g.eventBus;
  g.saveSystem.setRespawnSystem(g.respawnSystem);

  // MerchantRestockSystem — restock the starter merchant every 72 game-hours
  g.merchantRestockSystem = new MerchantRestockSystem();
  g.merchantRestockSystem.events = g.eventBus;
  g.saveSystem.setMerchantRestockSystem(g.merchantRestockSystem);

  // Race, birthsign and class: the character feature.
  g.saveSystem.setRaceSystem(g.raceSystem);
  g.saveSystem.setBirthsignSystem(g.birthsignSystem);
  g.saveSystem.setClassSystem(g.classSystem);

  // ── v12 system wiring (Oblivion depth: skill-based character progression) ──
  g.saveSystem.setPlayerLevelSystem(g.playerLevelSystem);

  // ── v18 DailyScheduleSystem ───────────────────────────────────────────────
  // Connects TimeSystem → ScheduleSystem so NPC daily behaviours are driven
  // automatically by the in-game clock.  Also enforces non-interactivity for
  // sleeping NPCs by clearing their mesh.metadata during sleep windows.
  g.dailyScheduleSystem = new DailyScheduleSystem(
    g.scheduleSystem,
    g.timeSystem,
  );
  // No toasts: a village going to bed would post a dozen of them.
  g.dailyScheduleSystem.events = g.eventBus;
  // Villagers who reach their door at bedtime go inside until morning.
  // (The indoors feature takes them inside.)
  g.scheduleSystem.events = g.eventBus;
  g.saveSystem.setDailyScheduleSystem(g.dailyScheduleSystem);

  // ── v20: Swimming system ───────────────────────────────────────────────
  g.swimSystem = new SwimmingSystem();
  // Argonian racial water breathing — suppress breath drain for g race
  if (g.raceSystem.chosenRace?.waterBreathing) {
    g.swimSystem.hasWaterBreathing = true;
  }
  g.swimSystem.events = g.eventBus;
  g.eventBus.on("swim:drowning", () => g.player.notifyDamageTaken());
  g.saveSystem.setSwimmingSystem(g.swimSystem);

  // ── v21: Disease system ────────────────────────────────────────────────
  g.diseaseSystem = new DiseaseSystem();
  // Argonian racial disease immunity — 100 % resistance
  if (g.raceSystem.chosenRace?.id === "argonian") {
    g.diseaseSystem.diseaseResistanceChance = 1.0;
  }
  g.diseaseSystem.events = g.eventBus;
  g.saveSystem.setDiseaseSystem(g.diseaseSystem);

  // Survival needs (hunger / fatigue / cold): the survival feature.

  // ── v22: Event Manager (Dungeon Master) ───────────────────────────────
  g.eventManagerSystem = new EventManagerSystem();
  g.eventManagerSystem.events = g.eventBus;
  g.saveSystem.setEventManagerSystem(g.eventManagerSystem);

  // ── v23 Animation System ───────────────────────────────────────────────
  g.animationSystem = new AnimationSystem(g.scene);

  // ── Fantasy Asset Loader ───────────────────────────────────────────────
  // Preload Babylon CDN models only; Quaternius packs load on first `getInstance`
  // to avoid startup bandwidth, decode work, and memory spikes from ~80+ local GLBs.
  // Remote (Babylon CDN) props stay off unless VITE_ENABLE_REMOTE_PROPS=true, so
  // the offline Steam depot never touches the network.  World *population*
  // (settlement NPCs, shops, trainers, bandit camps, smithies) always runs:
  // with remote props off, CDN buildings are simply absent and local props
  // (Quaternius) still load.  Previously the whole block below was gated,
  // which silently removed every inn/cottage/fort NPC from default builds.
  const remotePropsEnabled = import.meta.env.VITE_ENABLE_REMOTE_PROPS === "true";
  g.fantasyAssets = new FantasyAssetLoader(g.scene, { allowRemote: remotePropsEnabled });
  {
    if (remotePropsEnabled) g.fantasyAssets.preloadRemoteCdnAssets();
    g._chunks = new ChunkContent({
      scene: g.scene,
      assets: g.fantasyAssets,
      lod: g.lodSystem,
      shadows: () => g.shadowGenerator,
      fireFx: () => g._env.fireFx,
      forges: () => g.forges,
      releaseNpc: (npc) => releaseNpc(g, npc),
    });

    // ── Chunk content (placement rules: world-sites feature) ──────────────
  g.world.events = g.eventBus;

    // Dispose chunk-scoped CDN props and NPCs when their chunk unloads so
    // revisiting an area never accumulates duplicate props or entities.
  // After the features' own chunk:unloaded handlers (registered earlier).
  g.eventBus.on("chunk:unloaded", ({ chunkKey }) => {
    g._chunks.close(chunkKey);
    g.navigationSystem.requestRebuild();
  });
  }
}
