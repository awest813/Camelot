import { describe, it, expect, vi, beforeEach } from "vitest";
import { CraftingSystem } from "./crafting-system";
import type {
  CraftingRecipe,
  MaterialInventory,
  CraftingSnapshot,
} from "./crafting-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

const ironSwordRecipe: CraftingRecipe = {
  id: "iron_sword",
  label: "Iron Sword",
  category: "weapon",
  requiredMaterials: [
    { materialId: "iron_ingot", quantity: 2 },
    { materialId: "leather_strips", quantity: 1 },
  ],
  outputItemId: "iron_sword",
  outputItemName: "Iron Sword",
  requiredSkill: 0,
  craftingXp: 15,
};

const leatherArmorRecipe: CraftingRecipe = {
  id: "leather_armor",
  label: "Leather Armor",
  category: "armor",
  requiredMaterials: [
    { materialId: "leather", quantity: 4 },
    { materialId: "leather_strips", quantity: 2 },
  ],
  outputItemId: "leather_armor",
  outputItemName: "Leather Armor",
  craftingXp: 20,
};

const steelSwordRecipe: CraftingRecipe = {
  id: "steel_sword",
  label: "Steel Sword",
  category: "weapon",
  requiredMaterials: [
    { materialId: "steel_ingot", quantity: 2 },
    { materialId: "iron_ingot", quantity: 1 },
    { materialId: "leather_strips", quantity: 1 },
  ],
  outputItemId: "steel_sword",
  outputItemName: "Steel Sword",
  requiredSkill: 25,
  craftingXp: 30,
};

const silverRingRecipe: CraftingRecipe = {
  id: "silver_ring",
  label: "Silver Ring",
  category: "jewelry",
  requiredMaterials: [{ materialId: "silver_ingot", quantity: 1 }],
  outputItemId: "silver_ring",
  outputItemName: "Silver Ring",
  outputQuantity: 1,
  craftingXp: 10,
};

const arrowBundleRecipe: CraftingRecipe = {
  id: "iron_arrows",
  label: "Iron Arrows",
  category: "misc",
  requiredMaterials: [
    { materialId: "iron_ingot", quantity: 1 },
    { materialId: "firewood", quantity: 1 },
  ],
  outputItemId: "iron_arrow",
  outputItemName: "Iron Arrow",
  outputQuantity: 10,
  craftingXp: 5,
};

function makeInventory(overrides: MaterialInventory = {}): MaterialInventory {
  return {
    iron_ingot: 5,
    leather_strips: 5,
    leather: 8,
    steel_ingot: 3,
    silver_ingot: 2,
    firewood: 3,
    ...overrides,
  };
}

// ── Tests: CRUD ───────────────────────────────────────────────────────────────

describe("CraftingSystem — CRUD", () => {
  it("registers a recipe and retrieves it", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    expect(sys.getRecipe("iron_sword")).toEqual(ironSwordRecipe);
  });

  it("replaces an existing recipe with the same id, resetting craft count", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.craft("iron_sword", makeInventory());
    expect(sys.getTotalCrafted("iron_sword")).toBe(1);

    const updated: CraftingRecipe = { ...ironSwordRecipe, label: "Iron Sword v2" };
    sys.addRecipe(updated);
    expect(sys.getRecipe("iron_sword")?.label).toBe("Iron Sword v2");
    expect(sys.getTotalCrafted("iron_sword")).toBe(0); // reset
  });

  it("removeRecipe deletes a registered recipe", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.removeRecipe("iron_sword");
    expect(sys.getRecipe("iron_sword")).toBeUndefined();
    expect(sys.recipes).toHaveLength(0);
  });

  it("removeRecipe on unknown id is safe", () => {
    const sys = new CraftingSystem();
    expect(() => sys.removeRecipe("unknown")).not.toThrow();
  });

  it("recipes getter returns all registered recipes", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(leatherArmorRecipe);
    expect(sys.recipes).toHaveLength(2);
  });

  it("clear removes all recipes", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(leatherArmorRecipe);
    sys.clear();
    expect(sys.recipes).toHaveLength(0);
  });
});

// ── Tests: canCraft ───────────────────────────────────────────────────────────

describe("CraftingSystem — canCraft", () => {
  it("returns true when materials and skill are sufficient", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    expect(sys.canCraft("iron_sword", makeInventory(), 0)).toBe(true);
  });

  it("returns false for an unknown recipe", () => {
    const sys = new CraftingSystem();
    expect(sys.canCraft("unknown", makeInventory())).toBe(false);
  });

  it("returns false when a material is missing entirely", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    expect(sys.canCraft("iron_sword", { iron_ingot: 2 }, 0)).toBe(false);
  });

  it("returns false when material quantity is insufficient", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const inv: MaterialInventory = { iron_ingot: 1, leather_strips: 1 };
    expect(sys.canCraft("iron_sword", inv, 0)).toBe(false);
  });

  it("returns false when skill is below requiredSkill", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe);
    expect(sys.canCraft("steel_sword", makeInventory(), 20)).toBe(false);
  });

  it("returns true when skill exactly meets requiredSkill", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe);
    expect(sys.canCraft("steel_sword", makeInventory(), 25)).toBe(true);
  });

  it("returns true when skill exceeds requiredSkill", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe);
    expect(sys.canCraft("steel_sword", makeInventory(), 50)).toBe(true);
  });

  it("defaults skill to 0 when not provided, allowing no-skill recipes", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe); // requiredSkill 0
    expect(sys.canCraft("iron_sword", makeInventory())).toBe(true);
  });

  it("recipe with no requiredSkill field is always skill-accessible", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(leatherArmorRecipe); // no requiredSkill
    expect(sys.canCraft("leather_armor", makeInventory(), 0)).toBe(true);
  });
});

// ── Tests: craft ─────────────────────────────────────────────────────────────

describe("CraftingSystem — craft", () => {
  it("returns success with correct result on a valid craft", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const outcome = sys.craft("iron_sword", makeInventory(), 0);
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.result.recipeId).toBe("iron_sword");
      expect(outcome.result.outputItemId).toBe("iron_sword");
      expect(outcome.result.outputItemName).toBe("Iron Sword");
      expect(outcome.result.quantity).toBe(1);
      expect(outcome.result.xpAwarded).toBe(15);
    }
  });

  it("increments craft count on success", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.craft("iron_sword", makeInventory(), 0);
    sys.craft("iron_sword", makeInventory(), 0);
    expect(sys.getTotalCrafted("iron_sword")).toBe(2);
  });

  it("fires onItemCrafted callback on success", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const spy = vi.fn();
    sys.onItemCrafted = spy;
    sys.craft("iron_sword", makeInventory(), 0);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].recipeId).toBe("iron_sword");
  });

  it("returns failure with unknown_recipe reason for unknown id", () => {
    const sys = new CraftingSystem();
    const outcome = sys.craft("unknown", makeInventory());
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.reason).toBe("unknown_recipe");
  });

  it("returns failure with missing_materials when inventory is short", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const outcome = sys.craft("iron_sword", { iron_ingot: 1, leather_strips: 1 }, 0);
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.reason).toBe("missing_materials");
      expect(outcome.message).toContain("iron_ingot");
    }
  });

  it("returns failure with skill_too_low when skill is insufficient", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe);
    const outcome = sys.craft("steel_sword", makeInventory(), 10);
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.reason).toBe("skill_too_low");
      expect(outcome.message).toContain("25");
    }
  });

  it("does not fire onItemCrafted on failure", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const spy = vi.fn();
    sys.onItemCrafted = spy;
    sys.craft("iron_sword", { iron_ingot: 0, leather_strips: 0 }, 0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not increment craft count on failure", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe);
    sys.craft("steel_sword", makeInventory(), 0); // skill too low
    expect(sys.getTotalCrafted("steel_sword")).toBe(0);
  });

  it("respects outputQuantity for bulk recipes", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(arrowBundleRecipe);
    const outcome = sys.craft("iron_arrows", makeInventory(), 0);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quantity).toBe(10);
  });

  it("defaults outputQuantity to 1 when not specified", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe); // no outputQuantity
    const outcome = sys.craft("iron_sword", makeInventory(), 0);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quantity).toBe(1);
  });

  it("defaults craftingXp to 10 when not specified", () => {
    const noXpRecipe: CraftingRecipe = {
      id: "no_xp",
      label: "No XP Recipe",
      category: "misc",
      requiredMaterials: [{ materialId: "iron_ingot", quantity: 1 }],
      outputItemId: "some_item",
      outputItemName: "Some Item",
    };
    const sys = new CraftingSystem();
    sys.addRecipe(noXpRecipe);
    const outcome = sys.craft("no_xp", { iron_ingot: 1 }, 0);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.xpAwarded).toBe(10);
  });
});

// ── Tests: getAvailableRecipes ────────────────────────────────────────────────

describe("CraftingSystem — getAvailableRecipes", () => {
  it("returns all craftable recipes given sufficient inventory and skill", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(leatherArmorRecipe);
    sys.addRecipe(steelSwordRecipe);
    const available = sys.getAvailableRecipes(makeInventory(), 30);
    expect(available.map((r) => r.id).sort()).toEqual(
      ["iron_sword", "leather_armor", "steel_sword"].sort(),
    );
  });

  it("excludes recipes with missing materials", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(silverRingRecipe);
    const available = sys.getAvailableRecipes({ iron_ingot: 2, leather_strips: 1 }, 0);
    expect(available.map((r) => r.id)).toEqual(["iron_sword"]);
  });

  it("excludes recipes where skill is insufficient", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(steelSwordRecipe);
    const available = sys.getAvailableRecipes(makeInventory(), 0);
    expect(available.map((r) => r.id)).toEqual(["iron_sword"]);
  });

  it("returns empty array when no recipes are registered", () => {
    const sys = new CraftingSystem();
    expect(sys.getAvailableRecipes(makeInventory(), 100)).toHaveLength(0);
  });

  it("returns empty array when inventory is empty", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    expect(sys.getAvailableRecipes({}, 100)).toHaveLength(0);
  });
});

// ── Tests: getRecipesByCategory ───────────────────────────────────────────────

describe("CraftingSystem — getRecipesByCategory", () => {
  let sys: CraftingSystem;
  beforeEach(() => {
    sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);      // weapon
    sys.addRecipe(steelSwordRecipe);     // weapon
    sys.addRecipe(leatherArmorRecipe);   // armor
    sys.addRecipe(silverRingRecipe);     // jewelry
    sys.addRecipe(arrowBundleRecipe);    // misc
  });

  it("returns weapon recipes", () => {
    const weapons = sys.getRecipesByCategory("weapon");
    expect(weapons.map((r) => r.id).sort()).toEqual(["iron_sword", "steel_sword"].sort());
  });

  it("returns armor recipes", () => {
    const armor = sys.getRecipesByCategory("armor");
    expect(armor.map((r) => r.id)).toEqual(["leather_armor"]);
  });

  it("returns jewelry recipes", () => {
    const jewelry = sys.getRecipesByCategory("jewelry");
    expect(jewelry.map((r) => r.id)).toEqual(["silver_ring"]);
  });

  it("returns misc recipes", () => {
    const misc = sys.getRecipesByCategory("misc");
    expect(misc.map((r) => r.id)).toEqual(["iron_arrows"]);
  });

  it("returns empty array for a category with no recipes", () => {
    sys.removeRecipe("iron_arrows");
    expect(sys.getRecipesByCategory("misc")).toHaveLength(0);
  });
});

// ── Tests: getTotalCrafted ────────────────────────────────────────────────────

describe("CraftingSystem — getTotalCrafted", () => {
  it("returns 0 for a recipe that has never been crafted", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    expect(sys.getTotalCrafted("iron_sword")).toBe(0);
  });

  it("returns 0 for an unknown recipe id", () => {
    const sys = new CraftingSystem();
    expect(sys.getTotalCrafted("nonexistent")).toBe(0);
  });

  it("increments correctly after multiple crafts", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.craft("iron_sword", makeInventory());
    sys.craft("iron_sword", makeInventory());
    sys.craft("iron_sword", makeInventory());
    expect(sys.getTotalCrafted("iron_sword")).toBe(3);
  });

  it("failed crafts do not increment count", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.craft("iron_sword", {});    // missing materials
    sys.craft("iron_sword", makeInventory()); // success
    expect(sys.getTotalCrafted("iron_sword")).toBe(1);
  });
});

// ── Tests: snapshot / restore ─────────────────────────────────────────────────

describe("CraftingSystem — snapshot / restore", () => {
  it("captures craft counts in snapshot", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(leatherArmorRecipe);
    sys.craft("iron_sword", makeInventory());
    sys.craft("iron_sword", makeInventory());
    sys.craft("leather_armor", makeInventory());
    const snap = sys.getSnapshot();
    expect(snap.find((s) => s.id === "iron_sword")?.craftCount).toBe(2);
    expect(snap.find((s) => s.id === "leather_armor")?.craftCount).toBe(1);
  });

  it("restores craft counts from a snapshot", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const snapshots: CraftingSnapshot[] = [{ id: "iron_sword", craftCount: 7 }];
    sys.restoreSnapshot(snapshots);
    expect(sys.getTotalCrafted("iron_sword")).toBe(7);
  });

  it("ignores unknown ids in snapshot gracefully", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const snapshots: CraftingSnapshot[] = [
      { id: "iron_sword", craftCount: 3 },
      { id: "does_not_exist", craftCount: 99 },
    ];
    expect(() => sys.restoreSnapshot(snapshots)).not.toThrow();
    expect(sys.getTotalCrafted("iron_sword")).toBe(3);
  });

  it("round-trips snapshot correctly", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(steelSwordRecipe);
    sys.craft("iron_sword", makeInventory(), 0);
    sys.craft("steel_sword", makeInventory(), 50);
    sys.craft("steel_sword", makeInventory(), 50);

    const snap = sys.getSnapshot();

    const sys2 = new CraftingSystem();
    sys2.addRecipe(ironSwordRecipe);
    sys2.addRecipe(steelSwordRecipe);
    sys2.restoreSnapshot(snap);

    expect(sys2.getTotalCrafted("iron_sword")).toBe(1);
    expect(sys2.getTotalCrafted("steel_sword")).toBe(2);
  });

  it("does not fire onItemCrafted during restoreSnapshot", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const spy = vi.fn();
    sys.onItemCrafted = spy;
    sys.restoreSnapshot([{ id: "iron_sword", craftCount: 5 }]);
    expect(spy).not.toHaveBeenCalled();
  });
});
