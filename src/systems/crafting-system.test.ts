import { describe, it, expect, vi, beforeEach } from "vitest";
import { CraftingSystem, computeItemQuality } from "./crafting-system";
import type {
  CraftingRecipe,
  MaterialInventory,
  CraftingSnapshot,
  CraftingSystemState,
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

// ── Tests: recipe validation ──────────────────────────────────────────────────

describe("CraftingSystem — recipe validation", () => {
  it("rejects non-positive material quantities", () => {
    const sys = new CraftingSystem();
    const bad: CraftingRecipe = {
      ...ironSwordRecipe,
      id: "bad_mat",
      requiredMaterials: [{ materialId: "iron_ingot", quantity: 0 }],
    };
    expect(() => sys.addRecipe(bad)).toThrow(/positive integer/);
  });

  it("rejects invalid outputQuantity", () => {
    const sys = new CraftingSystem();
    const bad: CraftingRecipe = { ...ironSwordRecipe, id: "bad_out", outputQuantity: 0 };
    expect(() => sys.addRecipe(bad)).toThrow(/outputQuantity/);
  });

  it("rejects unknown stationId", () => {
    const sys = new CraftingSystem();
    const bad = { ...ironSwordRecipe, id: "bad_st", stationId: "ocean" } as CraftingRecipe;
    expect(() => sys.addRecipe(bad)).toThrow(/stationId/);
  });

  it("rejects unknown tier", () => {
    const sys = new CraftingSystem();
    const bad = { ...ironSwordRecipe, id: "bad_tier", tier: "mithril" } as CraftingRecipe;
    expect(() => sys.addRecipe(bad)).toThrow(/tier/);
  });
});

// ── Tests: whyCannotCraft ──────────────────────────────────────────────────────

describe("CraftingSystem — whyCannotCraft", () => {
  it("returns null when the recipe is craftable", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    expect(sys.whyCannotCraft("iron_sword", makeInventory(), 0)).toBeNull();
  });

  it("returns unknown_recipe for missing id", () => {
    const sys = new CraftingSystem();
    const r = sys.whyCannotCraft("nope", makeInventory(), 0);
    expect(r?.reason).toBe("unknown_recipe");
  });

  it("returns wrong_station when active bench does not match", () => {
    const sys = new CraftingSystem();
    const r: CraftingRecipe = { ...ironSwordRecipe, id: "forge_only", stationId: "forge" };
    sys.addRecipe(r);
    const fail = sys.whyCannotCraft("forge_only", makeInventory(), 0, "workbench");
    expect(fail?.reason).toBe("wrong_station");
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

// ── Tests: computeItemQuality ─────────────────────────────────────────────────

describe("computeItemQuality", () => {
  it("returns base for surplus 0", () => {
    expect(computeItemQuality(0, 0)).toBe("base");
  });

  it("returns base for surplus 9", () => {
    expect(computeItemQuality(9, 0)).toBe("base");
  });

  it("returns fine for surplus 10", () => {
    expect(computeItemQuality(10, 0)).toBe("fine");
  });

  it("returns fine for surplus 24", () => {
    expect(computeItemQuality(24, 0)).toBe("fine");
  });

  it("returns superior for surplus 25", () => {
    expect(computeItemQuality(25, 0)).toBe("superior");
  });

  it("returns exquisite for surplus 50", () => {
    expect(computeItemQuality(50, 0)).toBe("exquisite");
  });

  it("returns masterwork for surplus 75", () => {
    expect(computeItemQuality(75, 0)).toBe("masterwork");
  });

  it("accounts for requiredSkill in surplus calculation", () => {
    // skill=35, required=25 → surplus=10 → fine
    expect(computeItemQuality(35, 25)).toBe("fine");
  });

  it("clamps to base when skill is below required (craft blocked, but quality is base)", () => {
    // craft is blocked upstream; quality for negative surplus should still be base
    expect(computeItemQuality(10, 20)).toBe("base");
  });
});

// ── Tests: discovery ──────────────────────────────────────────────────────────

describe("CraftingSystem — discovery", () => {
  const hiddenRecipe: CraftingRecipe = {
    id: "secret_blade",
    label: "Secret Blade",
    category: "weapon",
    knownByDefault: false,
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 1 }],
    outputItemId: "secret_blade",
    outputItemName: "Secret Blade",
  };

  it("recipes with knownByDefault true (default) are auto-discovered", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    expect(sys.isDiscovered("iron_sword")).toBe(true);
  });

  it("recipes with knownByDefault false are not discovered by default", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(hiddenRecipe);
    expect(sys.isDiscovered("secret_blade")).toBe(false);
  });

  it("discoverRecipe marks a recipe as discovered", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(hiddenRecipe);
    sys.discoverRecipe("secret_blade");
    expect(sys.isDiscovered("secret_blade")).toBe(true);
  });

  it("craft fails with not_discovered before discovery", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(hiddenRecipe);
    const outcome = sys.craft("secret_blade", { iron_ingot: 5 });
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.reason).toBe("not_discovered");
  });

  it("canCraft returns false for undiscovered recipe", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(hiddenRecipe);
    expect(sys.canCraft("secret_blade", { iron_ingot: 5 })).toBe(false);
  });

  it("craft succeeds after discovery", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(hiddenRecipe);
    sys.discoverRecipe("secret_blade");
    const outcome = sys.craft("secret_blade", { iron_ingot: 5 });
    expect(outcome.success).toBe(true);
  });

  it("getKnownRecipes returns only discovered recipes", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(hiddenRecipe);
    const known = sys.getKnownRecipes();
    expect(known.map((r) => r.id)).toEqual(["iron_sword"]);
  });

  it("getKnownRecipes includes recipe after discoverRecipe", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(hiddenRecipe);
    sys.discoverRecipe("secret_blade");
    expect(sys.getKnownRecipes().map((r) => r.id)).toContain("secret_blade");
  });

  it("getKnownRecipesByCategory filters by category over known set", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);     // weapon, known
    sys.addRecipe(leatherArmorRecipe);  // armor, known
    sys.addRecipe(hiddenRecipe);        // weapon, unknown
    const weapons = sys.getKnownRecipesByCategory("weapon");
    expect(weapons.map((r) => r.id)).toEqual(["iron_sword"]);
  });

  it("recipes getter still returns all (including undiscovered)", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(hiddenRecipe);
    expect(sys.recipes).toHaveLength(2);
  });

  it("removeRecipe clears discovery for that recipe", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.removeRecipe("iron_sword");
    expect(sys.isDiscovered("iron_sword")).toBe(false);
  });

  it("clear() removes all discoveries", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.clear();
    expect(sys.isDiscovered("iron_sword")).toBe(false);
  });

  it("discoverRecipe on unknown id is safe and applied when recipe is added later", () => {
    const sys = new CraftingSystem();
    sys.discoverRecipe("secret_blade");
    sys.addRecipe({ ...hiddenRecipe, knownByDefault: false });
    expect(sys.isDiscovered("secret_blade")).toBe(true);
  });
});

// ── Tests: crafting stations ──────────────────────────────────────────────────

describe("CraftingSystem — stations", () => {
  const forgeRecipe: CraftingRecipe = {
    id: "iron_sword",
    label: "Iron Sword",
    category: "weapon",
    stationId: "forge",
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 2 }],
    outputItemId: "iron_sword",
    outputItemName: "Iron Sword",
  };

  const noStationRecipe: CraftingRecipe = {
    id: "leather_bag",
    label: "Leather Bag",
    category: "misc",
    requiredMaterials: [{ materialId: "leather", quantity: 3 }],
    outputItemId: "leather_bag",
    outputItemName: "Leather Bag",
  };

  it("getRecipesByStation returns recipes requiring that station", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(forgeRecipe);
    sys.addRecipe(noStationRecipe);
    const forgeRecipes = sys.getRecipesByStation("forge");
    expect(forgeRecipes.map((r) => r.id)).toEqual(["iron_sword"]);
  });

  it("getRecipesByStation returns empty when no matching recipes", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(noStationRecipe);
    expect(sys.getRecipesByStation("forge")).toHaveLength(0);
  });

  it("craft fails with wrong_station when wrong station provided", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(forgeRecipe);
    const outcome = sys.craft("iron_sword", { iron_ingot: 5 }, 0, "workbench");
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.reason).toBe("wrong_station");
      expect(outcome.message).toContain("Forge");
    }
  });

  it("craft fails with wrong_station when no station provided for station-gated recipe", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(forgeRecipe);
    const outcome = sys.craft("iron_sword", { iron_ingot: 5 }, 0);
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.reason).toBe("wrong_station");
  });

  it("craft succeeds when correct station is provided", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(forgeRecipe);
    const outcome = sys.craft("iron_sword", { iron_ingot: 5 }, 0, "forge");
    expect(outcome.success).toBe(true);
  });

  it("canCraft returns false when wrong station provided", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(forgeRecipe);
    expect(sys.canCraft("iron_sword", { iron_ingot: 5 }, 0, "workbench")).toBe(false);
  });

  it("canCraft returns true when correct station provided", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(forgeRecipe);
    expect(sys.canCraft("iron_sword", { iron_ingot: 5 }, 0, "forge")).toBe(true);
  });

  it("recipe with no stationId can be crafted at any station or no station", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(noStationRecipe);
    expect(sys.canCraft("leather_bag", { leather: 3 }, 0)).toBe(true);
    expect(sys.canCraft("leather_bag", { leather: 3 }, 0, "forge")).toBe(true);
    expect(sys.canCraft("leather_bag", { leather: 3 }, 0, "workbench")).toBe(true);
  });
});

// ── Tests: quality in craft result ───────────────────────────────────────────

describe("CraftingSystem — craft quality", () => {
  it("result includes quality field", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe); // requiredSkill 0
    const outcome = sys.craft("iron_sword", makeInventory(), 0);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quality).toBeDefined();
  });

  it("returns base quality when skill equals requiredSkill", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe); // requiredSkill 0
    const outcome = sys.craft("iron_sword", makeInventory(), 0);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quality).toBe("base");
  });

  it("returns fine quality at surplus 10", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe); // requiredSkill 25
    const outcome = sys.craft("steel_sword", makeInventory(), 35);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quality).toBe("fine");
  });

  it("returns superior quality at surplus 25", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe); // requiredSkill 25
    const outcome = sys.craft("steel_sword", makeInventory(), 50);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quality).toBe("superior");
  });

  it("returns exquisite quality at surplus 50", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe); // requiredSkill 25
    const outcome = sys.craft("steel_sword", makeInventory(), 75);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quality).toBe("exquisite");
  });

  it("returns masterwork quality at surplus 75", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(steelSwordRecipe); // requiredSkill 25
    const outcome = sys.craft("steel_sword", makeInventory(), 100);
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quality).toBe("masterwork");
  });
});

// ── Tests: XP tier scaling ────────────────────────────────────────────────────

describe("CraftingSystem — XP tier scaling", () => {
  it("no tier → xpAwarded equals craftingXp", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe); // craftingXp 15, no tier
    const outcome = sys.craft("iron_sword", makeInventory());
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.xpAwarded).toBe(15);
  });

  it("iron tier → 1.0× multiplier", () => {
    const sys = new CraftingSystem();
    const recipe: CraftingRecipe = { ...ironSwordRecipe, id: "t1", tier: "iron", craftingXp: 10 };
    sys.addRecipe(recipe);
    const outcome = sys.craft("t1", makeInventory());
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.xpAwarded).toBe(10);
  });

  it("steel tier → 1.2× multiplier (rounded)", () => {
    const sys = new CraftingSystem();
    const recipe: CraftingRecipe = { ...ironSwordRecipe, id: "t2", tier: "steel", craftingXp: 10 };
    sys.addRecipe(recipe);
    const outcome = sys.craft("t2", makeInventory());
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.xpAwarded).toBe(12);
  });

  it("daedric tier → 2.5× multiplier", () => {
    const sys = new CraftingSystem();
    const recipe: CraftingRecipe = { ...ironSwordRecipe, id: "t3", tier: "daedric", craftingXp: 20 };
    sys.addRecipe(recipe);
    const outcome = sys.craft("t3", makeInventory());
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.xpAwarded).toBe(50);
  });
});

// ── Tests: getSystemState / restoreSystemState ────────────────────────────────

describe("CraftingSystem — getSystemState / restoreSystemState", () => {
  const hiddenRecipe: CraftingRecipe = {
    id: "secret_blade",
    label: "Secret Blade",
    category: "weapon",
    knownByDefault: false,
    requiredMaterials: [{ materialId: "iron_ingot", quantity: 1 }],
    outputItemId: "secret_blade",
    outputItemName: "Secret Blade",
  };

  it("getSystemState captures craft counts and discovered ids", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(hiddenRecipe);
    sys.discoverRecipe("secret_blade");
    sys.craft("iron_sword", makeInventory());

    const state = sys.getSystemState();
    expect(state.recipeSnapshots.find((s) => s.id === "iron_sword")?.craftCount).toBe(1);
    expect(state.discoveredRecipeIds).toContain("iron_sword");
    expect(state.discoveredRecipeIds).toContain("secret_blade");
  });

  it("restoreSystemState restores craft counts", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const state: CraftingSystemState = {
      recipeSnapshots: [{ id: "iron_sword", craftCount: 4 }],
      discoveredRecipeIds: ["iron_sword"],
    };
    sys.restoreSystemState(state);
    expect(sys.getTotalCrafted("iron_sword")).toBe(4);
  });

  it("restoreSystemState restores discovery set", () => {
    const sys = new CraftingSystem();
    sys.addRecipe({ ...hiddenRecipe, knownByDefault: false });
    const state: CraftingSystemState = {
      recipeSnapshots: [],
      discoveredRecipeIds: ["secret_blade"],
    };
    sys.restoreSystemState(state);
    expect(sys.isDiscovered("secret_blade")).toBe(true);
  });

  it("round-trips system state correctly", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    sys.addRecipe(hiddenRecipe);
    sys.discoverRecipe("secret_blade");
    sys.craft("iron_sword", makeInventory());
    sys.craft("iron_sword", makeInventory());

    const state = sys.getSystemState();

    const sys2 = new CraftingSystem();
    sys2.addRecipe(ironSwordRecipe);
    sys2.addRecipe({ ...hiddenRecipe, knownByDefault: false });
    sys2.restoreSystemState(state);

    expect(sys2.getTotalCrafted("iron_sword")).toBe(2);
    expect(sys2.isDiscovered("secret_blade")).toBe(true);
  });

  it("does not fire onItemCrafted during restoreSystemState", () => {
    const sys = new CraftingSystem();
    sys.addRecipe(ironSwordRecipe);
    const spy = vi.fn();
    sys.onItemCrafted = spy;
    sys.restoreSystemState({
      recipeSnapshots: [{ id: "iron_sword", craftCount: 3 }],
      discoveredRecipeIds: ["iron_sword"],
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
