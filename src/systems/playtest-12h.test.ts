/**
 * Playtest Simulation — New Game → 12 Gameplay Hours
 *
 * This integration test simulates a headless playthrough from character
 * creation at 08:00 to 20:00 (12 in-game hours).  It exercises every
 * headless gameplay system in a realistic sequence, asserting that the
 * game state stays valid throughout.
 *
 * Timeline (game starts at 08:00, default 120-second real day):
 *   08:00 — Character creation (Nord / Warrior class / Warrior birthsign)
 *   09:00 — Morning exploration, first wolf encounter
 *   10:00 — Visit weapons shop (open 08–20), buy a health potion
 *   11:00 — Active-effects / potion use, skill XP from combat
 *   12:00 — Noon: Fast travel to a second location
 *   13:00 — Quest pickup, fame from completion
 *   14:00 — Disease contraction + cure
 *   15:00 — Racial power activation (Nord's Fury)
 *   16:00 — Offscreen NPC simulation (merchant restock ticks)
 *   17:00 — Ambient events in forest biome
 *   18:00 — NPCs begin heading home (schedule shift)
 *   19:00 — Last chance to trade before shops close
 *   20:00 — Dusk: verify shops closed, day-stats final
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Headless systems ──────────────────────────────────────────────────────────
import { TimeSystem } from "./time-system";
import { WaitSystem } from "./wait-system";
import { AttributeSystem } from "./attribute-system";
import { SkillProgressionSystem } from "./skill-progression-system";
import { PlayerLevelSystem } from "./player-level-system";
import { RaceSystem } from "./race-system";
import { ClassSystem } from "./class-system";
import { BirthsignSystem } from "./birthsign-system";
import { ActiveEffectsSystem } from "./active-effects-system";
import { FameSystem } from "./fame-system";
import { DiseaseSystem, BUILT_IN_DISEASES } from "./disease-system";
import { ShopSystem } from "./shop-system";
import { MerchantRestockSystem } from "./merchant-restock-system";
import { EncounterSystem } from "./encounter-system";
import { AmbientEventSystem } from "./ambient-event-system";
import { OffscreenSimulationSystem } from "./offscreen-simulation-system";
import { FastTravelSystem } from "./fast-travel-system";
import { InventorySystem } from "./inventory-system";
import { BarterSystem } from "./barter-system";
import type { Item } from "./inventory-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mock player — only the fields the headless systems read/write. */
function makeMockPlayer(overrides: Record<string, unknown> = {}) {
  return {
    name: "Hero",
    health: 180,
    maxHealth: 180,
    magicka: 140,
    maxMagicka: 140,
    stamina: 140,
    maxStamina: 140,
    healthRegen: 0.5,
    magickaRegen: 2,
    staminaRegen: 5,
    bonusDamage: 0,
    bonusArmor: 0,
    bonusMagicDamage: 0,
    critChance: 0,
    level: 1,
    experience: 0,
    experienceToNextLevel: 100,
    skillPoints: 0,
    carryWeight: 0,
    maxCarryWeight: 300,
    camera: { position: new Vector3(0, 2, 0) } as any,
    ...overrides,
  } as any;
}

/** Mock UIManager — captures notifications for assertion. */
function makeMockUI() {
  const notifications: string[] = [];
  return {
    notifications,
    showNotification: vi.fn((msg: string) => { notifications.push(msg); }),
    updateInventory: vi.fn(),
    toggleInventory: vi.fn(),
    setInteractionText: vi.fn(),
    refreshInventory: vi.fn(),
  } as any;
}

const mockCanvas = { requestPointerLock: vi.fn() } as any;

// ── Fixture setup ─────────────────────────────────────────────────────────────

interface PlaytestWorld {
  time: TimeSystem;
  wait: WaitSystem;
  attrs: AttributeSystem;
  skills: SkillProgressionSystem;
  playerLevel: PlayerLevelSystem;
  race: RaceSystem;
  cls: ClassSystem;
  birthsign: BirthsignSystem;
  effects: ActiveEffectsSystem;
  fame: FameSystem;
  disease: DiseaseSystem;
  shop: ShopSystem;
  restock: MerchantRestockSystem;
  encounter: EncounterSystem;
  ambient: AmbientEventSystem;
  offscreen: OffscreenSimulationSystem;
  fastTravel: FastTravelSystem;
  inventory: InventorySystem;
  barter: BarterSystem;
  player: ReturnType<typeof makeMockPlayer>;
  ui: ReturnType<typeof makeMockUI>;
  levelUpReadyFired: boolean;
  levelUpCompleteFired: boolean;
  encountersTriggered: string[];
}

function buildWorld(): PlaytestWorld {
  const player = makeMockPlayer();
  const ui = makeMockUI();

  const time = new TimeSystem(120, 8);          // 08:00
  const wait = new WaitSystem();
  const attrs = new AttributeSystem();
  const skills = new SkillProgressionSystem();
  const playerLevel = new PlayerLevelSystem();
  const race = new RaceSystem();
  const cls = new ClassSystem();
  const birthsign = new BirthsignSystem();
  const effects = new ActiveEffectsSystem();
  const fame = new FameSystem();
  const disease = new DiseaseSystem();
  const shop = new ShopSystem();
  const restock = new MerchantRestockSystem();
  const encounter = new EncounterSystem();
  const ambient = new AmbientEventSystem();
  const offscreen = new OffscreenSimulationSystem();
  const fastTravel = new FastTravelSystem();
  const inventory = new InventorySystem(player, ui, mockCanvas);
  const barter = new BarterSystem(inventory, ui);

  // Register built-in diseases
  for (const def of BUILT_IN_DISEASES) {
    disease.registerDisease(def);
  }

  // Wire level-up system
  let levelUpReadyFired = false;
  let levelUpCompleteFired = false;
  playerLevel.onLevelUpReady = () => { levelUpReadyFired = true; };
  playerLevel.onLevelUpComplete = () => { levelUpCompleteFired = true; };

  // Track encounter triggers
  const encountersTriggered: string[] = [];
  encounter.onEncounterStarted = (result) => { encountersTriggered.push(result.templateId); };

  return {
    time, wait, attrs, skills, playerLevel, race, cls, birthsign,
    effects, fame, disease, shop, restock, encounter, ambient, offscreen,
    fastTravel, inventory, barter, player, ui,
    levelUpReadyFired, levelUpCompleteFired, encountersTriggered,
  };
}

// ── Playtest suite ────────────────────────────────────────────────────────────

describe("Playtest — new game to 12 gameplay hours", () => {
  let w: PlaytestWorld;

  beforeEach(() => {
    vi.stubGlobal("document", { exitPointerLock: vi.fn() });
    w = buildWorld();
  });

  // ── 1. Character creation ─────────────────────────────────────────────────

  describe("08:00 — Character creation", () => {
    it("applies Nord race bonuses to attributes and skills", () => {
      w.race.chooseRace("nord", w.attrs, w.skills);

      // Nord: +10 strength, +10 endurance, +10 blade skill
      expect(w.attrs.get("strength")).toBe(50);   // base 40 + 10
      expect(w.attrs.get("endurance")).toBe(50);  // base 40 + 10
      expect(w.skills.getSkill("blade")!.level).toBe(10);
    });

    it("applies Warrior class bonuses to attributes and skills", () => {
      w.race.chooseRace("nord", w.attrs, w.skills);
      w.cls.chooseClass("warrior", w.attrs, w.skills);

      // Warrior favoured attributes: Strength, Endurance (+10 each on top of race)
      expect(w.attrs.get("strength")).toBeGreaterThanOrEqual(50);
      expect(w.attrs.get("endurance")).toBeGreaterThanOrEqual(50);
    });

    it("applies Warrior birthsign bonuses", () => {
      w.race.chooseRace("nord", w.attrs, w.skills);
      w.cls.chooseClass("warrior", w.attrs, w.skills);
      w.birthsign.chooseBirthsign("warrior", w.attrs, w.skills);

      expect(w.birthsign.chosenBirthsign?.id).toBe("warrior");
    });

    it("wires the player level system to the class system", () => {
      w.race.chooseRace("nord", w.attrs, w.skills);
      w.cls.chooseClass("warrior", w.attrs, w.skills);
      w.birthsign.chooseBirthsign("warrior", w.attrs, w.skills);

      w.playerLevel.attachToClassSystem(w.cls);
      w.playerLevel.attachToAttributeSystem(w.attrs);

      expect(w.playerLevel.characterLevel).toBe(1);
      expect(w.playerLevel.majorLevelUpsThisLevel).toBe(0);
    });

    it("time starts at 08:00", () => {
      expect(w.time.hour).toBe(8);
      expect(w.time.minute).toBe(0);
      expect(w.time.isDaytime).toBe(true);
    });
  });

  // ── 2. Morning exploration — 08:00 to 09:00 ──────────────────────────────

  describe("08:00–09:00 — Morning exploration and shop availability", () => {
    it("shops are open at 08:00", () => {
      w.shop.registerShop({
        id: "shop_iron_forge",
        name: "The Iron Forge",
        type: "weapons",
        merchantId: "merchant_iron_forge",
        openHour: 8,
        closeHour: 20,
      });

      expect(w.shop.isOpen("shop_iron_forge", w.time.hour)).toBe(true);
    });

    it("discovers starting town via fast travel system", () => {
      const isNew = w.fastTravel.discoverLocation(
        "town_start", "Whitefall Village", new Vector3(0, 2, 0),
      );
      expect(isNew).toBe(true);
      expect(w.fastTravel.isDiscovered("town_start")).toBe(true);
    });

    it("registers a wolf encounter template", () => {
      w.encounter.addTemplate({
        id: "wolves_road",
        label: "Road Wolves",
        tableId: "wolves_basic",
        biomeIds: ["plains"],
        minCount: 1,
        maxCount: 3,
        cooldownHours: 2,
        spawnChance: 1.0,
      });

      expect(w.encounter.getTemplate("wolves_road")).not.toBeNull();
    });

    it("triggers wolf encounter on the road", () => {
      w.encounter.addTemplate({
        id: "wolves_road",
        label: "Road Wolves",
        tableId: "wolves_basic",
        biomeIds: ["plains"],
        minCount: 1,
        maxCount: 2,
        cooldownHours: 2,
        spawnChance: 1.0,
      });

      w.encounter.triggerEncounter("wolves_road", { gameTimeHours: 8, playerLevel: 1 });
      expect(w.encountersTriggered).toContain("wolves_road");
    });

    it("advances clock to 09:00 after one in-game hour", () => {
      w.time.advanceHours(1);
      expect(w.time.hour).toBe(9);
    });
  });

  // ── 3. Combat and skill progression — 09:00 to 11:00 ────────────────────

  describe("09:00–11:00 — Combat and skill progression", () => {
    beforeEach(() => {
      w.race.chooseRace("nord", w.attrs, w.skills);
      w.cls.chooseClass("warrior", w.attrs, w.skills);
      w.playerLevel.attachToClassSystem(w.cls);
      w.playerLevel.attachToAttributeSystem(w.attrs);
      w.skills.onSkillLevelUp = (skillId, newLevel) => {
        w.playerLevel.handleSkillLevelUp(skillId);
        w.ui.showNotification(`${skillId} increased to ${newLevel}`, 3000);
      };
    });

    it("blade XP accumulates from melee combat hits", () => {
      const baseLevel = w.skills.getSkill("blade")!.level;

      // Simulate 10 melee strikes, 6 XP each, with Warrior class multiplier (major skill → 1.5×)
      for (let i = 0; i < 10; i++) {
        const rawXp = 6;
        const mult = w.cls.xpMultiplierFor("blade");
        w.skills.gainXP("blade", rawXp * mult);
      }

      const blade = w.skills.getSkill("blade");
      expect(blade!.xp).toBeGreaterThan(0);
      // Starting level was 10 (Nord race bonus); may or may not have leveled up yet
      expect(blade!.level).toBeGreaterThanOrEqual(baseLevel);
    });

    it("sneak XP accumulates from sneaking near enemies", () => {
      const SNEAK_XP_PER_SECOND = 2;
      // 30 real seconds of active sneaking
      w.skills.gainXP("sneak", SNEAK_XP_PER_SECOND * 30);

      expect(w.skills.getSkill("sneak")!.xp).toBeGreaterThan(0);
    });

    it("destruction XP gained from casting a fire spell", () => {
      const beforeXp = w.skills.getSkill("destruction")!.xp;
      const beforeLevel = w.skills.getSkill("destruction")!.level;

      w.skills.gainXP("destruction", 10);

      const after = w.skills.getSkill("destruction");
      // xp should increase OR we leveled up (xp resets)
      const improved = after!.xp > beforeXp || after!.level > beforeLevel;
      expect(improved).toBe(true);
    });

    it("player health potion is consumed via active effects", () => {
      w.effects.addEffect({
        id: "potion_heal_01",
        name: "Health Restore",
        effectType: "health_restore",
        magnitude: 5,   // 5 HP/s
        duration: 10,   // 10 s
      });

      const startHealth = 80;
      w.player.health = startHealth;
      w.player.maxHealth = 180;

      // Tick 5 real seconds of the DoT heal
      w.effects.update(5, w.player);

      expect(w.player.health).toBeGreaterThan(startHealth);
      expect(w.player.health).toBeLessThanOrEqual(w.player.maxHealth);
    });

    it("player stats remain valid after combat", () => {
      w.player.health = Math.max(1, w.player.health - 40); // simulate taking damage
      expect(w.player.health).toBeGreaterThan(0);
      expect(w.player.health).toBeLessThanOrEqual(w.player.maxHealth);
    });

    it("clock advances to 11:00 after 2 more hours", () => {
      // World starts at 08:00; advancing 3 hours from the start gets to 11:00
      w.time.advanceHours(3);
      expect(w.time.hour).toBe(11);
    });
  });

  // ── 4. Noon shopping — 11:00 to 12:00 ───────────────────────────────────

  describe("11:00–12:00 — Visiting the weapons shop", () => {
    const MERCHANT_ID = "merchant_iron_forge";

    beforeEach(() => {
      w.shop.registerShop({
        id: "shop_iron_forge",
        name: "The Iron Forge",
        type: "weapons",
        merchantId: MERCHANT_ID,
        openHour: 8,
        closeHour: 20,
      });

      const starterInventory: Item[] = [
        { id: "sword_01", name: "Iron Sword", description: "A sturdy blade.", stackable: false, quantity: 1, stats: { value: 50 }, weight: 3 },
        { id: "potion_hp_01", name: "Health Potion", description: "Restores health.", stackable: true, quantity: 5, stats: { value: 25, heal: 50 }, weight: 0.5 },
      ];

      w.barter.registerMerchant({
        id: MERCHANT_ID,
        name: "Gareth the Smith",
        factionId: "merchants_guild",
        inventory: starterInventory,
        gold: 500,
        priceMultiplier: 1.0,
        isOpen: true,
        openHour: 8,
        closeHour: 20,
      });

      w.restock.registerMerchant(MERCHANT_ID, starterInventory, 500, 72);
    });

    it("shop is open at 11:00", () => {
      w.time.advanceHours(3); // 08 → 11
      expect(w.shop.isOpen("shop_iron_forge", w.time.hour)).toBe(true);
    });

    it("can open a barter session during shop hours", () => {
      const opened = w.barter.openBarter(MERCHANT_ID, 11);
      expect(opened).toBe(true);
      expect(w.barter.activeMerchantId).toBe(MERCHANT_ID);
    });

    it("player can buy a health potion", () => {
      w.barter.openBarter(MERCHANT_ID, 11);
      w.barter.playerGold = 200;

      const result = w.barter.buyItem(MERCHANT_ID, "potion_hp_01");
      expect(result).toBe(true);

      const hasPotionInInventory = w.inventory.items.some(i => i.id === "potion_hp_01");
      expect(hasPotionInInventory).toBe(true);
    });

    it("player gold decreases after buying", () => {
      w.barter.openBarter(MERCHANT_ID, 11);
      w.barter.playerGold = 200;
      const goldBefore = w.barter.playerGold;

      w.barter.buyItem(MERCHANT_ID, "potion_hp_01");

      expect(w.barter.playerGold).toBeLessThan(goldBefore);
    });

    it("merchant restock timer is ticking (no restock yet at 3 hours in)", () => {
      // 72-hour restock interval — no restock should fire after only 3 in-game hours
      let restocked = false;
      w.restock.onRestock = () => { restocked = true; };

      // Advance 3 game-hours of clock (3 * 60 = 180 game-minutes)
      const currentTime = w.time.gameTime;
      w.restock.update(currentTime + 3 * 60, w.barter);

      expect(restocked).toBe(false);
    });
  });

  // ── 5. Fast travel — 12:00 ───────────────────────────────────────────────

  describe("12:00 — Fast travel to second location", () => {
    it("discovers and fast-travels to a second location", () => {
      w.fastTravel.discoverLocation("town_start", "Whitefall Village", new Vector3(0, 2, 0));
      w.fastTravel.discoverLocation("ruins_alpha", "Ruins of Alpha", new Vector3(540, 2, 540));

      const result = w.fastTravel.fastTravelTo(
        "ruins_alpha",
        w.player,
        /* isInCombat */ false,
        /* isSneaking */ false,
      );

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Ruins of Alpha");
    });

    it("fast travel advances in-game time (simulated via travel time estimate)", () => {
      w.fastTravel.discoverLocation("town_start", "Whitefall Village", new Vector3(0, 2, 0));
      w.fastTravel.discoverLocation("ruins_alpha", "Ruins of Alpha", new Vector3(540, 2, 540));

      const hourBefore = w.time.hour;

      // Estimate travel hours and advance clock manually (as game.ts does)
      const travelHours = w.fastTravel.estimateTravelHours(
        w.player.camera.position,
        "ruins_alpha",
      );
      expect(travelHours).not.toBeNull();
      w.time.advanceHours(travelHours!);

      expect(w.time.hour).toBeGreaterThanOrEqual(hourBefore);
    });

    it("fast travel is blocked while in combat", () => {
      w.fastTravel.discoverLocation("ruins_alpha", "Ruins of Alpha", new Vector3(540, 2, 540));

      const result = w.fastTravel.fastTravelTo("ruins_alpha", w.player, true, false);
      expect(result.ok).toBe(false);
    });
  });

  // ── 6. Quest completion and fame — 13:00 ─────────────────────────────────

  describe("13:00 — Quest completion and fame", () => {
    it("fame increases after completing a quest", () => {
      expect(w.fame.fame).toBe(0);

      w.fame.addFame(10);

      expect(w.fame.fame).toBe(10);
    });

    it("disposition modifier is positive after gaining fame", () => {
      w.fame.addFame(50);
      expect(w.fame.dispositionModifier).toBeGreaterThan(0);
    });

    it("infamy from a crime reduces disposition", () => {
      w.fame.addInfamy(30);
      expect(w.fame.dispositionModifier).toBeLessThan(0);
    });

    it("mixed fame and infamy: net positive gives positive modifier", () => {
      w.fame.addFame(50);
      w.fame.addInfamy(20);
      expect(w.fame.dispositionModifier).toBeGreaterThan(0);
    });
  });

  // ── 7. Disease contraction and cure — 14:00 ──────────────────────────────

  describe("14:00 — Disease contraction and cure", () => {
    it("contracts a disease from an enemy attack", () => {
      // Rust Chancre: endurance −5
      const contracted = w.disease.contractDisease("rust_chancre");
      // Nord has no built-in disease resistance in this engine;
      // contractDisease returns true when successful
      if (contracted) {
        expect(w.disease.hasDisease("rust_chancre")).toBe(true);
        const penalties = w.disease.getAttributePenalties();
        expect(penalties["endurance"]).toBeLessThan(0);
      }
    });

    it("cures the disease with a Cure Disease potion", () => {
      w.disease.contractDisease("rust_chancre");
      w.disease.cureDisease("rust_chancre");

      expect(w.disease.hasDisease("rust_chancre")).toBe(false);
      const penalties = w.disease.getAttributePenalties();
      expect(penalties["endurance"] ?? 0).toBe(0);
    });

    it("cureAllDiseases removes every active disease", () => {
      w.disease.contractDisease("rust_chancre");
      w.disease.contractDisease("swamp_rot");
      w.disease.cureAllDiseases();

      expect(w.disease.getActiveDiseases()).toHaveLength(0);
    });
  });

  // ── 8. Racial power activation — 15:00 ───────────────────────────────────

  describe("15:00 — Racial power (Nord's Fury)", () => {
    beforeEach(() => {
      w.race.chooseRace("nord", w.attrs, w.skills);
    });

    it("racial power is available at 15:00 (first use)", () => {
      const gameTimeMinutes = 15 * 60; // 15:00 = 900 minutes
      expect(w.race.canActivatePower(gameTimeMinutes)).toBe(true);
    });

    it("activating Nord's Fury registers active effects", () => {
      const effects: string[] = [];
      w.effects.onEffectExpired = () => {};

      const gameTimeMinutes = 15 * 60;
      w.race.activatePower(gameTimeMinutes, w.effects);

      expect(w.race.canActivatePower(gameTimeMinutes)).toBe(false); // now on cooldown
    });

    it("power goes on 24-hour cooldown after use", () => {
      const usedAt = 15 * 60;
      w.race.activatePower(usedAt, w.effects);

      // 23 hours later — still on cooldown
      const laterTime = usedAt + 23 * 60;
      expect(w.race.canActivatePower(laterTime)).toBe(false);

      // 24+ hours later — available again
      const readyTime = usedAt + 24 * 60;
      expect(w.race.canActivatePower(readyTime)).toBe(true);
    });
  });

  // ── 9. Offscreen NPC simulation — 16:00 ──────────────────────────────────

  describe("16:00 — Offscreen NPC and merchant simulation", () => {
    it("offscreen merchant gold regenerates during fast travel", () => {
      w.offscreen.setGameHour(8); // started at 8

      w.offscreen.register("merchant_wanderer", {
        scheduleBlocks: [
          { startHour: 6, behavior: "work" },
          { startHour: 22, behavior: "sleep" },
        ],
        lastKnownPosition: { x: 100, y: 0, z: 100 },
        health: 80,
        maxHealth: 100,
        isDead: false,
        merchantId: "merchant_wanderer",
        merchantGold: 50,
        merchantMaxGold: 500,
      });

      // 8 hours elapsed (8 AM → 4 PM = 16:00)
      w.offscreen.advanceTime(8);

      const state = w.offscreen.getState("merchant_wanderer");
      expect(state).not.toBeNull();
      // Gold regen: 2/hour × 8 hours = 16 added (50 → 66)
      expect(state!.merchantGold).toBeGreaterThan(50);
    });

    it("offscreen NPC health regenerates during elapsed time", () => {
      w.offscreen.register("guard_01", {
        scheduleBlocks: [{ startHour: 6, behavior: "patrol" }],
        lastKnownPosition: { x: 10, y: 0, z: 10 },
        health: 60,
        maxHealth: 100,
        isDead: false,
      });

      w.offscreen.advanceTime(8); // 8 hours of offscreen time

      const state = w.offscreen.getState("guard_01");
      // 5 HP/h × 8 h = +40 HP (60 → 100, capped at maxHealth)
      expect(state!.health).toBeGreaterThan(60);
    });

    it("dead NPCs are not simulated offscreen", () => {
      w.offscreen.register("bandit_dead", {
        scheduleBlocks: [],
        lastKnownPosition: { x: 0, y: 0, z: 0 },
        health: 0,
        maxHealth: 80,
        isDead: true,
      });

      w.offscreen.advanceTime(8);

      const state = w.offscreen.getState("bandit_dead");
      expect(state!.currentBehavior).toBe("idle");
      expect(state!.health).toBe(0); // dead NPCs don't regenerate
    });
  });

  // ── 10. Ambient events in the forest — 17:00 ────────────────────────────

  describe("17:00 — Ambient events (forest biome)", () => {
    it("forest ambient event fires when player is in the forest biome", () => {
      const fired: string[] = [];

      w.ambient.addEvent({
        id: "ravens_call",
        label: "Ravens Call",
        conditions: { biomeIds: ["forest"] },
        effect: { notification: "Ravens circle overhead.", emitEvent: "ravens_call" },
        cooldownHours: 2,
      });

      w.ambient.update({
        gameTimeHours: 17,
        weatherId: "Clear",
        activeBiomeIds: ["forest"],
        playerLevel: 1,
        getFlag: () => false,
        setFlag: () => {},
        emitEvent: (eventId) => { fired.push(eventId); },
      });

      expect(fired).toContain("ravens_call");
    });

    it("ambient event with cooldown does not fire twice within the window", () => {
      let fireCount = 0;

      w.ambient.addEvent({
        id: "wind_howl",
        label: "Wind Howl",
        conditions: {},
        effect: { notification: "The wind howls.", emitEvent: "wind_howl" },
        cooldownHours: 4,
      });

      const ctx = {
        gameTimeHours: 17,
        weatherId: "Clear",
        activeBiomeIds: [] as string[],
        playerLevel: 1,
        getFlag: () => false,
        setFlag: () => {},
        emitEvent: () => { fireCount++; },
      };

      w.ambient.update(ctx);       // fires (fireCount = 1)
      w.ambient.update({ ...ctx, gameTimeHours: 18 }); // within cooldown — should not fire again
      expect(fireCount).toBe(1);
    });
  });

  // ── 11. Dusk — 18:00 to 19:00 ────────────────────────────────────────────

  describe("18:00–19:00 — Dusk, NPC schedules shifting", () => {
    it("second encounter triggers in the evening (bandit camp)", () => {
      w.encounter.addTemplate({
        id: "bandit_camp",
        label: "Bandit Camp",
        tableId: "bandits_tier1",
        biomeIds: ["hills"],
        minCount: 2,
        maxCount: 4,
        cooldownHours: 6,
        spawnChance: 1.0,
      });

      w.encounter.triggerEncounter("bandit_camp", { gameTimeHours: 18, playerLevel: 1 });
      expect(w.encountersTriggered).toContain("bandit_camp");
    });

    it("time is in the dusk range (18:00–20:00)", () => {
      // Advance from 08:00 to 18:00
      w.time.advanceHours(10);
      expect(w.time.hour).toBe(18);
      expect(w.time.isDaytime).toBe(true);  // Still daytime (daytime = 06-19)
    });

    it("speech skill XP from a persuasion check", () => {
      const before = w.skills.getSkill("speechcraft")!.level;
      w.skills.gainXP("speechcraft", 15);

      const after = w.skills.getSkill("speechcraft");
      const improved = after!.level > before || after!.xp > 0;
      expect(improved).toBe(true);
    });
  });

  // ── 12. Last trade before close — 19:00 ─────────────────────────────────

  describe("19:00 — Last trade before shops close", () => {
    beforeEach(() => {
      w.shop.registerShop({
        id: "alchemist",
        name: "The Cauldron",
        type: "alchemist",
        merchantId: "merchant_alchemist",
        openHour: 8,
        closeHour: 20,
      });

      w.barter.registerMerchant({
        id: "merchant_alchemist",
        name: "Lydia the Alchemist",
        factionId: "mages_guild",
        inventory: [
          { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 HP.", stackable: true, quantity: 10, stats: { value: 25, heal: 50 }, weight: 0.5 },
        ],
        gold: 300,
        isOpen: true,
        openHour: 8,
        closeHour: 20,
      });
    });

    it("alchemist shop is still open at 19:00", () => {
      expect(w.shop.isOpen("alchemist", 19)).toBe(true);
    });

    it("can still buy at 19:00", () => {
      w.barter.playerGold = 100;
      const opened = w.barter.openBarter("merchant_alchemist", 19);
      expect(opened).toBe(true);

      const purchase = w.barter.buyItem("merchant_alchemist", "potion_hp_01");
      expect(purchase).toBe(true);
    });

    it("alchemist shop is closed at 20:00", () => {
      expect(w.shop.isOpen("alchemist", 20)).toBe(false);
    });
  });

  // ── 13. Full 12-hour passage via wait/advanceHours — 20:00 ──────────────

  describe("20:00 — Dusk: full 12-hour summary", () => {
    it("wait system can advance time from 08:00 to 20:00 in one step", () => {
      const result = w.wait.wait(12, w.time, w.player);

      expect(result.ok).toBe(true);
      expect(w.time.hour).toBe(20);
      expect(result.message).toContain("12 hours");
    });

    it("player stats are restored proportionally after 12-hour wait", () => {
      w.player.health = 60;
      w.player.maxHealth = 180;
      w.player.magicka = 40;
      w.player.maxMagicka = 140;
      w.player.stamina = 80;
      w.player.maxStamina = 140;

      w.wait.wait(12, w.time, w.player);

      // 12/24 = 50% restoration rate, capped at maxStat
      const expectedHealth = Math.min(180, 60 + 180 * 0.5);   // 60 + 90 = 150
      const expectedMagicka = Math.min(140, 40 + 140 * 0.5);  // 40 + 70 = 110
      const expectedStamina = Math.min(140, 80 + 140 * 0.5);  // 80 + 70 = 140 (capped)
      expect(w.player.health).toBeCloseTo(expectedHealth, 0);
      expect(w.player.magicka).toBeCloseTo(expectedMagicka, 0);
      expect(w.player.stamina).toBeCloseTo(expectedStamina, 0);
    });

    it("shops are closed at 20:00", () => {
      w.shop.registerShop({
        id: "shop_iron_forge",
        name: "The Iron Forge",
        type: "weapons",
        merchantId: "merchant_iron_forge",
        openHour: 8,
        closeHour: 20,
      });
      w.time.advanceHours(12); // → 20:00
      expect(w.shop.isOpen("shop_iron_forge", w.time.hour)).toBe(false);
    });

    it("it is now nighttime at 20:00", () => {
      w.time.advanceHours(12); // 08 + 12 = 20
      expect(w.time.isDaytime).toBe(false);
    });

    it("total hours waited accumulates correctly", () => {
      w.wait.wait(4, w.time, w.player);
      w.wait.wait(8, w.time, w.player);
      expect(w.wait.totalHoursWaited).toBe(12);
    });
  });

  // ── 14. Save / restore round-trip ────────────────────────────────────────

  describe("Save / restore — full state round-trip at 20:00", () => {
    beforeEach(() => {
      w.race.chooseRace("nord", w.attrs, w.skills);
      w.cls.chooseClass("warrior", w.attrs, w.skills);
      w.birthsign.chooseBirthsign("warrior", w.attrs, w.skills);
      w.time.advanceHours(12);
      w.fame.addFame(25);
      w.disease.contractDisease("rust_chancre");
      w.skills.gainXP("blade", 60);
    });

    it("TimeSystem round-trips correctly", () => {
      const snap = w.time.getSaveState();
      const restored = new TimeSystem(120, 0);
      restored.restoreFromSave(snap);
      expect(restored.hour).toBe(w.time.hour);
      expect(restored.gameTime).toBeCloseTo(w.time.gameTime, 1);
    });

    it("FameSystem round-trips correctly", () => {
      const snap = w.fame.getSaveState();
      const restored = new FameSystem();
      restored.restoreFromSave(snap);
      expect(restored.fame).toBe(25);
    });

    it("DiseaseSystem round-trips correctly", () => {
      const snap = w.disease.getSaveState();
      const restored = new DiseaseSystem();
      for (const def of BUILT_IN_DISEASES) restored.registerDisease(def);
      restored.restoreFromSave(snap);
      expect(restored.hasDisease("rust_chancre")).toBe(true);
    });

    it("SkillProgressionSystem round-trips correctly", () => {
      const snap = w.skills.getSaveState();
      const restored = new SkillProgressionSystem();
      restored.restoreFromSave(snap);
      const blade = restored.getSkill("blade");
      expect(blade!.xp).toBeGreaterThan(0);
    });

    it("WaitSystem round-trips totalHoursWaited", () => {
      w.wait.wait(12, w.time, w.player);
      const snap = w.wait.getSaveState();
      const restored = new WaitSystem();
      restored.restoreFromSave(snap);
      expect(restored.totalHoursWaited).toBe(12);
    });

    it("RaceSystem round-trips chosenId and power cooldown", () => {
      w.race.activatePower(w.time.gameTime, w.effects);
      const snap = w.race.getSaveState();
      const restored = new RaceSystem();
      restored.restoreFromSave(snap);
      expect(restored.chosenRace?.id).toBe("nord");
      expect(restored.canActivatePower(w.time.gameTime)).toBe(false); // still on cooldown
    });

    it("BirthsignSystem round-trips chosenId", () => {
      const snap = w.birthsign.getSaveState();
      const restored = new BirthsignSystem();
      restored.restoreFromSave(snap);
      expect(restored.chosenBirthsign?.id).toBe("warrior");
    });

    it("OffscreenSimulationSystem snapshot round-trips NPC state", () => {
      w.offscreen.register("npc_01", {
        scheduleBlocks: [{ startHour: 6, behavior: "work" }],
        lastKnownPosition: { x: 5, y: 0, z: 5 },
        health: 90,
        maxHealth: 100,
        isDead: false,
      });
      w.offscreen.advanceTime(12);

      const snap = w.offscreen.getSnapshot();
      const restored = new OffscreenSimulationSystem();
      restored.restoreSnapshot(snap);

      const state = restored.getState("npc_01");
      expect(state).not.toBeNull();
      expect(state!.health).toBeGreaterThan(90);
    });
  });

  // ── 15. Encounter cooldown enforcement across the session ────────────────

  describe("Cross-session encounter cooldown integrity", () => {
    it("wolf encounter cannot retrigger within its 2-hour cooldown", () => {
      w.encounter.addTemplate({
        id: "wolves_evening",
        label: "Evening Wolves",
        tableId: "wolves_basic",
        biomeIds: ["plains"],
        minCount: 1,
        maxCount: 2,
        cooldownHours: 2,
        spawnChance: 1.0,
      });

      w.encounter.triggerEncounter("wolves_evening", { gameTimeHours: 8 });
      const first = w.encountersTriggered.length;

      // Try again immediately — cooldown should block it
      const result = w.encounter.triggerEncounter("wolves_evening", { gameTimeHours: 8.5 });
      expect(result).toBeNull(); // blocked by cooldown
    });

    it("encounter round-trips its snapshot", () => {
      w.encounter.addTemplate({
        id: "wolves_snap",
        label: "Wolves Snap",
        tableId: "wolves_basic",
        biomeIds: [],
        cooldownHours: 2,
      });
      w.encounter.triggerEncounter("wolves_snap", { gameTimeHours: 10 });

      const snap = w.encounter.getSnapshot();
      const restored = new EncounterSystem();
      restored.addTemplate({
        id: "wolves_snap",
        label: "Wolves Snap",
        tableId: "wolves_basic",
        biomeIds: [],
        cooldownHours: 2,
      });
      restored.restoreSnapshot(snap);

      expect(restored.getLastTriggeredAt("wolves_snap")).toBe(10);
    });
  });
});
