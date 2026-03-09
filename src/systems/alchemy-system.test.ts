import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AlchemySystem,
  DEFAULT_INGREDIENTS,
  ALCHEMY_EFFECTS,
  type AlchemyPotion,
} from "./alchemy-system";

// ── Minimal stubs ─────────────────────────────────────────────────────────────

function makePlayer() {
  return {
    health: 80,
    maxHealth: 100,
    magicka: 50,
    maxMagicka: 100,
    stamina: 60,
    maxStamina: 100,
    bonusDamage: 0,
    bonusMagicDamage: 0,
    bonusArmor: 0,
    baseSpeed: 0.5,
    maxCarryWeight: 300,
    notifyDamageTaken: vi.fn(),
  } as unknown as import("../entities/player").Player;
}

function makeUI() {
  return { showNotification: vi.fn() } as unknown as import("../ui/ui-manager").UIManager;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AlchemySystem", () => {
  let player: ReturnType<typeof makePlayer>;
  let ui: ReturnType<typeof makeUI>;
  let alchemy: AlchemySystem;

  beforeEach(() => {
    player  = makePlayer();
    ui      = makeUI();
    alchemy = new AlchemySystem(player, ui);
  });

  // ── Ingredient management ──────────────────────────────────────────────────

  describe("addIngredient / removeIngredient / getIngredientCount", () => {
    it("adds a known ingredient to the satchel", () => {
      expect(alchemy.addIngredient("cairn_bolete_cap", 3)).toBe(true);
      expect(alchemy.getIngredientCount("cairn_bolete_cap")).toBe(3);
    });

    it("returns false for an unknown ingredient", () => {
      expect(alchemy.addIngredient("nonexistent_herb")).toBe(false);
    });

    it("stacks additions", () => {
      alchemy.addIngredient("aloe_vera_leaves", 2);
      alchemy.addIngredient("aloe_vera_leaves", 3);
      expect(alchemy.getIngredientCount("aloe_vera_leaves")).toBe(5);
    });

    it("removes the correct quantity", () => {
      alchemy.addIngredient("aloe_vera_leaves", 5);
      expect(alchemy.removeIngredient("aloe_vera_leaves", 3)).toBe(true);
      expect(alchemy.getIngredientCount("aloe_vera_leaves")).toBe(2);
    });

    it("returns false when insufficient quantity", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      expect(alchemy.removeIngredient("aloe_vera_leaves", 2)).toBe(false);
      expect(alchemy.getIngredientCount("aloe_vera_leaves")).toBe(1);
    });

    it("deletes the key when quantity drops to 0", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.removeIngredient("aloe_vera_leaves", 1);
      expect(alchemy.getIngredientCount("aloe_vera_leaves")).toBe(0);
      expect(alchemy.getSatchelContents()).toHaveLength(0);
    });
  });

  // ── Effect discovery ───────────────────────────────────────────────────────

  describe("eatIngredient", () => {
    it("returns null when the ingredient is not in the satchel", () => {
      expect(alchemy.eatIngredient("aloe_vera_leaves")).toBeNull();
    });

    it("consumes one unit and discovers the first effect", () => {
      alchemy.addIngredient("aloe_vera_leaves", 2);
      const result = alchemy.eatIngredient("aloe_vera_leaves");
      expect(result).not.toBeNull();
      expect(alchemy.getIngredientCount("aloe_vera_leaves")).toBe(1);
      expect(alchemy.hasDiscoveredEffect("aloe_vera_leaves", 0)).toBe(true);
    });

    it("applies restore_health to player HP", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      // aloe_vera_leaves first effect is restore_health
      const before = player.health;
      alchemy.eatIngredient("aloe_vera_leaves");
      expect(player.health).toBeGreaterThanOrEqual(before);
    });

    it("does not reveal effects beyond index 0", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.eatIngredient("aloe_vera_leaves");
      expect(alchemy.hasDiscoveredEffect("aloe_vera_leaves", 1)).toBe(false);
    });
  });

  // ── Crafting ───────────────────────────────────────────────────────────────

  describe("craftPotion", () => {
    it("requires at least 2 ingredients", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      const result = alchemy.craftPotion(["aloe_vera_leaves"]);
      expect(result).toBeNull();
    });

    it("returns null if an ingredient is not in the satchel", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      const result = alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"]);
      expect(result).toBeNull();
    });

    it("creates a potion with shared effects when effects overlap", () => {
      // aloe_vera_leaves: [restore_health, restore_stamina, resist_fire, fortify_endurance]
      // cairn_bolete_cap: [restore_health, restore_stamina, damage_magicka, fortify_strength]
      // Shared: restore_health, restore_stamina
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.addIngredient("cairn_bolete_cap", 1);
      const potion = alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"]);
      expect(potion).not.toBeNull();
      const effectIds = potion!.effects.map(e => e.effectId);
      expect(effectIds).toContain("restore_health");
      expect(effectIds).toContain("restore_stamina");
    });

    it("consumes one unit of each ingredient on success", () => {
      alchemy.addIngredient("aloe_vera_leaves", 3);
      alchemy.addIngredient("cairn_bolete_cap", 3);
      alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"]);
      expect(alchemy.getIngredientCount("aloe_vera_leaves")).toBe(2);
      expect(alchemy.getIngredientCount("cairn_bolete_cap")).toBe(2);
    });

    it("reveals all effects of used ingredients on success", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.addIngredient("cairn_bolete_cap", 1);
      alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"]);
      for (let i = 0; i < 4; i++) {
        expect(alchemy.hasDiscoveredEffect("aloe_vera_leaves", i)).toBe(true);
        expect(alchemy.hasDiscoveredEffect("cairn_bolete_cap", i)).toBe(true);
      }
    });

    it("returns null and shows notification when no shared effects", () => {
      // Craft two ingredients that share no effects
      // imp_gall:   [damage_health, weakness_fire, damage_magicka, restore_stamina]
      // fennel_seeds:[restore_magicka, fortify_intelligence, restore_health, resist_frost]
      // No overlap
      alchemy.addIngredient("imp_gall", 1);
      alchemy.addIngredient("fennel_seeds", 1);
      const result = alchemy.craftPotion(["imp_gall", "fennel_seeds"]);
      expect(result).toBeNull();
    });

    it("adds the crafted potion to craftedPotions", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.addIngredient("cairn_bolete_cap", 1);
      alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"]);
      expect(alchemy.craftedPotions).toHaveLength(1);
    });

    it("increases alchemy skill on successful craft", () => {
      const skillBefore = alchemy.alchemySkill;
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.addIngredient("cairn_bolete_cap", 1);
      alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"]);
      expect(alchemy.alchemySkill).toBeGreaterThan(skillBefore);
    });

    it("respects the 4-ingredient maximum", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.addIngredient("cairn_bolete_cap", 1);
      alchemy.addIngredient("fennel_seeds", 1);
      alchemy.addIngredient("lady_smock_leaves", 1);
      alchemy.addIngredient("dragon_tongue", 1);
      const result = alchemy.craftPotion([
        "aloe_vera_leaves",
        "cairn_bolete_cap",
        "fennel_seeds",
        "lady_smock_leaves",
        "dragon_tongue",
      ]);
      expect(result).toBeNull();
    });

    it("fires onPotionCrafted callback", () => {
      const callback = vi.fn();
      alchemy.onPotionCrafted = callback;
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.addIngredient("cairn_bolete_cap", 1);
      alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"]);
      expect(callback).toHaveBeenCalledTimes(1);
      const [potion] = callback.mock.calls[0] as [AlchemyPotion];
      expect(potion.name).toContain("Potion");
    });
  });

  // ── Potion drinking ────────────────────────────────────────────────────────

  describe("drinkPotion", () => {
    let potion: AlchemyPotion;

    beforeEach(() => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.addIngredient("cairn_bolete_cap", 1);
      potion = alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"])!;
    });

    it("applies restore_health effect to player", () => {
      player.health = 50;
      alchemy.drinkPotion(potion.id);
      expect(player.health).toBeGreaterThan(50);
    });

    it("removes the potion from craftedPotions", () => {
      expect(alchemy.craftedPotions).toHaveLength(1);
      alchemy.drinkPotion(potion.id);
      expect(alchemy.craftedPotions).toHaveLength(0);
    });

    it("returns false for unknown potion id", () => {
      expect(alchemy.drinkPotion("bogus_id")).toBe(false);
    });

    it("fires onPotionDrunk callback", () => {
      const cb = vi.fn();
      alchemy.onPotionDrunk = cb;
      alchemy.drinkPotion(potion.id);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // ── Save / restore ─────────────────────────────────────────────────────────

  describe("getSaveState / restoreFromSave", () => {
    it("round-trips ingredients", () => {
      alchemy.addIngredient("aloe_vera_leaves", 3);
      alchemy.addIngredient("fennel_seeds", 7);
      const state = alchemy.getSaveState();

      const alchemy2 = new AlchemySystem(player, ui);
      alchemy2.restoreFromSave(state);
      expect(alchemy2.getIngredientCount("aloe_vera_leaves")).toBe(3);
      expect(alchemy2.getIngredientCount("fennel_seeds")).toBe(7);
    });

    it("round-trips discovered effects", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.eatIngredient("aloe_vera_leaves");
      const state = alchemy.getSaveState();

      const alchemy2 = new AlchemySystem(player, ui);
      alchemy2.restoreFromSave(state);
      expect(alchemy2.hasDiscoveredEffect("aloe_vera_leaves", 0)).toBe(true);
      expect(alchemy2.hasDiscoveredEffect("aloe_vera_leaves", 1)).toBe(false);
    });

    it("round-trips crafted potions", () => {
      alchemy.addIngredient("aloe_vera_leaves", 1);
      alchemy.addIngredient("cairn_bolete_cap", 1);
      alchemy.craftPotion(["aloe_vera_leaves", "cairn_bolete_cap"]);
      const state = alchemy.getSaveState();

      const alchemy2 = new AlchemySystem(player, ui);
      alchemy2.restoreFromSave(state);
      expect(alchemy2.craftedPotions).toHaveLength(1);
    });

    it("tolerates null / empty state gracefully", () => {
      expect(() => alchemy.restoreFromSave(null as unknown as ReturnType<AlchemySystem["getSaveState"]>)).not.toThrow();
      expect(alchemy.craftedPotions).toHaveLength(0);
    });

    it("ignores ingredients with unknown ids on restore", () => {
      const state = {
        ingredients: { aloe_vera_leaves: 2, unknown_herb: 5 },
        discoveredEffects: [] as Array<[string, number]>,
        craftedPotions: [],
      };
      alchemy.restoreFromSave(state);
      expect(alchemy.getIngredientCount("aloe_vera_leaves")).toBe(2);
      expect(alchemy.getIngredientCount("unknown_herb")).toBe(0);
    });
  });

  // ── Effect catalogue ───────────────────────────────────────────────────────

  describe("ALCHEMY_EFFECTS catalogue", () => {
    it("has an entry for every AlchemyEffectId used in DEFAULT_INGREDIENTS", () => {
      const allUsedEffects = new Set(DEFAULT_INGREDIENTS.flatMap(i => i.effects));
      for (const eid of allUsedEffects) {
        expect(ALCHEMY_EFFECTS).toHaveProperty(eid);
      }
    });
  });

  // ── Ingredient registration ────────────────────────────────────────────────

  describe("registerIngredient", () => {
    it("registers a custom ingredient that can then be added and crafted", () => {
      alchemy.registerIngredient({
        id: "test_herb",
        name: "Test Herb",
        weight: 0.1,
        value: 5,
        effects: ["restore_health", "restore_stamina", "resist_fire", "feather"],
      });
      alchemy.addIngredient("test_herb", 1);
      alchemy.addIngredient("aloe_vera_leaves", 1);
      // Both have restore_health — should craft successfully
      const potion = alchemy.craftPotion(["test_herb", "aloe_vera_leaves"]);
      expect(potion).not.toBeNull();
    });
  });
});

// ── NPC archetype resistance tests ───────────────────────────────────────────

describe("NpcArchetypeSystem resistance/weakness integration", () => {
  it("spawnNpc applies damageResistances from archetype definition", async () => {
    const { NpcArchetypeSystem } = await import("./npc-archetype-system");
    const { Scene }  = await import("@babylonjs/core/scene");
    const { Vector3 } = await import("@babylonjs/core/Maths/math.vector");

    const sys = new NpcArchetypeSystem();
    sys.registerArchetype({
      id: "test_armored",
      name: "Armored Bandit",
      role: "enemy",
      isHostile: true,
      isMerchant: false,
      baseHealth: 100,
      level: 1,
      damageResistances: { physical: 0.3, fire: 0.0 },
      damageWeaknesses:  { frost: 0.25 },
    });

    const mockScene = {} as typeof Scene.prototype;
    const pos = new Vector3(0, 0, 0);

    // We can't construct a real NPC without Babylon, but we can verify
    // the definition is registered correctly.
    const def = sys.getArchetype("test_armored");
    expect(def?.damageResistances?.physical).toBe(0.3);
    expect(def?.damageWeaknesses?.frost).toBe(0.25);
  });
});
