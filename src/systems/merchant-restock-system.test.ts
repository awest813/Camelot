import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MerchantRestockSystem,
  DEFAULT_RESTOCK_HOURS,
  MIN_RESTOCK_HOURS,
  MAX_RESTOCK_HOURS,
} from "./merchant-restock-system";
import type { BarterSystem } from "./barter-system";
import type { Item } from "./inventory-system";

// ── Minimal mocks ─────────────────────────────────────────────────────────────

const POTION: Item = {
  id: "potion_hp_01",
  name: "Health Potion",
  description: "Restores 50 HP.",
  stackable: true,
  quantity: 5,
  weight: 0.3,
  stats: { value: 25 },
};

const ARROW: Item = {
  id: "arrow_bundle",
  name: "Arrows (20)",
  description: "Iron arrows.",
  stackable: true,
  quantity: 3,
  weight: 1,
  stats: { value: 15 },
};

interface FakeMerchantRecord {
  inventory: Item[];
  gold: number;
}

function makeBarterSystem(initialInventory: Item[] = [{ ...POTION }], gold = 500): BarterSystem {
  const merchant: FakeMerchantRecord = {
    inventory: initialInventory.map((i) => ({ ...i })),
    gold,
  };
  return {
    getMerchant: vi.fn((_id: string) => merchant),
    _merchant: merchant,
  } as unknown as BarterSystem;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MerchantRestockSystem", () => {
  let mrs: MerchantRestockSystem;
  let barter: ReturnType<typeof makeBarterSystem>;

  beforeEach(() => {
    mrs = new MerchantRestockSystem();
    barter = makeBarterSystem();
  });

  // ── registerMerchant ──────────────────────────────────────────────────────

  it("registers a merchant with the default interval", () => {
    mrs.registerMerchant("merchant_01", [POTION], 500);
    const entry = mrs.getEntry("merchant_01")!;
    expect(entry.merchantId).toBe("merchant_01");
    expect(entry.intervalHours).toBe(DEFAULT_RESTOCK_HOURS);
    expect(entry.templateGold).toBe(500);
  });

  it("registers a merchant with a custom interval", () => {
    mrs.registerMerchant("merchant_02", [], 200, 24, 0);
    expect(mrs.getEntry("merchant_02")!.intervalHours).toBe(24);
  });

  it("clamps interval to [MIN, MAX]", () => {
    mrs.registerMerchant("m_short", [], 0, 0);
    mrs.registerMerchant("m_long",  [], 0, MAX_RESTOCK_HOURS + 1000);
    expect(mrs.getEntry("m_short")!.intervalHours).toBe(MIN_RESTOCK_HOURS);
    expect(mrs.getEntry("m_long")!.intervalHours).toBe(MAX_RESTOCK_HOURS);
  });

  it("sets nextRestockAt based on currentGameTime + interval", () => {
    mrs.registerMerchant("m", [POTION], 500, 72, 120);
    expect(mrs.getEntry("m")!.nextRestockAt).toBe(120 + 72 * 60);
  });

  it("deep-copies template inventory", () => {
    const template = [{ ...POTION }];
    mrs.registerMerchant("m", template, 500);
    template[0].quantity = 999; // mutate original
    expect(mrs.getEntry("m")!.templateInventory[0].quantity).toBe(POTION.quantity);
  });

  // ── update — no restock ────────────────────────────────────────────────────

  it("does not restock before the interval elapses", () => {
    const cb = vi.fn();
    mrs.onRestock = cb;
    mrs.registerMerchant("m", [POTION], 500, 72, 0);
    mrs.update(72 * 60 - 1, barter as unknown as BarterSystem);
    expect(cb).not.toHaveBeenCalled();
  });

  // ── update — restock fires ─────────────────────────────────────────────────

  it("fires onRestock exactly at the interval boundary", () => {
    const cb = vi.fn();
    mrs.onRestock = cb;
    mrs.registerMerchant("m", [POTION], 500, 72, 0);
    mrs.update(72 * 60, barter as unknown as BarterSystem);
    expect(cb).toHaveBeenCalledWith("m");
  });

  it("fires onRestock well past the interval", () => {
    const cb = vi.fn();
    mrs.onRestock = cb;
    mrs.registerMerchant("m", [POTION], 500, 72, 0);
    mrs.update(999999, barter as unknown as BarterSystem);
    expect(cb).toHaveBeenCalledTimes(1); // fires once regardless of elapsed cycles
  });

  it("advances nextRestockAt after each restock", () => {
    mrs.registerMerchant("m", [POTION], 500, 72, 0);
    mrs.update(72 * 60, barter as unknown as BarterSystem);
    const entry = mrs.getEntry("m")!;
    expect(entry.nextRestockAt).toBeGreaterThan(72 * 60);
  });

  it("restores merchant inventory to template on restock", () => {
    const fakeBarter = makeBarterSystem([], 0);
    mrs.registerMerchant("m", [{ ...POTION }], 500, 72, 0);
    mrs.update(72 * 60, fakeBarter as unknown as BarterSystem);
    const merchant = (fakeBarter as any)._merchant as FakeMerchantRecord;
    expect(merchant.inventory.length).toBe(1);
    expect(merchant.inventory[0].id).toBe(POTION.id);
  });

  it("restores merchant gold to template on restock", () => {
    const fakeBarter = makeBarterSystem([POTION], 50);
    mrs.registerMerchant("m", [POTION], 500, 72, 0);
    mrs.update(72 * 60, fakeBarter as unknown as BarterSystem);
    const merchant = (fakeBarter as any)._merchant as FakeMerchantRecord;
    expect(merchant.gold).toBe(500);
  });

  it("fires onRestock for multiple merchants in the same tick", () => {
    const cb = vi.fn();
    mrs.onRestock = cb;
    const b1 = makeBarterSystem();
    const b2 = makeBarterSystem();
    mrs.registerMerchant("m1", [POTION], 500, 24, 0);
    mrs.registerMerchant("m2", [ARROW], 300, 48, 0);
    // Both are past their intervals at 48*60
    const combined = {
      getMerchant: (id: string) => id === "m1" ? (b1 as any)._merchant : (b2 as any)._merchant,
    } as unknown as BarterSystem;
    mrs.update(48 * 60 + 1, combined);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("does not restock if getMerchant returns undefined", () => {
    const emptyBarter = { getMerchant: vi.fn(() => undefined) } as unknown as BarterSystem;
    mrs.registerMerchant("m", [POTION], 500, 1, 0);
    expect(() => mrs.update(9999, emptyBarter)).not.toThrow();
  });

  // ── entries accessor ──────────────────────────────────────────────────────

  it("entries returns all registered merchants", () => {
    mrs.registerMerchant("a", [], 100);
    mrs.registerMerchant("b", [], 200);
    expect(mrs.entries.length).toBe(2);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState captures interval and nextRestockAt", () => {
    mrs.registerMerchant("m", [POTION], 500, 72, 0);
    const state = mrs.getSaveState();
    expect(state.entries[0].merchantId).toBe("m");
    expect(state.entries[0].intervalHours).toBe(72);
  });

  it("restoreFromSave restores nextRestockAt", () => {
    mrs.registerMerchant("m", [POTION], 500, 72, 0);
    mrs.restoreFromSave({
      entries: [{ merchantId: "m", intervalHours: 72, nextRestockAt: 99999 }],
    });
    expect(mrs.getEntry("m")!.nextRestockAt).toBe(99999);
  });

  it("restoreFromSave ignores unknown merchants", () => {
    mrs.registerMerchant("m", [POTION], 500);
    expect(() =>
      mrs.restoreFromSave({
        entries: [{ merchantId: "unknown_merchant", intervalHours: 24, nextRestockAt: 0 }],
      }),
    ).not.toThrow();
    expect(mrs.entries.length).toBe(1);
  });

  it("restoreFromSave handles null gracefully", () => {
    expect(() => mrs.restoreFromSave(null as any)).not.toThrow();
  });

  it("full round-trip save/restore preserves nextRestockAt", () => {
    mrs.registerMerchant("m", [POTION], 500, 48, 0);
    mrs.update(48 * 60, barter as unknown as BarterSystem); // fire first restock
    const state = mrs.getSaveState();

    const mrs2 = new MerchantRestockSystem();
    mrs2.registerMerchant("m", [POTION], 500, 48, 0);
    mrs2.restoreFromSave(state);

    expect(mrs2.getEntry("m")!.nextRestockAt).toBe(mrs.getEntry("m")!.nextRestockAt);
  });
});
