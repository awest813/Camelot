import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, ModalKey, PurseKey, SavesKey } from "../services";
import type { SaveCodec } from "../../systems/save-system";
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
  const codecs = new Map<string, SaveCodec>();
  k.services.provide(SavesKey, { register: (c) => { codecs.set(c.key, c); return () => codecs.delete(c.key); } });
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
    k, feature, notes, given, modal, codecs, mounts: k.services.get(MountsKey),
    gold: () => gold, speed: () => speed, block: () => { canAct = false; },
  };
}

describe("MountsFeature (headless, through the kernel)", () => {
  it("buy a horse at the stable, ride it, and use the saddlebag", async () => {
    const t = setup({ gold: 800 });
    t.mounts.toggleMount();
    expect(t.notes.at(-1)).toMatch(/don't own a horse/);

    // Shift+O on foot says where horses are sold; the ostler opens the stable.
    t.mounts.toggleStableOrSaddlebag();
    expect(t.notes.at(-1)).toMatch(/ostler/);
    expect(t.mounts.stable.isVisible).toBe(false);
    t.k.events.emit("dialogue:action", { eventId: "stable:open", npcName: "Ostler" });
    t.k.events.emit("dialogue:closed", {} as never);
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

  it("loading a save puts the speed back: mounted in the save rides, on foot walks", () => {
    const t = setup({ gold: 800 });
    expect(t.mounts.horses.purchaseHorse("Ostler", "bay_mare", 800)).toBeGreaterThan(0);
    const codec = t.codecs.get("horse")!;
    const onFoot = JSON.parse(JSON.stringify(codec.save()));
    t.mounts.toggleMount();
    const riding = JSON.parse(JSON.stringify(codec.save()));
    expect(t.speed()).toBe(1.8);
    codec.load(onFoot);
    expect(t.mounts.horses.isMounted).toBe(false);
    expect(t.speed(), "a save made on foot walks").toBe(1);
    codec.load(riding);
    expect(t.speed(), "a save made riding rides").toBe(1.8);
    t.k.uninstall("mounts");
  });

  it("O rides the horse just bought, not always the first one owned", () => {
    const t = setup({ gold: 5000 });
    t.mounts.horses.purchaseHorse("Ostler", "bay_mare", 5000);
    t.mounts.horses.purchaseHorse("Ostler", "black_stallion", 5000);
    t.mounts.toggleMount();
    expect(t.mounts.horses.currentHorse?.id).toBe("black_stallion");
    t.k.uninstall("mounts");
  });

  it("a horse the purse can't cover says so", async () => {
    const t = setup({ gold: 100 });
    t.k.events.emit("dialogue:action", { eventId: "stable:open", npcName: "Ostler" });
    t.k.events.emit("dialogue:closed", {} as never);
    const stable = await t.mounts.stable.get();
    const status = vi.spyOn(stable, "showStatus");
    stable.onPurchase!("bay_mare");
    expect(status).toHaveBeenCalledWith("Not enough gold: this horse costs 500g.", true);
    expect(t.gold()).toBe(100);
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

describe("MountsFeature — the horse in the world", () => {
  it("riding shows its neck and head ahead of the camera; dismounting leaves it standing beside you", async () => {
    const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine");
    const { Scene } = await import("@babylonjs/core/scene");
    const { FreeCamera } = await import("@babylonjs/core/Cameras/freeCamera");
    const { Vector3 } = await import("@babylonjs/core/Maths/math.vector");
    const { PlayerKey } = await import("../services");
    const scene = new Scene(new NullEngine());
    const camera = new FreeCamera("cam", new Vector3(10, 2, 10), scene);
    scene.activeCamera = camera;
    const k = new Kernel();
    k.services.provide(FeedbackKey, { notify: vi.fn(), grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
    k.services.provide(ModalKey, { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() });
    k.services.provide(PurseKey, { gold: () => 5000, spend: () => true });
    k.services.provide(MountHostKey, { canAct: () => true, setMoveSpeedMultiplier: vi.fn(), unlockAchievement: vi.fn(), give: vi.fn() });
    k.services.provide(PlayerKey, { position: () => camera.position, level: () => 1, heading: () => 0 });
    const codecs = new Map<string, SaveCodec>();
    k.services.provide(SavesKey, { register: (c) => { codecs.set(c.key, c); return () => codecs.delete(c.key); } });
    const feature = new MountsFeature(scene);
    k.install(feature);
    feature.horses.purchaseHorse("Ostler", "black_stallion", 5000);
    feature.horses.mountHorse("black_stallion");
    const view = scene.getTransformNodeByName("rider_black_stallion");
    expect(view?.parent).toBe(camera);
    feature.horses.dismountHorse();
    expect(scene.getTransformNodeByName("rider_black_stallion")).toBeNull();
    const standing = scene.getTransformNodeByName("horse_black_stallion")!;
    expect(standing.position.x, "two paces to the right").toBeCloseTo(12);
    // Saved and loaded, it is still standing there.
    const saved = JSON.parse(JSON.stringify(codecs.get("horse")!.save()));
    codecs.get("horse")!.load({ ...saved, parked: null });
    expect(scene.getTransformNodeByName("horse_black_stallion"), "gone with a save that has none").toBeNull();
    codecs.get("horse")!.load(saved);
    expect(scene.getTransformNodeByName("horse_black_stallion")!.position.x).toBeCloseTo(12);
    k.uninstall("mounts");
    expect(scene.getTransformNodeByName("horse_black_stallion")).toBeNull();
    scene.dispose();
  });
});
