import { describe, it, expect, vi } from "vitest";

import { Kernel } from "../../core/kernel";
import { FeedbackKey, GameplayKey, ModalKey, PlayerKey, SkillsKey } from "../services";
import { CraftingFeature, CraftingKey, type CraftingDeps } from "./crafting-feature";
import type { Item } from "../../systems/inventory-system";

function setup() {
  const k = new Kernel();
  const notes: string[] = [];
  const xp: Array<[string, number]> = [];
  let canAct = true;
  let at = { x: 0, z: 0 };
  const items: Item[] = [];
  const deps = {
    player: { carryWeight: 0, gearDamagePenalty: 0, gearArmorPenalty: 0, maxCarryWeight: 300, health: 50, maxHealth: 100 },
    ui: { showNotification: vi.fn() },
    inventory: {
      items,
      get totalWeight() { return items.reduce((n, i) => n + (i.weight ?? 0) * i.quantity, 0); },
      addItem: (i: Item) => { items.push(i); return true; },
      removeQuantity: () => true,
      removeItem: () => true,
    },
    equipment: { getEquipped: () => new Map(), isEquipped: () => false },
  } as unknown as CraftingDeps;
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  k.services.provide(GameplayKey, { canAct: () => canAct });
  k.services.provide(PlayerKey, { position: () => at, level: () => 1 });
  k.services.provide(SkillsKey, { level: () => 20, gainXP: (id, n) => { xp.push([id, n]); } });
  const feature = new CraftingFeature(deps);
  k.install(feature);
  return {
    k, feature, notes, xp, modal, items, c: k.services.get(CraftingKey),
    block: () => { canAct = false; }, moveTo: (x: number, z: number) => { at = { x, z }; },
  };
}

/** Let the windows (loaded on first use) finish loading, and whatever opened open. */
const loaded = (t: { c: { alchemyPanel: { get(): Promise<unknown> }; enchantingPanel: { get(): Promise<unknown> }; forgePanel: { get(): Promise<unknown> } } }) =>
  Promise.all([t.c.alchemyPanel.get(), t.c.enchantingPanel.get(), t.c.forgePanel.get()]).then(() => new Promise((r) => setTimeout(r, 0)));

describe("CraftingFeature (headless, through the kernel)", () => {
  it("starts the player with a forge kit, ingredients and soul gems", () => {
    const t = setup();
    expect(t.items.map((i) => i.id)).toEqual(["iron_ingot", "leather_strips", "repair_hammer"]);
    expect(t.c.alchemy.getIngredientCount("plantain_leaves")).toBe(5);
    expect(t.c.enchanting.getSaveState().soulGems).toBeDefined();
    t.k.uninstall("crafting");
  });

  it("Shift+B away from a forge is field smithing; by one, the forge", async () => {
    const t = setup();
    t.c.toggleSmithing();
    await loaded(t);
    expect(t.c.forgePanel.isVisible).toBe(true);
    expect(t.notes.at(-1)).toMatch(/No forge nearby/);
    t.c.toggleSmithing();
    expect(t.c.forgePanel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalled();

    t.c.forges.add("forge_a", 10, 10, "0,0");
    t.moveTo(10.5, 10);
    const before = t.notes.length;
    t.c.toggleSmithing();
    await loaded(t);
    expect(t.notes.length, "no field-smithing warning at a forge").toBe(before);
    t.c.toggleSmithing();

    // Leaving the area takes its forges with it.
    t.k.events.emit("chunk:unloaded", { chunkKey: "0,0" });
    expect(t.c.forges.size).toBe(0);
    t.k.uninstall("crafting");
  });

  it("a smith's \"use the forge\" opens it after the conversation", async () => {
    const t = setup();
    t.k.events.emit("dialogue:action", { eventId: "smithing:open", npcName: "Smith" });
    expect(t.c.forgePanel.isVisible).toBe(false);
    t.k.events.emit("dialogue:closed", {});
    await loaded(t);
    expect(t.c.forgePanel.isVisible).toBe(true);
    // Only once.
    t.c.forgePanel.close();
    t.k.events.emit("dialogue:closed", {});
    await loaded(t);
    expect(t.c.forgePanel.isVisible).toBe(false);
    t.k.uninstall("crafting");
  });

  it("L and B toggle their panels (loaded on first use); blocked gameplay opens nothing", async () => {
    const t = setup();
    expect(t.c.alchemyPanel.current, "not loaded at start").toBeNull();
    t.c.toggleAlchemy();
    await loaded(t);
    expect(t.c.alchemyPanel.isVisible).toBe(true);
    t.c.toggleAlchemy();
    expect(t.c.alchemyPanel.isVisible).toBe(false);
    t.c.toggleEnchanting();
    await loaded(t);
    expect(t.c.enchantingPanel.isVisible).toBe(true);
    t.c.toggleEnchanting();
    t.block();
    t.c.toggleAlchemy();
    t.c.toggleEnchanting();
    t.c.toggleSmithing();
    await loaded(t);
    expect([t.c.alchemyPanel.isVisible, t.c.enchantingPanel.isVisible, t.c.forgePanel.isVisible]).toEqual([false, false, false]);
    t.k.uninstall("crafting");
  });

  it("brewing a potion trains Alchemy through the skills service", () => {
    const t = setup();
    t.c.alchemy.onPotionCrafted!({} as never);
    expect(t.xp).toEqual([["alchemy", 15]]);
    t.k.uninstall("crafting");
  });
});

describe("CraftingFeature: gear wear from the combat reports", () => {
  it("wears the weapon on a hit, armour on a blow, the shield on a block", () => {
    const { k, feature } = setup();
    const hit = vi.spyOn(feature.smithing, "onWeaponHit");
    const struck = vi.spyOn(feature.smithing, "onPlayerStruck");
    const block = vi.spyOn(feature.smithing, "onBlock");
    k.events.emit("combat:weaponHit", { powerAttack: true });
    k.events.emit("combat:playerStruck", {});
    k.events.emit("projectile:playerHit", { damage: 3, sourceName: "Bandit", statusEffect: null });
    k.events.emit("combat:blocked", {});
    expect(hit).toHaveBeenCalledWith(true);
    expect(struck).toHaveBeenCalledTimes(2);
    expect(block).toHaveBeenCalledOnce();
  });
});
