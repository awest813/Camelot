import { describe, it, expect, beforeEach } from "vitest";
import {
  EnchantingSystem,
  SOUL_GEMS,
  ENCHANTMENT_EFFECTS,
  getItemEnchantmentCategory,
  type SoulGemType,
} from "./enchanting-system";

// ── Minimal stubs ─────────────────────────────────────────────────────────────

function makePlayer() {
  return {
    bonusDamage:   0,
    bonusArmor:    0,
    maxHealth:     100,
    maxMagicka:    100,
    maxStamina:    100,
  } as any;
}

function makeInventory(items: any[] = []) {
  return { items } as any;
}

function makeEquipment(equippedIds: Set<string> = new Set()) {
  return {
    isEquipped: (id: string) => equippedIds.has(id),
  } as any;
}

function makeUI() {
  const notifications: string[] = [];
  return {
    showNotification: (msg: string) => { notifications.push(msg); },
    notifications,
  } as any;
}

// ── Helper: make a generic enchantable item ───────────────────────────────────

function makeWeapon(id = "sword_01") {
  return { id, name: "Iron Sword", description: "", stackable: false, quantity: 1, slot: "mainHand", stats: { damage: 5 } };
}

function makeArmor(id = "helm_01") {
  return { id, name: "Iron Helm", description: "", stackable: false, quantity: 1, slot: "head", stats: { armor: 3 } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getItemEnchantmentCategory", () => {
  it("returns weapon for mainHand slot", () => {
    expect(getItemEnchantmentCategory("mainHand")).toBe("weapon");
  });

  it("returns weapon for offHand slot", () => {
    expect(getItemEnchantmentCategory("offHand")).toBe("weapon");
  });

  it("returns armor for head/chest/legs/feet slots", () => {
    for (const slot of ["head", "chest", "legs", "feet"]) {
      expect(getItemEnchantmentCategory(slot)).toBe("armor");
    }
  });

  it("returns null for non-equip items", () => {
    expect(getItemEnchantmentCategory(undefined)).toBeNull();
    expect(getItemEnchantmentCategory("potion")).toBeNull();
  });
});

describe("EnchantingSystem — soul gem management", () => {
  let system: EnchantingSystem;

  beforeEach(() => {
    system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
  });

  it("starts with no soul gems", () => {
    expect(system.getAvailableSoulGems()).toHaveLength(0);
    expect(system.getSoulGemCount("common")).toBe(0);
  });

  it("addSoulGem increases count", () => {
    system.addSoulGem("common", 3);
    expect(system.getSoulGemCount("common")).toBe(3);
  });

  it("removeSoulGem decrements count", () => {
    system.addSoulGem("petty", 2);
    expect(system.removeSoulGem("petty")).toBe(true);
    expect(system.getSoulGemCount("petty")).toBe(1);
  });

  it("removeSoulGem returns false when none available", () => {
    expect(system.removeSoulGem("grand")).toBe(false);
  });

  it("getAvailableSoulGems lists all types with count > 0", () => {
    system.addSoulGem("common", 1);
    system.addSoulGem("grand", 2);
    const available = system.getAvailableSoulGems();
    expect(available).toHaveLength(2);
    const types = available.map(g => g.def.type);
    expect(types).toContain("common");
    expect(types).toContain("grand");
  });
});

describe("EnchantingSystem — enchantable items", () => {
  it("returns weapon and armor items without enchantments", () => {
    const inventory = makeInventory([makeWeapon(), makeArmor()]);
    const system = new EnchantingSystem(makePlayer(), inventory, makeEquipment(), makeUI());
    const items = system.getEnchantableItems();
    expect(items).toHaveLength(2);
  });

  it("excludes items without a slot", () => {
    const potion = { id: "p1", name: "Potion", description: "", stackable: true, quantity: 1 };
    const inventory = makeInventory([potion]);
    const system = new EnchantingSystem(makePlayer(), inventory, makeEquipment(), makeUI());
    expect(system.getEnchantableItems()).toHaveLength(0);
  });

  it("excludes already-enchanted items", () => {
    const sword = { ...makeWeapon(), stats: { damage: 5, enchantment: { effectId: "fire_damage", magnitude: 3 } } };
    const inventory = makeInventory([sword]);
    const system = new EnchantingSystem(makePlayer(), inventory, makeEquipment(), makeUI());
    expect(system.getEnchantableItems()).toHaveLength(0);
  });
});

describe("EnchantingSystem — enchantItem", () => {
  let player: ReturnType<typeof makePlayer>;
  let inventory: any;
  let system: EnchantingSystem;
  let ui: ReturnType<typeof makeUI>;

  beforeEach(() => {
    player    = makePlayer();
    inventory = makeInventory([makeWeapon(), makeArmor()]);
    system    = new EnchantingSystem(player, inventory, makeEquipment(), makeUI());
    ui        = system["_ui"];
    system.addSoulGem("common");
  });

  it("successfully enchants a weapon with a weapon effect", () => {
    const result = system.enchantItem("sword_01", "fire_damage", "common");
    expect(result).not.toBeNull();
    expect(result!.name).toContain("Flaming");
    expect(result!.stats.enchantment).toBeDefined();
    expect(result!.stats.damage).toBeGreaterThan(5); // original + enchant
  });

  it("updates the inventory item in place", () => {
    system.enchantItem("sword_01", "fire_damage", "common");
    const item = inventory.items.find((i: any) => i.id === "sword_01");
    expect(item?.name).toContain("Flaming");
  });

  it("consumes the soul gem", () => {
    system.enchantItem("sword_01", "fire_damage", "common");
    expect(system.getSoulGemCount("common")).toBe(0);
  });

  it("returns null when no soul gem is available", () => {
    system.removeSoulGem("common");
    const result = system.enchantItem("sword_01", "fire_damage", "common");
    expect(result).toBeNull();
  });

  it("returns null for unknown item", () => {
    const result = system.enchantItem("nonexistent", "fire_damage", "common");
    expect(result).toBeNull();
  });

  it("returns null when applying a weapon effect to armor", () => {
    const result = system.enchantItem("helm_01", "fire_damage", "common");
    expect(result).toBeNull();
  });

  it("returns null when applying an armor effect to weapon", () => {
    const result = system.enchantItem("sword_01", "fortify_health", "common");
    expect(result).toBeNull();
  });

  it("raises the enchanting skill after a successful enchant", () => {
    const before = system.enchantingSkill;
    system.enchantItem("sword_01", "fire_damage", "common");
    expect(system.enchantingSkill).toBeGreaterThan(before);
  });

  it("magnitude scales with soul gem multiplier", () => {
    const inventorySmall  = makeInventory([makeWeapon("s1"), makeWeapon("s2")]);
    const sysSmall = new EnchantingSystem(makePlayer(), inventorySmall, makeEquipment(), makeUI());
    sysSmall.enchantingSkill = 0; // eliminate skill variance
    sysSmall.addSoulGem("petty");
    sysSmall.addSoulGem("grand");

    const smallResult = sysSmall.enchantItem("s1", "fire_damage", "petty");
    const grandResult = sysSmall.enchantItem("s2", "fire_damage", "grand");

    const smallMag = smallResult!.stats.enchantment.magnitude;
    const grandMag = grandResult!.stats.enchantment.magnitude;

    expect(grandMag).toBeGreaterThan(smallMag);
  });

  it("applies stat delta to player when item is currently equipped", () => {
    const equipped = makeEquipment(new Set(["sword_01"]));
    const sys = new EnchantingSystem(makePlayer(), makeInventory([makeWeapon()]), equipped, makeUI());
    sys.addSoulGem("common");
    const before = sys["_player"].bonusDamage;
    sys.enchantItem("sword_01", "fire_damage", "common");
    expect(sys["_player"].bonusDamage).toBeGreaterThan(before);
  });

  it("fires onItemEnchanted callback on success", () => {
    let fired = false;
    system.onItemEnchanted = () => { fired = true; };
    system.enchantItem("sword_01", "fire_damage", "common");
    expect(fired).toBe(true);
  });
});

describe("EnchantingSystem — effects catalogue", () => {
  const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());

  it("has weapon and armor effects defined", () => {
    const defs = system.getEffectDefinitions();
    const weaponEffects = defs.filter(e => e.category === "weapon");
    const armorEffects  = defs.filter(e => e.category === "armor");
    expect(weaponEffects.length).toBeGreaterThan(0);
    expect(armorEffects.length).toBeGreaterThan(0);
  });

  it("getEffectsForCategory filters correctly", () => {
    const weaponEffects = system.getEffectsForCategory("weapon");
    expect(weaponEffects.every(e => e.category === "weapon")).toBe(true);

    const armorEffects = system.getEffectsForCategory("armor");
    expect(armorEffects.every(e => e.category === "armor")).toBe(true);
  });

  it("each effect has a namePrefix, baseMagnitude > 0, and a description", () => {
    for (const eff of ENCHANTMENT_EFFECTS) {
      expect(eff.namePrefix.length).toBeGreaterThan(0);
      expect(eff.baseMagnitude).toBeGreaterThan(0);
      expect(eff.description.length).toBeGreaterThan(0);
    }
  });
});

describe("EnchantingSystem — SOUL_GEMS catalogue", () => {
  it("magnitude multipliers are ordered petty < lesser < common < greater < grand", () => {
    const types: SoulGemType[] = ["petty", "lesser", "common", "greater", "grand"];
    for (let i = 1; i < types.length; i++) {
      expect(SOUL_GEMS[types[i]].magnitudeMultiplier).toBeGreaterThan(
        SOUL_GEMS[types[i - 1]].magnitudeMultiplier,
      );
    }
  });
});

describe("EnchantingSystem — save / restore", () => {
  it("round-trips soul gems and skill through save state", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.addSoulGem("greater", 3);
    system.addSoulGem("petty", 1);
    system.enchantingSkill = 42;

    const state = system.getSaveState();

    const system2 = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system2.restoreFromSave(state);

    expect(system2.getSoulGemCount("greater")).toBe(3);
    expect(system2.getSoulGemCount("petty")).toBe(1);
    expect(system2.getSoulGemCount("common")).toBe(0);
    expect(system2.enchantingSkill).toBe(42);
  });

  it("restoreFromSave handles null gracefully", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.addSoulGem("grand", 5);
    expect(() => system.restoreFromSave(null as any)).not.toThrow();
    // State unchanged since null is a no-op
    expect(system.getSoulGemCount("grand")).toBe(5);
  });

  it("restoreFromSave clamps skill to 0–100", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.restoreFromSave({ soulGems: {}, enchantingSkill: 9999 });
    expect(system.enchantingSkill).toBe(100);

    system.restoreFromSave({ soulGems: {}, enchantingSkill: -50 });
    expect(system.enchantingSkill).toBe(0);
  });

  it("restoreFromSave ignores unknown gem types", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.restoreFromSave({ soulGems: { "legendary" as any: 5 }, enchantingSkill: 10 });
    // No crash, and no unknown gem stored
    expect(system.getAvailableSoulGems()).toHaveLength(0);
  });
});
