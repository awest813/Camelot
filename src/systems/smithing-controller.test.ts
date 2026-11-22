import { describe, it, expect, beforeEach } from "vitest";
import { CraftingSystem } from "./crafting-system";
import { ItemConditionSystem } from "./item-condition-system";
import type { Item } from "./inventory-system";
import {
  ForgeRegistry,
  FORGE_USE_RADIUS,
  SmithingController,
  SMITHING_RECIPES,
  REPAIR_HAMMER_ID,
  REPAIR_XP,
  WEAPON_WEAR_PER_HIT,
  WEAPON_WEAR_PER_POWER_ATTACK,
  MIN_VALUE_FACTOR,
  smithingMaterialStack,
  type SmithingInventory,
} from "./smithing-controller";

class FakeInventory implements SmithingInventory {
  items: Item[] = [];
  maxCapacity = 20;
  addItem(item: Item): boolean {
    if (item.stackable) {
      const existing = this.items.find((i) => i.id === item.id);
      if (existing) { existing.quantity += item.quantity; return true; }
    }
    if (this.items.length >= this.maxCapacity) return false;
    this.items.push({ ...item });
    return true;
  }
  removeItem(itemId: string, amount = 1): boolean {
    const idx = this.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;
    const item = this.items[idx];
    if (item.quantity > amount) item.quantity -= amount;
    else this.items.splice(idx, 1);
    return true;
  }
}

const sword: Item = { id: "iron_sword", name: "Iron Sword", description: "", stackable: false, quantity: 1, slot: "mainHand", stats: { damage: 10 } };
const shield: Item = { id: "iron_shield", name: "Iron Shield", description: "", stackable: false, quantity: 1, slot: "offHand", stats: { armor: 6 } };
const helm: Item = { id: "iron_helm_01", name: "Iron Helm", description: "", stackable: false, quantity: 1, slot: "head", stats: { armor: 12 } };
const ring: Item = { id: "plain_ring", name: "Plain Ring", description: "", stackable: false, quantity: 1, slot: "ring", stats: { value: 5 } };

describe("SmithingController", () => {
  let inventory: FakeInventory;
  let equipped: Map<string, Item>;
  let player: { gearDamagePenalty: number; gearArmorPenalty: number };
  let skill: number;
  let xp: number;
  let messages: string[];
  let ctrl: SmithingController;
  let condition: ItemConditionSystem;
  let crafting: CraftingSystem;

  beforeEach(() => {
    inventory = new FakeInventory();
    equipped = new Map();
    player = { gearDamagePenalty: 0, gearArmorPenalty: 0 };
    skill = 0;
    xp = 0;
    messages = [];
    crafting = new CraftingSystem();
    condition = new ItemConditionSystem();
    ctrl = new SmithingController(crafting, condition, {
      inventory,
      equipment: { getEquipped: () => equipped },
      player,
      getArmorerSkill: () => skill,
      gainArmorerXp: (n) => { xp += n; },
      notify: (m) => { messages.push(m); },
      random: () => 0,
      // Instance key = item id, so these tests can read condition by item id
      // (this is also the legacy-save migration path).  Per-copy behaviour has
      // its own describe block below.
      newInstanceId: (id) => id,
    });
  });

  // ── Recipes ────────────────────────────────────────────────────────────────

  it("registers every default recipe, all known from the start", () => {
    expect(crafting.recipes).toHaveLength(SMITHING_RECIPES.length);
    expect(crafting.getKnownRecipes()).toHaveLength(SMITHING_RECIPES.length);
  });

  it("does not re-register recipes when constructed twice on one system", () => {
    new SmithingController(crafting, condition, {
      inventory, equipment: { getEquipped: () => equipped }, player,
      getArmorerSkill: () => 0, gainArmorerXp: () => {}, notify: () => {},
    });
    expect(crafting.recipes).toHaveLength(SMITHING_RECIPES.length);
  });

  it("every recipe output has an item template with a valid shape", () => {
    for (const r of SMITHING_RECIPES) {
      const item = ctrl.buildOutputItem(r.outputItemId, "base", 1);
      expect(item.name, r.id).not.toBe(r.outputItemId);
      expect(item.quantity).toBe(1);
    }
  });

  // ── Crafting ───────────────────────────────────────────────────────────────

  it("counts materials across inventory stacks", () => {
    inventory.items.push(smithingMaterialStack("iron_ingot", 2), smithingMaterialStack("iron_ingot", 3));
    expect(ctrl.getMaterials().iron_ingot).toBe(5);
  });

  it("crafting consumes materials, adds the item, and awards XP", () => {
    inventory.items.push(smithingMaterialStack("iron_ingot", 3), smithingMaterialStack("leather_strips", 1));
    const outcome = ctrl.craft("smith_iron_sword");
    expect(outcome.success).toBe(true);
    expect(ctrl.getMaterials().iron_ingot).toBe(1);
    expect(ctrl.getMaterials().leather_strips).toBeUndefined();
    const made = inventory.items.find((i) => i.id.startsWith("iron_sword"));
    expect(made?.slot).toBe("mainHand");
    expect(xp).toBe(12);
    expect(condition.getCondition(made!.id)).toBe(100);
  });

  it("refuses without materials and leaves the inventory untouched", () => {
    inventory.items.push(smithingMaterialStack("iron_ingot", 1));
    const outcome = ctrl.craft("smith_iron_sword");
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.reason).toBe("missing_materials");
    expect(ctrl.getMaterials().iron_ingot).toBe(1);
    expect(xp).toBe(0);
    expect(messages.at(-1)).toMatch(/Missing materials: 2× Iron Ingot \(have 1\)/);
  });

  it("gates recipes on Armorer skill", () => {
    inventory.items.push(smithingMaterialStack("steel_ingot", 2), smithingMaterialStack("leather_strips", 1));
    const outcome = ctrl.craft("smith_steel_sword", "forge");
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.reason).toBe("skill_too_low");
    skill = 25;
    expect(ctrl.craft("smith_steel_sword", "forge").success).toBe(true);
  });

  it("steel work needs a forge; iron basics can be field-smithed", () => {
    skill = 50;
    inventory.items.push(
      smithingMaterialStack("steel_ingot", 2),
      smithingMaterialStack("iron_ingot", 2),
      smithingMaterialStack("leather_strips", 2),
    );
    const away = ctrl.craft("smith_steel_sword");
    expect(away.success).toBe(false);
    if (!away.success) expect(away.reason).toBe("wrong_station");
    expect(messages.at(-1)).toBe("Steel Sword requires a Forge.");
    expect(ctrl.getMaterials().steel_ingot).toBe(2);
    expect(ctrl.craft("smith_iron_sword").success).toBe(true);
    expect(ctrl.craft("smith_steel_sword", "forge").success).toBe(true);
  });

  it("refuses when the bag has no room for the output", () => {
    inventory.maxCapacity = 3;
    inventory.items.push(
      smithingMaterialStack("iron_ingot", 5),
      smithingMaterialStack("leather_strips", 5),
      { ...ring },
    );
    const outcome = ctrl.craft("smith_iron_dagger");
    expect(outcome.success).toBe(false);
    expect(messages.at(-1)).toMatch(/Inventory full/);
    expect(ctrl.getMaterials().iron_ingot).toBe(5);
  });

  it("allows a craft when consumed materials free the slot it needs", () => {
    inventory.maxCapacity = 2;
    inventory.items.push(smithingMaterialStack("iron_ingot", 2), { ...ring });
    expect(ctrl.craft("smith_iron_helm").success).toBe(true);
    expect(inventory.items.some((i) => i.slot === "head")).toBe(true);
  });

  it("stackable outputs stack onto an existing stack", () => {
    inventory.items.push(
      smithingMaterialStack("iron_ingot", 1),
      smithingMaterialStack("leather_strips", 1),
      smithingMaterialStack(REPAIR_HAMMER_ID, 1),
    );
    expect(ctrl.craft("smith_repair_hammer").success).toBe(true);
    expect(inventory.items.filter((i) => i.id === REPAIR_HAMMER_ID)).toHaveLength(1);
    expect(ctrl.getMaterials()[REPAIR_HAMMER_ID]).toBe(3);
  });

  it("higher quality gives a distinct id, a prefixed name and scaled stats", () => {
    const base = ctrl.buildOutputItem("steel_sword", "base", 1);
    const master = ctrl.buildOutputItem("steel_sword", "masterwork", 1);
    expect(base.id).toBe("steel_sword");
    expect(master.id).toBe("steel_sword_masterwork");
    expect(master.name).toMatch(/Steel Sword$/);
    expect(master.name).not.toBe(base.name);
    expect(master.stats.damage).toBeGreaterThan(base.stats.damage);
    // Templates are never mutated.
    expect(ctrl.buildOutputItem("steel_sword", "base", 1).stats.damage).toBe(base.stats.damage);
  });

  it("materials ignore quality", () => {
    expect(ctrl.buildOutputItem("steel_ingot", "masterwork", 1).id).toBe("steel_ingot");
  });

  // ── Wear ───────────────────────────────────────────────────────────────────

  it("weapon hits wear the main-hand weapon and raise the damage penalty", () => {
    equipped.set("mainHand", { ...sword });
    ctrl.trackEquippedGear();
    for (let i = 0; i < 40; i++) ctrl.onWeaponHit(false);
    expect(condition.getCondition("iron_sword")).toBeCloseTo(100 - 40 * WEAPON_WEAR_PER_HIT);
    // 80% condition → 0.9 mult → 10% of 10 damage lost.
    expect(player.gearDamagePenalty).toBeCloseTo(1);
    ctrl.onWeaponHit(true);
    expect(condition.getCondition("iron_sword")).toBeCloseTo(80 - WEAPON_WEAR_PER_POWER_ATTACK);
  });

  it("being struck wears an armor piece; rings never wear", () => {
    equipped.set("head", { ...helm });
    equipped.set("ring", { ...ring });
    ctrl.onPlayerStruck();
    expect(condition.getCondition("iron_helm_01")).toBe(99);
    expect(condition.getCondition("plain_ring")).toBeUndefined();
    expect(player.gearArmorPenalty).toBeGreaterThan(0);
  });

  it("being struck with no armor is a no-op", () => {
    equipped.set("mainHand", { ...sword });
    ctrl.onPlayerStruck();
    expect(condition.getCondition("iron_sword")).toBeUndefined();
  });

  it("blocking wears the shield, or the weapon with no shield", () => {
    equipped.set("mainHand", { ...sword });
    ctrl.onBlock();
    expect(condition.getCondition("iron_sword")).toBe(99);
    equipped.set("offHand", { ...shield });
    ctrl.onBlock();
    expect(condition.getCondition("iron_shield")).toBe(99);
    expect(condition.getCondition("iron_sword")).toBe(99);
  });

  it("announces when an equipped piece breaks", () => {
    equipped.set("mainHand", { ...sword });
    condition.initItem("iron_sword", 1);
    ctrl.onWeaponHit(true);
    expect(messages.at(-1)).toMatch(/Iron Sword is broken/);
    // Broken = half effectiveness.
    expect(player.gearDamagePenalty).toBeCloseTo(5);
  });

  it("unequipping drops the penalty on refresh", () => {
    equipped.set("mainHand", { ...sword });
    condition.initItem("iron_sword", 0);
    ctrl.refreshPenalties();
    expect(player.gearDamagePenalty).toBeCloseTo(5);
    equipped.clear();
    ctrl.refreshPenalties();
    expect(player.gearDamagePenalty).toBe(0);
  });

  // ── Repair ─────────────────────────────────────────────────────────────────

  it("ignores clicks on non-hammer items", () => {
    expect(ctrl.tryUseRepairItem({ ...sword })).toBe(false);
  });

  it("a repair hammer mends the most worn piece and is consumed", () => {
    equipped.set("mainHand", { ...sword });
    equipped.set("head", { ...helm });
    condition.initItem("iron_sword", 70);
    condition.initItem("iron_helm_01", 30);
    inventory.items.push(smithingMaterialStack(REPAIR_HAMMER_ID, 2));
    skill = 20;
    expect(ctrl.tryUseRepairItem(inventory.items[0])).toBe(true);
    // 10 + 20 × 0.5 = +20
    expect(condition.getCondition("iron_helm_01")).toBe(50);
    expect(condition.getCondition("iron_sword")).toBe(70);
    expect(ctrl.getMaterials()[REPAIR_HAMMER_ID]).toBe(1);
    expect(xp).toBe(REPAIR_XP);
  });

  it("a repair hammer is kept when nothing needs repair", () => {
    equipped.set("mainHand", { ...sword });
    ctrl.trackEquippedGear();
    inventory.items.push(smithingMaterialStack(REPAIR_HAMMER_ID, 1));
    expect(ctrl.tryUseRepairItem(inventory.items[0])).toBe(true);
    expect(ctrl.getMaterials()[REPAIR_HAMMER_ID]).toBe(1);
    expect(messages.at(-1)).toMatch(/good repair/);
  });

  it("summarises equipped condition, most worn first", () => {
    equipped.set("mainHand", { ...sword });
    equipped.set("head", { ...helm });
    equipped.set("ring", { ...ring });
    condition.initItem("iron_sword", 90);
    condition.initItem("iron_helm_01", 40.4);
    expect(ctrl.getEquippedConditionSummary()).toEqual([
      { slot: "head", name: "Iron Helm", condition: 40 },
      { slot: "mainHand", name: "Iron Sword", condition: 90 },
    ]);
  });

  // ── Armorer perks ──────────────────────────────────────────────────────────

  it("the wear perk multiplier slows wear", () => {
    (player as { perkWearMultiplier?: number }).perkWearMultiplier = 0.5;
    equipped.set("head", { ...helm });
    ctrl.onPlayerStruck();
    expect(condition.getCondition("iron_helm_01")).toBe(99.5);
  });

  it("the repair perk multiplier boosts hammer repairs", () => {
    (player as { perkRepairMultiplier?: number }).perkRepairMultiplier = 1.5;
    equipped.set("mainHand", { ...sword });
    condition.initItem("iron_sword", 10);
    inventory.items.push(smithingMaterialStack(REPAIR_HAMMER_ID, 1));
    ctrl.tryUseRepairItem(inventory.items[0]);
    expect(condition.getCondition("iron_sword")).toBe(25);
  });

  it("the quality perk raises quality without bypassing the skill gate", () => {
    (player as { perkSmithingQualityBonus?: number }).perkSmithingQualityBonus = 40;
    inventory.items.push(smithingMaterialStack("iron_ingot", 4), smithingMaterialStack("leather_strips", 2));
    const outcome = ctrl.craft("smith_iron_sword");
    expect(outcome.success).toBe(true);
    if (outcome.success) expect(outcome.result.quality).not.toBe("base");
    expect(inventory.items.some((i) => i.id.startsWith("iron_sword_"))).toBe(true);
    // Steel still needs real Armorer 25, even at a forge.
    inventory.items.push(smithingMaterialStack("steel_ingot", 2));
    const steel = ctrl.craft("smith_steel_sword", "forge");
    expect(steel.success).toBe(false);
    if (!steel.success) expect(steel.reason).toBe("skill_too_low");
  });

  // ── Per-copy condition ─────────────────────────────────────────────────────

  describe("per-copy condition", () => {
    let n: number;
    beforeEach(() => {
      n = 0;
      crafting = new CraftingSystem();
      condition = new ItemConditionSystem();
      ctrl = new SmithingController(crafting, condition, {
        inventory,
        equipment: { getEquipped: () => equipped },
        player,
        getArmorerSkill: () => skill,
        gainArmorerXp: (amount) => { xp += amount; },
        notify: (m) => { messages.push(m); },
        random: () => 0,
        newInstanceId: (id) => `${id}#${++n}`,
      });
    });

    it("two copies of the same sword wear independently", () => {
      const a = { ...sword };
      const b = { ...sword };
      equipped.set("mainHand", a);
      for (let i = 0; i < 20; i++) ctrl.onWeaponHit(true);
      equipped.set("mainHand", b);
      ctrl.onWeaponHit(false);
      expect(a.instanceId).toBe("iron_sword#1");
      expect(b.instanceId).toBe("iron_sword#2");
      expect(ctrl.getItemCondition(a)).toBe(80);
      expect(ctrl.getItemCondition(b)).toBe(99.5);
    });

    it("each forged piece is its own pristine instance", () => {
      equipped.set("mainHand", { ...sword });
      for (let i = 0; i < 30; i++) ctrl.onWeaponHit(true);
      inventory.items.push(smithingMaterialStack("iron_ingot", 2), smithingMaterialStack("leather_strips", 1));
      ctrl.craft("smith_iron_sword");
      const forged = inventory.items.find((i) => i.slot === "mainHand")!;
      expect(forged.instanceId).toBeDefined();
      expect(ctrl.getItemCondition(forged)).toBe(100);
      // The worn one is untouched by the new forge.
      expect(ctrl.getItemCondition(equipped.get("mainHand")!)).toBe(70);
    });

    it("migrates a legacy id-keyed condition onto the first instance", () => {
      condition.initItem("iron_sword", 42);
      const s1 = { ...sword };
      equipped.set("mainHand", s1);
      ctrl.trackEquippedGear();
      expect(ctrl.getItemCondition(s1)).toBe(42);
    });

    it("trade value falls with condition: full when untracked, a quarter when broken", () => {
      const fresh = { ...sword };
      expect(ctrl.getValueMultiplier(fresh)).toBe(1);
      equipped.set("mainHand", fresh);
      ctrl.trackEquippedGear();
      expect(ctrl.getValueMultiplier(fresh)).toBe(1);
      condition.initItem(fresh.instanceId!, 0);
      expect(ctrl.getValueMultiplier(fresh)).toBe(MIN_VALUE_FACTOR);
      condition.initItem(fresh.instanceId!, 50);
      expect(ctrl.getValueMultiplier(fresh)).toBeCloseTo(MIN_VALUE_FACTOR + (1 - MIN_VALUE_FACTOR) / 2);
    });

    it("untracked items report no condition; stats-less items never do", () => {
      expect(ctrl.getItemCondition({ ...sword })).toBeNull();
      expect(ctrl.getItemCondition({ ...ring })).toBeNull();
    });

    it("prunes condition for pieces the player no longer owns", () => {
      const kept = { ...sword };
      const sold = { ...helm };
      equipped.set("mainHand", kept);
      equipped.set("head", sold);
      ctrl.trackEquippedGear();
      equipped.delete("head");
      ctrl.pruneConditions([kept]);
      expect(condition.registeredItemIds).toEqual([kept.instanceId]);
    });
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  it("condition and crafting state round-trip through their save states", () => {
    inventory.items.push(smithingMaterialStack("iron_ingot", 2));
    ctrl.craft("smith_iron_helm");
    condition.initItem("iron_sword", 42);

    const crafting2 = new CraftingSystem();
    const condition2 = new ItemConditionSystem();
    new SmithingController(crafting2, condition2, {
      inventory: new FakeInventory(), equipment: { getEquipped: () => new Map() }, player,
      getArmorerSkill: () => 0, gainArmorerXp: () => {}, notify: () => {},
    });
    crafting2.restoreSystemState(crafting.getSystemState());
    condition2.restoreFromSave(condition.getSaveState());
    expect(crafting2.getTotalCrafted("smith_iron_helm")).toBe(1);
    expect(condition2.getCondition("iron_sword")).toBe(42);
  });
});

describe("ForgeRegistry", () => {
  it("reports a forge only within reach", () => {
    const reg = new ForgeRegistry();
    expect(reg.stationAt(0, 0)).toBeUndefined();
    reg.add("f1", 3, 4);
    expect(reg.nearestDistance(0, 0)).toBe(5);
    expect(reg.stationAt(0, 0)).toBe("forge");
    expect(reg.stationAt(3 + FORGE_USE_RADIUS + 1, 4)).toBeUndefined();
  });

  it("drops a chunk's forges on unload but keeps permanent ones", () => {
    const reg = new ForgeRegistry();
    reg.add("start", 0, 0, null);
    reg.add("a", 100, 100, "6,6");
    reg.add("b", 120, 100, "7,6");
    reg.removeGroup("6,6");
    expect(reg.size).toBe(2);
    expect(reg.stationAt(100, 100)).toBeUndefined();
    expect(reg.stationAt(0, 0)).toBe("forge");
  });

  it("re-adding the same id moves the forge instead of duplicating it", () => {
    const reg = new ForgeRegistry();
    reg.add("f", 0, 0);
    reg.add("f", 50, 50);
    expect(reg.size).toBe(1);
    expect(reg.stationAt(0, 0)).toBeUndefined();
  });
});
