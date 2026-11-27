import { describe, it, expect, beforeEach } from "vitest";
import { HorseSystem } from "./horse-system";
import type { Item } from "./inventory-system";

const SWORD: Item = {
  id: "iron_sword",
  name: "Iron Sword",
  description: "A plain iron sword.",
  stackable: false,
  quantity: 1,
  slot: "mainHand",
  stats: { damage: 8 },
};

const POTION: Item = {
  id: "health_potion",
  name: "Health Potion",
  description: "Restores health.",
  stackable: true,
  quantity: 2,
};

describe("HorseSystem", () => {
  let hs: HorseSystem;

  beforeEach(() => {
    hs = new HorseSystem();
    hs.registerHorse({ id: "llamrei", name: "Llamrei", speed: 2.5, saddlebagCapacity: 5, stableId: "camelot_stable" });
    hs.registerHorse({ id: "frost", name: "Frost", speed: 2.0, stableId: "camelot_stable" });
    hs.registerStableNPC({
      npcName: "Old Hob",
      availableHorseIds: ["llamrei", "frost"],
      prices: { llamrei: 1000, frost: 500 },
    });
  });

  // ── Registration ────────────────────────────────────────────────────────

  it("should register horses and expose them via horses getter", () => {
    expect(hs.horses).toHaveLength(2);
    expect(hs.horses.map(h => h.id)).toContain("llamrei");
  });

  it("should return null for unknown horse id", () => {
    expect(hs.getHorse("ghost")).toBeNull();
  });

  it("grantHorse returns false for unknown id", () => {
    expect(hs.grantHorse("ghost")).toBe(false);
  });

  it("grantHorse marks horse as owned", () => {
    hs.grantHorse("frost");
    expect(hs.getHorse("frost")!.isOwned).toBe(true);
    expect(hs.ownedHorses).toHaveLength(1);
  });

  // ── Stable / purchasing ──────────────────────────────────────────────────

  it("purchaseHorse returns -1 for unknown NPC", () => {
    expect(hs.purchaseHorse("NoOne", "llamrei", 9999)).toBe(-1);
  });

  it("purchaseHorse returns -1 when horse not in stable roster", () => {
    expect(hs.purchaseHorse("Old Hob", "unicorn", 9999)).toBe(-1);
  });

  it("purchaseHorse returns -1 when player cannot afford", () => {
    expect(hs.purchaseHorse("Old Hob", "llamrei", 50)).toBe(-1);
  });

  it("purchaseHorse grants ownership and returns price", () => {
    const price = hs.purchaseHorse("Old Hob", "llamrei", 2000);
    expect(price).toBe(1000);
    expect(hs.getHorse("llamrei")!.isOwned).toBe(true);
  });

  it("purchaseHorse returns -2 when horse already owned", () => {
    hs.grantHorse("frost");
    expect(hs.purchaseHorse("Old Hob", "frost", 9999)).toBe(-2);
  });

  it("purchaseHorse fires onHorsePurchased callback", () => {
    let purchased: string | null = null;
    hs.onHorsePurchased = (h) => { purchased = h.id; };
    hs.purchaseHorse("Old Hob", "frost", 500);
    expect(purchased).toBe("frost");
  });

  // ── Mounting / dismounting ──────────────────────────────────────────────

  it("cannot mount unowned horse", () => {
    expect(hs.mountHorse("llamrei")).toBe(false);
    expect(hs.isMounted).toBe(false);
  });

  it("cannot mount unknown horse", () => {
    expect(hs.mountHorse("ghost")).toBe(false);
  });

  it("can mount owned horse and fires onMount with speed multiplier", () => {
    hs.grantHorse("llamrei");
    let mountedId: string | null = null;
    let receivedSpeed = 0;
    hs.onMount = (h, speed) => { mountedId = h.id; receivedSpeed = speed; };

    expect(hs.mountHorse("llamrei")).toBe(true);
    expect(hs.isMounted).toBe(true);
    expect(hs.currentHorse?.id).toBe("llamrei");
    expect(mountedId).toBe("llamrei");
    expect(receivedSpeed).toBe(2.5);
  });

  it("cannot mount while already mounted", () => {
    hs.grantHorse("llamrei");
    hs.grantHorse("frost");
    hs.mountHorse("llamrei");
    expect(hs.mountHorse("frost")).toBe(false);
  });

  it("can dismount and fires onDismount", () => {
    hs.grantHorse("llamrei");
    hs.mountHorse("llamrei");
    let dismountedId: string | null = null;
    hs.onDismount = (h) => { dismountedId = h.id; };

    expect(hs.dismountHorse()).toBe(true);
    expect(hs.isMounted).toBe(false);
    expect(hs.currentHorse).toBeNull();
    expect(dismountedId).toBe("llamrei");
  });

  it("dismount returns false when not mounted", () => {
    expect(hs.dismountHorse()).toBe(false);
  });

  // ── Saddlebag ────────────────────────────────────────────────────────────

  it("returns null saddlebag for unknown horse", () => {
    expect(hs.getSaddlebag("ghost")).toBeNull();
  });

  it("can add items to saddlebag", () => {
    expect(hs.saddlebagAddItem("llamrei", SWORD)).toBe(true);
    expect(hs.getSaddlebag("llamrei")).toHaveLength(1);
  });

  it("stacks stackable items in saddlebag", () => {
    hs.saddlebagAddItem("llamrei", POTION);
    hs.saddlebagAddItem("llamrei", { ...POTION, quantity: 3 });
    const bag = hs.getSaddlebag("llamrei")!;
    expect(bag).toHaveLength(1);
    expect(bag[0].quantity).toBe(5);
  });

  it("rejects items when saddlebag is full (capacity=5)", () => {
    for (let i = 0; i < 5; i++) {
      hs.saddlebagAddItem("llamrei", { ...SWORD, id: `item_${i}` });
    }
    expect(hs.saddlebagAddItem("llamrei", { ...SWORD, id: "overflow" })).toBe(false);
  });

  it("can remove items from saddlebag", () => {
    hs.saddlebagAddItem("llamrei", SWORD);
    expect(hs.saddlebagRemoveItem("llamrei", "iron_sword")).toBe(true);
    expect(hs.getSaddlebag("llamrei")).toHaveLength(0);
  });

  it("decrements stack quantity when removing stackable items", () => {
    hs.saddlebagAddItem("llamrei", { ...POTION, quantity: 5 });
    hs.saddlebagRemoveItem("llamrei", "health_potion", 2);
    expect(hs.getSaddlebag("llamrei")![0].quantity).toBe(3);
  });

  it("returns false when removing item not in saddlebag", () => {
    expect(hs.saddlebagRemoveItem("llamrei", "ghost_item")).toBe(false);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState captures ownership, mount state, and saddlebag", () => {
    hs.grantHorse("llamrei");
    hs.mountHorse("llamrei");
    hs.saddlebagAddItem("llamrei", SWORD);

    const state = hs.getSaveState();
    expect(state.isMounted).toBe(true);
    expect(state.currentHorseId).toBe("llamrei");
    const saved = state.horses.find(h => h.id === "llamrei")!;
    expect(saved.isOwned).toBe(true);
    expect(saved.saddlebag).toHaveLength(1);
  });

  it("restoreFromSave restores ownership and saddlebag items", () => {
    hs.grantHorse("frost");
    hs.saddlebagAddItem("frost", POTION);
    const state = hs.getSaveState();

    const hs2 = new HorseSystem();
    hs2.registerHorse({ id: "llamrei", name: "Llamrei", speed: 2.5, saddlebagCapacity: 5 });
    hs2.registerHorse({ id: "frost", name: "Frost", speed: 2.0 });

    hs2.restoreFromSave(state);
    expect(hs2.getHorse("frost")!.isOwned).toBe(true);
    expect(hs2.getSaddlebag("frost")).toHaveLength(1);
  });

  it("restoreFromSave with isMounted=true fires onMount and sets currentHorse", () => {
    hs.grantHorse("llamrei");
    hs.mountHorse("llamrei");
    const state = hs.getSaveState();

    const hs2 = new HorseSystem();
    hs2.registerHorse({ id: "llamrei", name: "Llamrei", speed: 2.5, saddlebagCapacity: 5 });
    hs2.registerHorse({ id: "frost", name: "Frost", speed: 2.0 });

    let mounted = false;
    hs2.onMount = () => { mounted = true; };
    hs2.restoreFromSave(state);

    expect(hs2.isMounted).toBe(true);
    expect(hs2.currentHorse?.id).toBe("llamrei");
    expect(mounted).toBe(true);
  });

  it("restoreFromSave handles dismounted state", () => {
    hs.grantHorse("llamrei");
    const state = hs.getSaveState();

    const hs2 = new HorseSystem();
    hs2.registerHorse({ id: "llamrei", name: "Llamrei", speed: 2.5, saddlebagCapacity: 5 });
    hs2.registerHorse({ id: "frost", name: "Frost", speed: 2.0 });
    hs2.restoreFromSave(state);

    expect(hs2.isMounted).toBe(false);
    expect(hs2.currentHorse).toBeNull();
  });

  it("getSaveState round-trips correctly", () => {
    hs.grantHorse("llamrei");
    hs.saddlebagAddItem("llamrei", { ...SWORD });
    const state = hs.getSaveState();

    const hs2 = new HorseSystem();
    hs2.registerHorse({ id: "llamrei", name: "Llamrei", speed: 2.5, saddlebagCapacity: 5 });
    hs2.registerHorse({ id: "frost", name: "Frost", speed: 2.0 });
    hs2.restoreFromSave(state);

    const state2 = hs2.getSaveState();
    expect(state2.horses.find(h => h.id === "llamrei")?.isOwned).toBe(true);
    expect(state2.horses.find(h => h.id === "llamrei")?.saddlebag).toHaveLength(1);
  });

  it("getStableNPC returns the registered NPC", () => {
    const stable = hs.getStableNPC("Old Hob");
    expect(stable).not.toBeNull();
    expect(stable!.npcName).toBe("Old Hob");
    expect(stable!.availableHorseIds).toContain("llamrei");
  });

  it("getStableNPC returns null for unknown NPC", () => {
    expect(hs.getStableNPC("unknown_npc")).toBeNull();
  });
});
