import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ItemConditionSystem,
  MAX_CONDITION,
  MIN_CONDITION,
  MULT_AT_MAX_CONDITION,
  MULT_AT_MIN_CONDITION,
  BASE_REPAIR_KIT_AMOUNT,
  REPAIR_KIT_SKILL_SCALE,
  DEFAULT_DEGRADE_AMOUNT,
} from "./item-condition-system";
import type { ItemConditionSaveState } from "./item-condition-system";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ItemConditionSystem — initial state", () => {
  it("starts with no registered items", () => {
    const sys = new ItemConditionSystem();
    expect(sys.registeredItemIds).toHaveLength(0);
  });

  it("getCondition returns undefined for unknown item", () => {
    const sys = new ItemConditionSystem();
    expect(sys.getCondition("no_item")).toBeUndefined();
  });

  it("getConditionTier returns undefined for unknown item", () => {
    const sys = new ItemConditionSystem();
    expect(sys.getConditionTier("no_item")).toBeUndefined();
  });

  it("getDamageMult returns 1.0 for unknown item", () => {
    const sys = new ItemConditionSystem();
    expect(sys.getDamageMult("no_item")).toBe(MULT_AT_MAX_CONDITION);
  });
});

describe("ItemConditionSystem — initItem / removeItem", () => {
  it("initItem registers item with MAX_CONDITION by default", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword");
    expect(sys.getCondition("sword")).toBe(MAX_CONDITION);
  });

  it("initItem registers item with specified initial condition", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 60);
    expect(sys.getCondition("sword")).toBe(60);
  });

  it("initItem clamps initialCondition to [0, 100]", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword_over", 150);
    sys.initItem("sword_under", -10);
    expect(sys.getCondition("sword_over")).toBe(MAX_CONDITION);
    expect(sys.getCondition("sword_under")).toBe(MIN_CONDITION);
  });

  it("initItem updates existing item condition", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 80);
    sys.initItem("sword", 40);
    expect(sys.getCondition("sword")).toBe(40);
  });

  it("removeItem returns true when item existed", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword");
    expect(sys.removeItem("sword")).toBe(true);
    expect(sys.getCondition("sword")).toBeUndefined();
  });

  it("removeItem returns false for unknown item", () => {
    const sys = new ItemConditionSystem();
    expect(sys.removeItem("no_item")).toBe(false);
  });

  it("registeredItemIds reflects registered items", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword");
    sys.initItem("shield");
    expect(sys.registeredItemIds).toContain("sword");
    expect(sys.registeredItemIds).toContain("shield");
    expect(sys.registeredItemIds).toHaveLength(2);
  });
});

describe("ItemConditionSystem — getConditionTier", () => {
  it("flawless at 100", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 100);
    expect(sys.getConditionTier("item")).toBe("flawless");
  });

  it("flawless at 80", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 80);
    expect(sys.getConditionTier("item")).toBe("flawless");
  });

  it("good at 79", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 79);
    expect(sys.getConditionTier("item")).toBe("good");
  });

  it("good at 60", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 60);
    expect(sys.getConditionTier("item")).toBe("good");
  });

  it("worn at 59", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 59);
    expect(sys.getConditionTier("item")).toBe("worn");
  });

  it("worn at 40", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 40);
    expect(sys.getConditionTier("item")).toBe("worn");
  });

  it("damaged at 39", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 39);
    expect(sys.getConditionTier("item")).toBe("damaged");
  });

  it("damaged at 20", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 20);
    expect(sys.getConditionTier("item")).toBe("damaged");
  });

  it("broken at 19", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 19);
    expect(sys.getConditionTier("item")).toBe("broken");
  });

  it("broken at 0", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("item", 0);
    expect(sys.getConditionTier("item")).toBe("broken");
  });
});

describe("ItemConditionSystem — getDamageMult / getArmorMult", () => {
  it("getDamageMult returns MULT_AT_MAX at full condition", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 100);
    expect(sys.getDamageMult("sword")).toBeCloseTo(MULT_AT_MAX_CONDITION);
  });

  it("getDamageMult returns MULT_AT_MIN at zero condition", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 0);
    expect(sys.getDamageMult("sword")).toBeCloseTo(MULT_AT_MIN_CONDITION);
  });

  it("getDamageMult is 0.75 at condition 50", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 50);
    expect(sys.getDamageMult("sword")).toBeCloseTo(0.75);
  });

  it("getDamageMult is between MULT_AT_MIN and MULT_AT_MAX at mid condition", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 50);
    const mult = sys.getDamageMult("sword");
    expect(mult).toBeGreaterThan(MULT_AT_MIN_CONDITION);
    expect(mult).toBeLessThan(MULT_AT_MAX_CONDITION);
  });

  it("getArmorMult returns same value as getDamageMult", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("armor", 65);
    expect(sys.getArmorMult("armor")).toBeCloseTo(sys.getDamageMult("armor"));
  });
});

describe("ItemConditionSystem — degradeItem", () => {
  it("reduces condition by DEFAULT_DEGRADE_AMOUNT", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 100);
    sys.degradeItem("sword");
    expect(sys.getCondition("sword")).toBe(100 - DEFAULT_DEGRADE_AMOUNT);
  });

  it("reduces condition by custom amount", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 80);
    sys.degradeItem("sword", 15);
    expect(sys.getCondition("sword")).toBe(65);
  });

  it("clamps condition to MIN_CONDITION", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 5);
    sys.degradeItem("sword", 100);
    expect(sys.getCondition("sword")).toBe(MIN_CONDITION);
  });

  it("returns new condition value", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 50);
    const result = sys.degradeItem("sword", 10);
    expect(result).toBe(40);
  });

  it("returns undefined for unknown item", () => {
    const sys = new ItemConditionSystem();
    expect(sys.degradeItem("no_item")).toBeUndefined();
  });

  it("fires onItemDegraded callback", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemDegraded = cb;
    sys.initItem("sword", 80);
    sys.degradeItem("sword", 5);
    expect(cb).toHaveBeenCalledWith("sword", 80, 75);
  });

  it("fires onItemBroken when condition transitions from > 0 to 0", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemBroken = cb;
    sys.initItem("sword", 5);
    sys.degradeItem("sword", 10); // → 0
    expect(cb).toHaveBeenCalledWith("sword");
  });

  it("does NOT fire onItemBroken when already at 0 and degraded further", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemBroken = cb;
    sys.initItem("sword", 0);
    sys.degradeItem("sword", 5);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does NOT fire onItemBroken when condition does not reach 0", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemBroken = cb;
    sys.initItem("sword", 50);
    sys.degradeItem("sword", 10);
    expect(cb).not.toHaveBeenCalled();
  });

  it("ignores non-positive amounts", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 80);
    sys.degradeItem("sword", 0);
    expect(sys.getCondition("sword")).toBe(80);
  });
});

describe("ItemConditionSystem — repairItem", () => {
  it("increases condition by the specified amount", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 50);
    sys.repairItem("sword", 20);
    expect(sys.getCondition("sword")).toBe(70);
  });

  it("clamps condition to MAX_CONDITION", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 90);
    sys.repairItem("sword", 50);
    expect(sys.getCondition("sword")).toBe(MAX_CONDITION);
  });

  it("returns new condition value", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 60);
    const result = sys.repairItem("sword", 15);
    expect(result).toBe(75);
  });

  it("returns undefined for unknown item", () => {
    const sys = new ItemConditionSystem();
    expect(sys.repairItem("no_item", 10)).toBeUndefined();
  });

  it("fires onItemRepaired callback", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemRepaired = cb;
    sys.initItem("sword", 60);
    sys.repairItem("sword", 20);
    expect(cb).toHaveBeenCalledWith("sword", 60, 80);
  });

  it("does NOT fire onItemRepaired when already at MAX", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemRepaired = cb;
    sys.initItem("sword", 100);
    sys.repairItem("sword", 10);
    expect(cb).not.toHaveBeenCalled();
  });

  it("ignores non-positive amounts", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 50);
    sys.repairItem("sword", 0);
    expect(sys.getCondition("sword")).toBe(50);
  });
});

describe("ItemConditionSystem — repairWithKit", () => {
  it("repairs by BASE + skill * SCALE at skill 0", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 0);
    sys.repairWithKit("sword", 0);
    expect(sys.getCondition("sword")).toBeCloseTo(BASE_REPAIR_KIT_AMOUNT);
  });

  it("repairs by BASE + 100 * SCALE at skill 100", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 0);
    sys.repairWithKit("sword", 100);
    const expected = BASE_REPAIR_KIT_AMOUNT + 100 * REPAIR_KIT_SKILL_SCALE;
    expect(sys.getCondition("sword")).toBeCloseTo(expected);
  });

  it("higher armorerSkill repairs more", () => {
    const sys1 = new ItemConditionSystem();
    const sys2 = new ItemConditionSystem();
    sys1.initItem("sword", 0);
    sys2.initItem("sword", 0);
    sys1.repairWithKit("sword", 10);
    sys2.repairWithKit("sword", 90);
    expect(sys2.getCondition("sword")!).toBeGreaterThan(sys1.getCondition("sword")!);
  });

  it("clamps armorerSkill below 0 to 0", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 0);
    sys.repairWithKit("sword", -100);
    expect(sys.getCondition("sword")).toBeCloseTo(BASE_REPAIR_KIT_AMOUNT);
  });

  it("clamps armorerSkill above 100 to 100", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 0);
    sys.repairWithKit("sword", 200);
    const expected = BASE_REPAIR_KIT_AMOUNT + 100 * REPAIR_KIT_SKILL_SCALE;
    expect(sys.getCondition("sword")).toBeCloseTo(expected);
  });

  it("returns undefined for unknown item", () => {
    const sys = new ItemConditionSystem();
    expect(sys.repairWithKit("no_item", 50)).toBeUndefined();
  });
});

describe("ItemConditionSystem — repairAll", () => {
  it("repairs all registered items", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword",  20);
    sys.initItem("shield", 30);
    sys.repairAll(0);
    expect(sys.getCondition("sword")!).toBeGreaterThan(20);
    expect(sys.getCondition("shield")!).toBeGreaterThan(30);
  });

  it("fires onItemRepaired for each item repaired", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemRepaired = cb;
    sys.initItem("sword",  20);
    sys.initItem("shield", 30);
    sys.repairAll(0);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("does not fire onItemRepaired for items already at MAX", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemRepaired = cb;
    sys.initItem("sword", 100);
    sys.repairAll(50);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("ItemConditionSystem — getBrokenItems / getAllConditions", () => {
  it("getBrokenItems returns items with condition 0", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword",  0);
    sys.initItem("shield", 50);
    sys.initItem("bow",    0);
    expect(sys.getBrokenItems()).toContain("sword");
    expect(sys.getBrokenItems()).toContain("bow");
    expect(sys.getBrokenItems()).not.toContain("shield");
  });

  it("getBrokenItems returns empty array when nothing is broken", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword", 100);
    expect(sys.getBrokenItems()).toHaveLength(0);
  });

  it("getAllConditions returns a copy of all condition values", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword",  80);
    sys.initItem("shield", 40);
    const all = sys.getAllConditions();
    expect(all.get("sword")).toBe(80);
    expect(all.get("shield")).toBe(40);
    expect(all.size).toBe(2);
  });
});

describe("ItemConditionSystem — save/restore", () => {
  it("getSaveState serializes all conditions", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword",  75);
    sys.initItem("shield", 50);
    const state = sys.getSaveState();
    expect(state.conditions["sword"]).toBe(75);
    expect(state.conditions["shield"]).toBe(50);
  });

  it("restoreFromSave loads conditions", () => {
    const sys = new ItemConditionSystem();
    const state: ItemConditionSaveState = { conditions: { "sword": 80, "bow": 30 } };
    sys.restoreFromSave(state);
    expect(sys.getCondition("sword")).toBe(80);
    expect(sys.getCondition("bow")).toBe(30);
  });

  it("restoreFromSave clamps values to [0, 100]", () => {
    const sys = new ItemConditionSystem();
    sys.restoreFromSave({ conditions: { "over": 200, "under": -50 } });
    expect(sys.getCondition("over")).toBe(100);
    expect(sys.getCondition("under")).toBe(0);
  });

  it("restoreFromSave ignores non-number values", () => {
    const sys = new ItemConditionSystem();
    // Cast to bypass TypeScript to simulate corrupt data
    sys.restoreFromSave({ conditions: { "bad": "not-a-number" as any } });
    expect(sys.getCondition("bad")).toBeUndefined();
  });

  it("restoreFromSave handles missing conditions field gracefully", () => {
    const sys = new ItemConditionSystem();
    sys.restoreFromSave({} as ItemConditionSaveState);
    expect(sys.registeredItemIds).toHaveLength(0);
  });

  it("save/restore round-trip preserves all condition values", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("sword",  90);
    sys.initItem("armor",  55);
    sys.initItem("broken", 0);

    const state = sys.getSaveState();
    const sys2 = new ItemConditionSystem();
    sys2.restoreFromSave(state);

    expect(sys2.getCondition("sword")).toBe(90);
    expect(sys2.getCondition("armor")).toBe(55);
    expect(sys2.getCondition("broken")).toBe(0);
  });

  it("restoreFromSave does not fire callbacks", () => {
    const sys = new ItemConditionSystem();
    const cb = vi.fn();
    sys.onItemRepaired = cb;
    sys.restoreFromSave({ conditions: { "sword": 80 } });
    expect(cb).not.toHaveBeenCalled();
  });

  it("restoreFromSave clears previously registered items", () => {
    const sys = new ItemConditionSystem();
    sys.initItem("old_sword", 100);
    sys.restoreFromSave({ conditions: { "new_sword": 70 } });
    expect(sys.getCondition("old_sword")).toBeUndefined();
    expect(sys.getCondition("new_sword")).toBe(70);
  });
});

describe("ItemConditionSystem — constants", () => {
  it("MAX_CONDITION is 100", () => expect(MAX_CONDITION).toBe(100));
  it("MIN_CONDITION is 0",   () => expect(MIN_CONDITION).toBe(0));
  it("MULT_AT_MAX_CONDITION is 1.0", () => expect(MULT_AT_MAX_CONDITION).toBe(1.0));
  it("MULT_AT_MIN_CONDITION is 0.5", () => expect(MULT_AT_MIN_CONDITION).toBe(0.5));
  it("BASE_REPAIR_KIT_AMOUNT is positive", () => expect(BASE_REPAIR_KIT_AMOUNT).toBeGreaterThan(0));
  it("REPAIR_KIT_SKILL_SCALE is positive", () => expect(REPAIR_KIT_SKILL_SCALE).toBeGreaterThan(0));
  it("DEFAULT_DEGRADE_AMOUNT is positive", () => expect(DEFAULT_DEGRADE_AMOUNT).toBeGreaterThan(0));
});
