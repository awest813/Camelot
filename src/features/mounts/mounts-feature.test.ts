import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, ModalKey, PurseKey } from "../services";
import { MountsFeature, MountsKey, MountHostKey } from "./mounts-feature";
import type { Item } from "../../systems/inventory-system";

function setup(opts: { gold?: number } = {}) {
  const k = new Kernel();
  let gold = opts.gold ?? 2000;
  let speed = 1;
  let canAct = true;
  const notes: string[] = [];
  const given: Item[] = [];
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  k.services.provide(PurseKey, {
    gold: () => gold,
    spend: (n) => { if (gold < n) return false; gold -= n; return true; },
  });
  k.services.provide(MountHostKey, {
    canAct: () => canAct,
    setMoveSpeedMultiplier: (m) => { speed = m; },
    unlockAchievement: vi.fn(),
    give: (item) => { given.push(item); },
  });
  const feature = new MountsFeature();
  k.install(feature);
  return {
    k, feature, notes, given, modal, mounts: k.services.get(MountsKey),
    gold: () => gold, speed: () => speed, block: () => { canAct = false; },
  };
}

describe("MountsFeature (headless, through the kernel)", () => {
  it("buy a horse at the stable, ride it, and use the saddlebag", async () => {
    const t = setup({ gold: 800 });
    t.mounts.toggleMount();
    expect(t.notes.at(-1)).toMatch(/don't own a horse/);

    // Shift+O on foot: the stable.
    t.mounts.toggleStableOrSaddlebag();
    const stable = await t.mounts.stable.get(); // loaded on first use
    expect(t.mounts.stable.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
    stable.onPurchase!("bay_mare");
    expect(t.gold()).toBe(300);
    expect(t.mounts.horses.ownedHorses.map((h) => h.id)).toEqual(["bay_mare"]);
    t.mounts.stable.close();

    // O: ride.
    t.mounts.toggleMount();
    expect(t.mounts.horses.isMounted).toBe(true);
    expect(t.speed()).toBe(1.8);

    // Shift+O mounted: the saddlebag; take an item out.
    const horse = t.mounts.horses.currentHorse!;
    t.mounts.horses.saddlebagAddItem(horse.id, { id: "iron_ingot", name: "Iron Ingot", description: "", stackable: true, quantity: 2, weight: 1 });
    t.mounts.toggleStableOrSaddlebag();
    const saddlebag = await t.mounts.saddlebag.get();
    expect(t.mounts.saddlebag.isVisible).toBe(true);
    saddlebag.onRemoveItem!("iron_ingot");
    expect(t.given[0]).toMatchObject({ id: "iron_ingot", quantity: 1 });

    t.mounts.toggleMount();
    expect(t.mounts.horses.isMounted).toBe(false);
    expect(t.speed()).toBe(1);
    t.k.uninstall("mounts");
  });

  it("does nothing while gameplay is blocked (paused, in a conversation)", () => {
    const t = setup();
    t.block();
    t.mounts.toggleMount();
    t.mounts.toggleStableOrSaddlebag();
    expect(t.notes).toEqual([]);
    expect(t.mounts.stable.isVisible).toBe(false);
    t.k.uninstall("mounts");
  });
});
