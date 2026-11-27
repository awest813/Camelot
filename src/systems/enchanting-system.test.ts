import { describe, it, expect, beforeEach } from "vitest";
import {
  EnchantingSystem,
  SPIRIT_VESSELS,
  ENCHANTMENT_EFFECTS,
  getItemEnchantmentCategory,
  type VesselType,
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

describe("EnchantingSystem — spirit vessel management", () => {
  let system: EnchantingSystem;

  beforeEach(() => {
    system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
  });

  it("starts with no spirit vessels", () => {
    expect(system.getAvailableVessels()).toHaveLength(0);
    expect(system.getVesselCount("silver")).toBe(0);
  });

  it("addVessel increases count", () => {
    system.addVessel("silver", 3);
    expect(system.getVesselCount("silver")).toBe(3);
  });

  it("removeVessel decrements count", () => {
    system.addVessel("clay", 2);
    expect(system.removeVessel("clay")).toBe(true);
    expect(system.getVesselCount("clay")).toBe(1);
  });

  it("removeVessel returns false when none available", () => {
    expect(system.removeVessel("grail")).toBe(false);
  });

  it("getAvailableVessels lists all types with count > 0", () => {
    system.addVessel("silver", 1);
    system.addVessel("grail", 2);
    const available = system.getAvailableVessels();
    expect(available).toHaveLength(2);
    const types = available.map(g => g.def.type);
    expect(types).toContain("silver");
    expect(types).toContain("grail");
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
    system.addVessel("silver");
  });

  it("successfully enchants a weapon with a weapon effect", () => {
    const result = system.enchantItem("sword_01", "fire_damage", "silver");
    expect(result).not.toBeNull();
    expect(result!.name).toContain("Flaming");
    expect(result!.stats.enchantment).toBeDefined();
    expect(result!.stats.damage, "fire lands as its own element, not flat damage").toBe(makeWeapon().stats!.damage);
    expect(result!.stats.enchantment.effectId).toBe("fire_damage");
  });

  it("updates the inventory item in place", () => {
    system.enchantItem("sword_01", "fire_damage", "silver");
    const item = inventory.items.find((i: any) => i.id === "sword_01");
    expect(item?.name).toContain("Flaming");
  });

  it("consumes the spirit vessel", () => {
    system.enchantItem("sword_01", "fire_damage", "silver");
    expect(system.getVesselCount("silver")).toBe(0);
  });

  it("returns null when no spirit vessel is available", () => {
    system.removeVessel("silver");
    const result = system.enchantItem("sword_01", "fire_damage", "silver");
    expect(result).toBeNull();
  });

  it("returns null for unknown item", () => {
    const result = system.enchantItem("nonexistent", "fire_damage", "silver");
    expect(result).toBeNull();
  });

  it("returns null when applying a weapon effect to armor", () => {
    const result = system.enchantItem("helm_01", "fire_damage", "silver");
    expect(result).toBeNull();
  });

  it("returns null when applying an armor effect to weapon", () => {
    const result = system.enchantItem("sword_01", "fortify_health", "silver");
    expect(result).toBeNull();
  });

  it("raises the enchanting skill after a successful enchant", () => {
    const before = system.enchantingSkill;
    system.enchantItem("sword_01", "fire_damage", "silver");
    expect(system.enchantingSkill).toBeGreaterThan(before);
  });

  it("magnitude scales with spirit vessel multiplier", () => {
    const inventorySmall  = makeInventory([makeWeapon("s1"), makeWeapon("s2")]);
    const sysSmall = new EnchantingSystem(makePlayer(), inventorySmall, makeEquipment(), makeUI());
    sysSmall.enchantingSkill = 0; // eliminate skill variance
    sysSmall.addVessel("clay");
    sysSmall.addVessel("grail");

    const smallResult = sysSmall.enchantItem("s1", "fire_damage", "clay");
    const grandResult = sysSmall.enchantItem("s2", "fire_damage", "grail");

    const smallMag = smallResult!.stats.enchantment.magnitude;
    const grandMag = grandResult!.stats.enchantment.magnitude;

    expect(grandMag).toBeGreaterThan(smallMag);
  });

  it("applies stat delta to player when item is currently equipped", () => {
    const equipped = makeEquipment(new Set(["helm_01"]));
    const sys = new EnchantingSystem(makePlayer(), makeInventory([makeArmor()]), equipped, makeUI());
    sys.addVessel("silver");
    const before = sys["_player"].bonusDamage;
    sys.enchantItem("helm_01", "fortify_strength", "silver");
    expect(sys["_player"].bonusDamage).toBeGreaterThan(before);
  });

  it("fires onItemEnchanted callback on success", () => {
    let fired = false;
    system.onItemEnchanted = () => { fired = true; };
    system.enchantItem("sword_01", "fire_damage", "silver");
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

describe("EnchantingSystem — SPIRIT_VESSELS catalogue", () => {
  it("magnitude multipliers are ordered petty < lesser < common < greater < grand", () => {
    const types: VesselType[] = ["clay", "pewter", "silver", "gold", "grail"];
    for (let i = 1; i < types.length; i++) {
      expect(SPIRIT_VESSELS[types[i]].magnitudeMultiplier).toBeGreaterThan(
        SPIRIT_VESSELS[types[i - 1]].magnitudeMultiplier,
      );
    }
  });
});

describe("EnchantingSystem — save / restore", () => {
  it("round-trips spirit vessels and skill through save state", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.addVessel("gold", 3);
    system.addVessel("clay", 1);
    system.enchantingSkill = 42;

    const state = system.getSaveState();

    const system2 = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system2.restoreFromSave(state);

    expect(system2.getVesselCount("gold")).toBe(3);
    expect(system2.getVesselCount("clay")).toBe(1);
    expect(system2.getVesselCount("silver")).toBe(0);
    expect(system2.enchantingSkill).toBe(42);
  });

  it("restoreFromSave handles null gracefully", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.addVessel("grail", 5);
    expect(() => system.restoreFromSave(null as any)).not.toThrow();
    // State unchanged since null is a no-op
    expect(system.getVesselCount("grail")).toBe(5);
  });

  it("restoreFromSave clamps skill to 0–100", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.restoreFromSave({ vessels: {}, enchantingSkill: 9999 });
    expect(system.enchantingSkill).toBe(100);

    system.restoreFromSave({ vessels: {}, enchantingSkill: -50 });
    expect(system.enchantingSkill).toBe(0);
  });

  it("restoreFromSave ignores unknown gem types", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.restoreFromSave({ vessels: { legendary: 5 } as any, enchantingSkill: 10 });
    // No crash, and no unknown gem stored
    expect(system.getAvailableVessels()).toHaveLength(0);
  });
});

describe("EnchantingSystem — saves from before the rename", () => {
  it("reads spirit vessels saved as soulGems", () => {
    const system = new EnchantingSystem(makePlayer(), makeInventory(), makeEquipment(), makeUI());
    system.restoreFromSave({ soulGems: { pewter: 2 }, enchantingSkill: 10 } as never);
    expect(system.getVesselCount("pewter")).toBe(2);
  });
});
