import { describe, it, expect, vi } from "vitest";
import { GameEventBus } from "./event-bus";
import type { Item } from "./inventory-system";

const DUMMY_ITEM: Item = {
  id: "iron_sword",
  name: "Iron Sword",
  description: "",
  stackable: false,
  quantity: 1,
  weight: 3,
};

describe("GameEventBus", () => {
  it("delivers events to registered listeners", () => {
    const bus = new GameEventBus();
    const cb = vi.fn();
    bus.on("player:kill", cb);
    bus.emit("player:kill", { npcId: "npc_01", npcName: "Bandit", xp: 50 });
    expect(cb).toHaveBeenCalledWith({ npcId: "npc_01", npcName: "Bandit", xp: 50 });
  });

  it("delivers to multiple listeners for the same event", () => {
    const bus = new GameEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("player:levelUp", a);
    bus.on("player:levelUp", b);
    bus.emit("player:levelUp", { newLevel: 2 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("does not deliver to listeners for a different event", () => {
    const bus = new GameEventBus();
    const cb = vi.fn();
    bus.on("player:kill", cb);
    bus.emit("player:levelUp", { newLevel: 3 });
    expect(cb).not.toHaveBeenCalled();
  });

  it("off() unregisters a listener", () => {
    const bus = new GameEventBus();
    const cb = vi.fn();
    bus.on("quest:activated", cb);
    bus.off("quest:activated", cb);
    bus.emit("quest:activated", { questId: "q1" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("once() fires exactly once then auto-removes", () => {
    const bus = new GameEventBus();
    const cb = vi.fn();
    bus.once("quest:completed", cb);
    bus.emit("quest:completed", { questId: "q2", xpReward: 100 });
    bus.emit("quest:completed", { questId: "q2", xpReward: 100 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("emit with no listeners does not throw", () => {
    const bus = new GameEventBus();
    expect(() => bus.emit("player:died", {})).not.toThrow();
  });

  it("clearEvent removes all listeners for that event", () => {
    const bus = new GameEventBus();
    const cb = vi.fn();
    bus.on("cell:changed", cb);
    bus.clearEvent("cell:changed");
    bus.emit("cell:changed", { cellId: "c1", cellName: "Cave" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("clearAll removes every listener", () => {
    const bus = new GameEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("player:kill", a);
    bus.on("player:levelUp", b);
    bus.clearAll();
    bus.emit("player:kill", { npcId: "x", npcName: "X", xp: 0 });
    bus.emit("player:levelUp", { newLevel: 5 });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("listenerCount reflects registered callbacks", () => {
    const bus = new GameEventBus();
    expect(bus.listenerCount("npc:aggro")).toBe(0);
    const cb = vi.fn();
    bus.on("npc:aggro", cb);
    expect(bus.listenerCount("npc:aggro")).toBe(1);
    bus.off("npc:aggro", cb);
    expect(bus.listenerCount("npc:aggro")).toBe(0);
  });

  it("listener can safely remove itself during emit", () => {
    const bus = new GameEventBus();
    const cb = vi.fn(() => bus.off("stealth:detected", cb));
    bus.on("stealth:detected", cb);
    expect(() => bus.emit("stealth:detected", { npcName: "Guard" })).not.toThrow();
    expect(cb).toHaveBeenCalledTimes(1);
    bus.emit("stealth:detected", { npcName: "Guard" });
    expect(cb).toHaveBeenCalledTimes(1); // not called again
  });

  it("inventory:changed event carries item payload", () => {
    const bus = new GameEventBus();
    const cb = vi.fn();
    bus.on("inventory:changed", cb);
    bus.emit("inventory:changed", { item: DUMMY_ITEM, delta: 1 });
    expect(cb).toHaveBeenCalledWith({ item: DUMMY_ITEM, delta: 1 });
  });
});
