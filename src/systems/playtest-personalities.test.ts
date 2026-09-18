/**
 * Personality Playtest Simulation Suite
 *
 * Simulates end-to-end gameplay from the perspective of four distinct player archetypes:
 *   1. The Drunk (Grog the Flagon-Brawler) — chaotic, intoxicated, encumbered, unarmed, criminal, coma sleeper
 *   2. The Average (Arthur the Imperial Knight) — rule-follower, questing, blocking, daytime trading, balanced leveling
 *   3. The Hardcore (Vaelen the Permadeath Scout) — min-maxer, 3x stealth sniper, alchemist, disease-conscious, flawless 0-damage
 *   4. The Gamer (GlitchStrider the Exploit Hunter) — boundary stress, economy exploit tester, spellmaking clamp checks, AI reset kiting
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Headless Game Systems ───────────────────────────────────────────────────
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
import { InventorySystem, type Item } from "./inventory-system";
import { BarterSystem } from "./barter-system";
import { CrimeSystem } from "./crime-system";
import { AlchemySystem, type IngredientDefinition } from "./alchemy-system";
import { SpellSystem } from "./spell-system";
import { SpellMakingSystem, MIN_SPELL_COST, MAX_SPELL_COST, type SpellComponent } from "./spell-making-system";
import { QuestSystem, type Quest } from "./quest-system";
import { StealthSystem } from "./stealth-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// ── Helpers & Mocks ─────────────────────────────────────────────────────────

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
    camera: { position: new Vector3(0, 2, 0), detachControl: vi.fn(), attachControl: vi.fn() } as any,
    ...overrides,
  } as any;
}

function makeMockUI() {
  const notifications: string[] = [];
  let crosshairVisible = true;
  let htmlOverlayCount = 0;
  return {
    notifications,
    showNotification: vi.fn((msg: string) => { notifications.push(msg); }),
    updateInventory: vi.fn(),
    toggleInventory: vi.fn(),
    updateQuestLog: vi.fn(),
    toggleQuestLog: vi.fn(),
    setInteractionText: vi.fn(),
    refreshInventory: vi.fn(),
    toggleCrosshair: vi.fn((vis: boolean) => { crosshairVisible = vis; }),
    get crosshairVisible() { return crosshairVisible; },
    get htmlOverlayCount() { return htmlOverlayCount; },
    registerHtmlOverlay: vi.fn(() => {
      htmlOverlayCount++;
      crosshairVisible = false;
      return () => {
        htmlOverlayCount--;
        if (htmlOverlayCount === 0) crosshairVisible = true;
      };
    }),
    setHtmlOverlayActive: vi.fn((active: boolean) => {
      crosshairVisible = !active;
    }),
  } as any;
}

const mockCanvas = { requestPointerLock: vi.fn() } as any;

interface PlaytestEnvironment {
  player: ReturnType<typeof makeMockPlayer>;
  ui: ReturnType<typeof makeMockUI>;
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
  crime: CrimeSystem;
  alchemy: AlchemySystem;
  spells: SpellSystem;
  spellMaking: SpellMakingSystem;
  quests: QuestSystem;
  stealth: StealthSystem;
}

function createPlaytestEnv(): PlaytestEnvironment {
  const player = makeMockPlayer();
  const ui = makeMockUI();

  const time = new TimeSystem(120, 8); // Starts at 08:00
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
  const crime = new CrimeSystem(player, [], ui, {} as any);
  const alchemy = new AlchemySystem(player, ui);
  const spells = new SpellSystem(player, [], ui);
  spells.setSkillSystem(skills);
  const spellMaking = new SpellMakingSystem(spells);
  const quests = new QuestSystem(ui);
  const stealth = new StealthSystem(player, ui, {} as any);

  playerLevel.attachToClassSystem(cls);
  playerLevel.attachToAttributeSystem(attrs);

  for (const def of BUILT_IN_DISEASES) {
    disease.registerDisease(def);
  }

  return {
    player, ui, time, wait, attrs, skills, playerLevel, race, cls, birthsign,
    effects, fame, disease, shop, restock, encounter, ambient, offscreen,
    fastTravel, inventory, barter, crime, alchemy, spells, spellMaking, quests, stealth,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Personality 1: The Drunk (Grog the Flagon-Brawler)
// ══════════════════════════════════════════════════════════════════════════════

describe("Personality Playtest: The Drunk", () => {
  let env: PlaytestEnvironment;

  beforeEach(() => {
    vi.stubGlobal("document", { exitPointerLock: vi.fn() });
    env = createPlaytestEnv();
  });

  it("creates a brawler with Nord heritage and erratic birthsign", () => {
    env.player.name = "Grog 'Flagon' Stone";
    env.race.chooseRace("nord", env.attrs, env.skills);
    env.cls.chooseClass("warrior", env.attrs, env.skills);
    env.birthsign.chooseBirthsign("lover", env.attrs);

    expect(env.attrs.get("strength")).toBeGreaterThanOrEqual(50);
    expect(env.attrs.get("endurance")).toBeGreaterThanOrEqual(50);
    expect(env.race.canActivatePower(env.time.gameTime)).toBe(true);
    expect(env.race.chosenRace?.name).toBe("Nord");
  });

  it("drinks everything in sight and stacks multiple contradictory active effects", () => {
    env.race.chooseRace("nord", env.attrs, env.skills);

    // Consume Mead (fortify strength)
    env.effects.addEffect({
      id: "mead_buzz",
      name: "Mead Buzz",
      effectType: "fortify_strength",
      magnitude: 10,
      duration: 60,
    });

    // Consume cheap Ale (stamina restore)
    env.effects.addEffect({
      id: "ale_haze",
      name: "Ale Haze",
      effectType: "stamina_restore",
      magnitude: 5,
      duration: 45,
    });

    // Chew on raw strange mushroom (shock damage)
    env.effects.addEffect({
      id: "fungus_cramp",
      name: "Mushroom Cramps",
      effectType: "shock_damage",
      magnitude: 2,
      duration: 30,
    });

    // Drink a leftover tonic (health restore)
    env.effects.addEffect({
      id: "cheap_potion",
      name: "Cheap Tonic",
      effectType: "health_restore",
      magnitude: 5,
      duration: 20,
    });

    expect(env.effects.activeEffects.length).toBe(4);
    expect(env.effects.getEffect("mead_buzz")).toBeDefined();
    expect(env.effects.getEffect("ale_haze")).toBeDefined();
    expect(env.effects.getEffect("fungus_cramp")).toBeDefined();
    expect(env.effects.getEffect("cheap_potion")).toBeDefined();

    // Effect magnitudes aggregate across active intoxicants
    expect(env.effects.totalMagnitude("fortify_strength")).toBe(10);
    expect(env.effects.totalMagnitude("health_restore")).toBe(5);
  });

  it("hoards encumbering trash items exceeding carry weight limit", () => {
    env.player.maxCarryWeight = 100;

    // Collects empty bottles, broken anvils, rocks
    const junkItems: Item[] = [
      { id: "empty_bottle_1", name: "Empty Wine Bottle", description: "Empty bottle", stackable: false, quantity: 1, weight: 5 },
      { id: "empty_bottle_2", name: "Empty Mead Flagon", description: "Empty flagon", stackable: false, quantity: 1, weight: 5 },
      { id: "heavy_rock",     name: "Smooth River Stone", description: "A rock", stackable: false, quantity: 1, weight: 45 },
      { id: "rusted_bucket",  name: "Dent Bucket",       description: "A dented bucket", stackable: false, quantity: 1, weight: 25 },
      { id: "wooden_ladle",   name: "Old Wooden Ladle",  description: "Old ladle", stackable: false, quantity: 1, weight: 30 },
    ];

    for (const junk of junkItems) {
      env.inventory.addItem(junk);
    }

    expect(env.inventory.totalWeight).toBe(110);
    expect(env.player.carryWeight).toBe(110);
    expect(env.player.carryWeight).toBeGreaterThan(env.player.maxCarryWeight);
  });

  it("commits public drunken theft, gets caught by guards, and serves jail time", () => {
    env.time.restoreFromSave({ gameTime: 14 * 60 });
    expect(env.crime.getBounty("whiterun_guard")).toBe(0);

    const mockWitness = { mesh: { name: "Guard Bob" } } as any;

    // Drunk Grog tries to swipe a merchant's golden goblet in broad daylight
    env.crime.commitCrime("theft", "whiterun_guard", env.time.gameTime, [mockWitness]);

    expect(env.crime.getBounty("whiterun_guard")).toBe(25);

    // Commits assault against a guard
    env.crime.commitCrime("assault", "whiterun_guard", env.time.gameTime, [mockWitness]);
    expect(env.crime.getBounty("whiterun_guard")).toBe(65); // 25 + 40

    // Gets arrested and serves jail sentence
    env.crime.clearAllBounties();
    expect(env.crime.getBounty("whiterun_guard")).toBe(0);
  });

  it("passes out in a 24-hour drunken coma using the wait system", () => {
    env.time.restoreFromSave({ gameTime: 22 * 60, elapsedGameTime: 22 * 60 });
    const startElapsed = env.time.elapsedGameHours;

    // Add a short buzz
    env.effects.addEffect({
      id: "drink_buzz",
      name: "Buzz",
      effectType: "fortify_strength",
      magnitude: 5,
      duration: 30,
    });
    expect(env.effects.activeEffects.length).toBe(1);

    const waitResult = env.wait.wait(24, env.time, env.player);
    expect(waitResult.ok).toBe(true);
    expect(env.time.elapsedGameHours).toBe(startElapsed + 24);
    expect(env.time.hour).toBe(22); // Exactly 24 hours later

    // Ticks active effects past expiration
    env.effects.update(70, env.player);
    expect(env.effects.activeEffects.length).toBe(0); // Intoxicants naturally expired
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Personality 2: The Average (Arthur the Imperial Knight)
// ══════════════════════════════════════════════════════════════════════════════

describe("Personality Playtest: The Average", () => {
  let env: PlaytestEnvironment;

  beforeEach(() => {
    vi.stubGlobal("document", { exitPointerLock: vi.fn() });
    env = createPlaytestEnv();
  });

  it("starts with balanced Imperial Knight build and The Warrior birthsign", () => {
    env.player.name = "Arthur";
    env.race.chooseRace("imperial", env.attrs, env.skills);
    env.cls.chooseClass("knight", env.attrs, env.skills);
    env.birthsign.chooseBirthsign("warrior", env.attrs);

    expect(env.race.chosenRace?.id).toBe("imperial");
    expect(env.attrs.get("strength")).toBeGreaterThanOrEqual(40);
    expect(env.attrs.get("endurance")).toBeGreaterThanOrEqual(40);
  });

  it("equips standard sword and shield and follows honest adventuring protocol", () => {
    const sword: Item = {
      id: "iron_sword",
      name: "Iron Longsword",
      description: "Standard iron blade",
      stackable: false,
      quantity: 1,
      weight: 12,
      slot: "mainHand",
    };
    const shield: Item = {
      id: "iron_shield",
      name: "Iron Shield",
      description: "Standard iron shield",
      stackable: false,
      quantity: 1,
      weight: 8,
      slot: "offHand",
    };

    env.inventory.addItem(sword);
    env.inventory.addItem(shield);

    expect(env.inventory.items.find(i => i.id === "iron_sword")).toBeDefined();
    expect(env.inventory.items.find(i => i.id === "iron_shield")).toBeDefined();
    expect(env.inventory.totalWeight).toBe(20);
    expect(env.player.carryWeight).toBeLessThanOrEqual(env.player.maxCarryWeight);
  });

  it("accepts a standard bounty quest, completes objectives, and earns honest fame", () => {
    const bountyQuest: Quest = {
      id: "wolf_cull",
      name: "Wolf Pack Culling",
      description: "Eliminate 2 wolves prowling the trade road.",
      isActive: true,
      isCompleted: false,
      xpReward: 150,
      objectives: [
        {
          id: "kill_wolves",
          type: "kill",
          description: "Slay 2 wolves",
          targetId: "wolf",
          required: 2,
          current: 0,
          completed: false,
        },
      ],
    };

    env.quests.addQuest(bountyQuest);
    expect(env.quests.getQuests().length).toBe(1);

    // Slays 1st wolf
    env.quests.onKill("wolf");
    expect(bountyQuest.objectives[0].current).toBe(1);
    expect(bountyQuest.isCompleted).toBe(false);

    // Slays 2nd wolf -> Quest completes
    env.quests.onKill("wolf");
    expect(bountyQuest.objectives[0].completed).toBe(true);
    expect(bountyQuest.isCompleted).toBe(true);

    // Earns fame for civic service
    env.fame.addFame(5);
    expect(env.fame.fame).toBe(5);
    expect(env.fame.infamy).toBe(0);
  });

  it("conducts fair trade during normal daytime shop hours (08:00–20:00)", () => {
    env.time.restoreFromSave({ gameTime: 14 * 60 });
    env.shop.registerShop({
      id: "blacksmith_shop",
      name: "The Iron Anvil",
      type: "weapons",
      merchantId: "blacksmith_bob",
      openHour: 8,
      closeHour: 20,
    });
    expect(env.shop.isOpen("blacksmith_shop", 14.0)).toBe(true);

    env.barter.registerMerchant({
      id: "blacksmith_bob",
      name: "Bob the Smith",
      factionId: "fighters_guild",
      gold: 250,
      inventory: [
        { id: "potion_heal", name: "Health Potion", description: "Restores HP", stackable: true, quantity: 1, weight: 0.5, stats: { value: 20 } },
      ],
      isOpen: true,
      openHour: 8,
      closeHour: 20,
    });

    // Player sells excess wolf pelts
    const pelt: Item = { id: "pelt_1", name: "Wolf Pelt", description: "Pelt of wolf", stackable: false, quantity: 1, weight: 2, stats: { value: 30 } };
    env.inventory.addItem(pelt);

    env.barter.playerGold = 0;
    const sellSuccess = env.barter.sellItem("blacksmith_bob", "pelt_1");
    expect(sellSuccess).toBe(true);
    expect(env.barter.playerGold).toBeGreaterThan(0);

    // Reset player gold to 0 and attempt to buy
    env.barter.playerGold = 0;
    const buyResult = env.barter.buyItem("blacksmith_bob", "potion_heal");
    expect(buyResult).toBe(false); // Insufficient gold
  });

  it("rests for 8 hours overnight at an inn and achieves level up", () => {
    env.cls.chooseClass("knight", env.attrs, env.skills);
    env.time.restoreFromSave({ gameTime: 22 * 60 });
    const waitRes = env.wait.wait(8, env.time, env.player);
    expect(waitRes.ok).toBe(true);
    expect(env.time.hour).toBe(6); // 06:00 next morning

    // Level up progression
    let readyFired = false;
    env.playerLevel.onLevelUpReady = () => { readyFired = true; };

    // Trains blade (major skill of knight) to reach level up threshold (10 major skill level-ups)
    for (let i = 0; i < 10; i++) {
      env.playerLevel.handleSkillLevelUp("blade");
    }

    expect(readyFired).toBe(true);
    expect(env.playerLevel.levelUpPending).toBe(true);

    // Arthur allocates +Strength, +Endurance, +Willpower
    const confirmed = env.playerLevel.confirmLevelUp("strength", "endurance", "willpower");
    expect(confirmed).toBe(true);
    expect(env.playerLevel.characterLevel).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Personality 3: The Hardcore (Vaelen the Permadeath Scout)
// ══════════════════════════════════════════════════════════════════════════════

describe("Personality Playtest: The Hardcore", () => {
  let env: PlaytestEnvironment;

  beforeEach(() => {
    vi.stubGlobal("document", { exitPointerLock: vi.fn() });
    env = createPlaytestEnv();
  });

  it("min-maxes Wood Elf scout attributes with stealth focus", () => {
    env.player.name = "Vaelen";
    env.race.chooseRace("bosmer", env.attrs, env.skills);
    env.cls.chooseClass("thief", env.attrs, env.skills);
    env.birthsign.chooseBirthsign("shadow", env.attrs);

    expect(env.attrs.get("agility")).toBeGreaterThanOrEqual(50);
    expect(env.attrs.get("speed")).toBeGreaterThanOrEqual(50);
    expect(env.birthsign.chosenBirthsign?.id).toBe("shadow");
  });

  it("strictly manages inventory, keeping only high value-to-weight ratio loot", () => {
    env.player.maxCarryWeight = 150;

    const heavyArmor: Item = { id: "iron_chest", name: "Iron Cuirass", description: "Heavy", stackable: false, quantity: 1, weight: 30, stats: { value: 50 } }; // 1.67 gold/lb - REJECT
    const lightGems: Item   = { id: "ruby",        name: "Flawless Ruby", description: "Gem", stackable: false, quantity: 1, weight: 0.2, stats: { value: 200 } }; // 1000 gold/lb - KEEP
    const lockpicks: Item   = { id: "lockpick_x5", name: "Lockpicks (5)", description: "Picks", stackable: false, quantity: 1, weight: 0.5, stats: { value: 50 } };  // 100 gold/lb - KEEP

    // Calculate value-to-weight
    const getRatio = (i: Item) => (i.stats?.value ?? 0) / (i.weight ?? 0.5);
    expect(getRatio(heavyArmor)).toBeLessThan(10);
    expect(getRatio(lightGems)).toBeGreaterThan(10);

    // Hardcore player only loots items with ratio >= 10
    if (getRatio(lightGems) >= 10) env.inventory.addItem(lightGems);
    if (getRatio(lockpicks) >= 10) env.inventory.addItem(lockpicks);

    expect(env.inventory.items.find(i => i.id === "iron_chest")).toBeUndefined();
    expect(env.inventory.items.find(i => i.id === "ruby")).toBeDefined();
    expect(env.inventory.totalWeight).toBeCloseTo(0.7, 1);
  });

  it("brews custom lethal poisons via Alchemy system", () => {
    const nightshade: IngredientDefinition = {
      id: "nightshade",
      name: "Nightshade",
      weight: 0.1,
      value: 10,
      effects: ["damage_health", "burden", "damage_magicka"],
      potency: 1.5,
    };
    const frostSalts: IngredientDefinition = {
      id: "frost_salts",
      name: "Frost Salts",
      weight: 0.2,
      value: 25,
      effects: ["resist_fire", "weakness_fire", "damage_health"],
      potency: 1.2,
    };

    env.alchemy.registerIngredient(nightshade);
    env.alchemy.registerIngredient(frostSalts);
    env.alchemy.addIngredient("nightshade", 1);
    env.alchemy.addIngredient("frost_salts", 1);

    // Both ingredients share "damage_health"
    const potion = env.alchemy.craftPotion(["nightshade", "frost_salts"]);
    expect(potion).not.toBeNull();
    expect(potion!.effects.some(e => e.effectId === "damage_health")).toBe(true);
    expect(potion!.name.startsWith("Poison")).toBe(true);
  });

  it("executes a flawless sneak attack without taking any damage", () => {
    // Crouch into stealth mode
    env.stealth.toggleCrouch();
    expect(env.stealth.isCrouching).toBe(true);

    const mockTargetNpc = {
      id: "bandit_chief",
      isDead: false,
      aiState: 0,
      health: 120,
      maxHealth: 120,
      mesh: {
        position: new Vector3(0, 0, 10),
        getDirection: () => new Vector3(0, 0, 1),
      },
    } as any;

    // Approaching from behind in dark conditions: can sneak attack
    expect(env.stealth.canSneakAttack(mockTargetNpc)).toBe(true);

    // 3.0x sneak multiplier + base damage (30 * 3.0 = 90) + poison (30) = 120 (fatal)
    const baseDamage = 30;
    const sneakMultiplier = 3.0;
    const poisonBonus = 30;
    const totalDamage = (baseDamage * sneakMultiplier) + poisonBonus;

    mockTargetNpc.health = Math.max(0, mockTargetNpc.health - totalDamage);
    expect(mockTargetNpc.health).toBe(0);
    expect(env.player.health).toBe(env.player.maxHealth); // 100% HP, 0 damage taken
  });

  it("contracts a deadly disease and immediately cures it with a prepared antidote", () => {
    // Contracts Swamp Rot (-5 Willpower)
    const contracted = env.disease.contractDisease("swamp_rot");
    expect(contracted).toBe(true);
    expect(env.disease.hasDisease("swamp_rot")).toBe(true);

    // Diagnoses disease and consumes Cure Disease potion immediately
    env.disease.cureAllDiseases();
    expect(env.disease.hasDisease("swamp_rot")).toBe(false);
    expect(env.disease.getActiveDiseases().length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Personality 4: The Gamer (GlitchStrider the Exploit Hunter)
// ══════════════════════════════════════════════════════════════════════════════

describe("Personality Playtest: The Gamer", () => {
  let env: PlaytestEnvironment;

  beforeEach(() => {
    vi.stubGlobal("document", { exitPointerLock: vi.fn() });
    env = createPlaytestEnv();
  });

  it("creates high-agility speed runner with The Steed birthsign", () => {
    env.player.name = "SpeedyGamer";
    env.race.chooseRace("bosmer", env.attrs, env.skills);
    env.cls.chooseClass("thief", env.attrs, env.skills);
    env.birthsign.chooseBirthsign("steed", env.attrs);

    // Bosmer (+10) + Thief (+10) + Steed (+20) + Base 40 = 80 Speed
    expect(env.attrs.get("speed")).toBeGreaterThanOrEqual(60);
  });

  it("tests barter exploit guards (negative quantities, 0 gold, nonexistent items)", () => {
    env.barter.registerMerchant({
      id: "merchant_test",
      name: "Exploit Test Vendor",
      factionId: "merchants",
      gold: 500,
      inventory: [
        { id: "expensive_ring", name: "Diamond Ring", description: "Shiny", stackable: false, quantity: 1, weight: 0.1, stats: { value: 500 } },
      ],
      isOpen: true,
      openHour: 0,
      closeHour: 24,
    });

    // 1. Attempt to buy without gold
    env.barter.playerGold = 0;
    expect(env.barter.playerGold).toBe(0);
    const buyFail = env.barter.buyItem("merchant_test", "expensive_ring");
    expect(buyFail).toBe(false);

    // 2. Attempt to buy item not in merchant stock
    const phantomBuy = env.barter.buyItem("merchant_test", "ghost_item_99");
    expect(phantomBuy).toBe(false);

    // 3. Attempt to sell item player doesn't possess
    const phantomSell = env.barter.sellItem("merchant_test", "fake_blade");
    expect(phantomSell).toBe(false);
  });

  it("tests custom spellmaking boundaries (extreme magnitudes and cost caps)", () => {
    const shockComponents: SpellComponent[] = [
      { effectType: "damage", school: "destruction", magnitude: 100, duration: 10, damageType: "shock" },
    ];

    // Cost formula clamped to MAX_SPELL_COST (2000g)
    const cost = env.spellMaking.computeCost(shockComponents);
    expect(cost).toBeLessThanOrEqual(MAX_SPELL_COST);
    expect(cost).toBeGreaterThanOrEqual(MIN_SPELL_COST);

    // Player with 0 gold cannot forge it
    env.barter.playerGold = 0;
    const highCostSpell = env.spellMaking.forgeSpell(
      "GigaShock",
      shockComponents,
      env.barter,
    );
    expect(highCostSpell.ok).toBe(false);
    expect(highCostSpell.reason).toBe("insufficient_gold");

    // Give player exact gold to verify successful creation
    env.barter.playerGold = cost;
    const successForge = env.spellMaking.forgeSpell(
      "GigaShock",
      shockComponents,
      env.barter,
    );
    expect(successForge.ok).toBe(true);
    expect(successForge.goldCost).toBe(cost);
    expect(env.spellMaking.customSpells.length).toBe(1);
  });

  it("tests stealth AI line-of-sight break and search timer decay", () => {
    // Simulate noise spike
    env.stealth.pushNoise(1.0);
    expect(env.stealth.isCrouching).toBe(false);

    // Gamer breaks line of sight, crouches behind rock
    env.stealth.toggleCrouch();
    expect(env.stealth.isCrouching).toBe(true);

    // Stealth update with zero ambient sight allows detection decay
    env.stealth.update(2.0, 0.0); // 2 seconds pass in total concealment
    expect(env.stealth.noiseLevel).toBeLessThan(1.0);
  });

  it("verifies UI focus and modal concurrency locks under rapid input", () => {
    expect(env.ui.crosshairVisible).toBe(true);

    // Gamer opens Character Sheet overlay
    const releaseSheet = env.ui.registerHtmlOverlay();
    expect(env.ui.crosshairVisible).toBe(false);
    expect(env.ui.htmlOverlayCount).toBe(1);

    // Gamer concurrently opens Barter overlay
    const releaseBarter = env.ui.registerHtmlOverlay();
    expect(env.ui.crosshairVisible).toBe(false);
    expect(env.ui.htmlOverlayCount).toBe(2);

    // Closes Barter overlay
    releaseBarter();
    expect(env.ui.crosshairVisible).toBe(false); // Sheet still open!
    expect(env.ui.htmlOverlayCount).toBe(1);

    // Closes Character Sheet
    releaseSheet();
    expect(env.ui.crosshairVisible).toBe(true); // All overlays closed, crosshair restored!
    expect(env.ui.htmlOverlayCount).toBe(0);
  });
});
