import { describe, it, expect, vi } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import { FastTravelKey, FeedbackKey, GameplayKey, ModalKey } from "../services";
import { FastTravelFeature, TravelKey, TravelHostKey, RECALL_ID, type TravelHostService } from "./fast-travel-feature";

function setup(over: Partial<TravelHostService> = {}) {
  const k = new Kernel();
  const notes: string[] = [];
  let at = new Vector3(0, 2, 0);
  let indoors = false;
  const hours: number[] = [];
  const host: TravelHostService = {
    position: () => at,
    teleport: (to) => { at = to.clone(); },
    inCombat: () => false,
    sneaking: () => false,
    encumbered: () => false,
    isInterior: (id) => id === "cave_01",
    indoors: () => indoors,
    enterCell: (id, to) => { indoors = id !== "exterior"; at = to.clone(); },
    fade: (onBlack, onDone) => { onBlack(); onDone(); },
    passHours: (h) => { hours.push(h); return "10:00"; },
    arrivalEvent: () => "Mist rolls in.",
    hasMark: () => false,
    markCell: () => null,
    recall: () => false,
    ...over,
  };
  k.services.provide(TravelHostKey, host);
  k.services.provide(GameplayKey, { canAct: () => true });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() });
  const f = new FastTravelFeature();
  k.install(f);
  const places = k.services.get(FastTravelKey);
  return { k, f, notes, hours, places, svc: k.services.get(TravelKey), at: () => at, indoors: () => indoors };
}

describe("FastTravelFeature (headless, through the kernel)", () => {
  it("travels to a known place: time passes and you arrive", () => {
    const t = setup();
    t.places.discover("mill", "Old Mill", new Vector3(400, 2, 0));
    t.svc.travel("mill");
    expect(t.at().x).toBe(400);
    expect(t.hours).toHaveLength(1);
    expect(t.notes.some((n) => n.startsWith("Fast travelled to Old Mill."))).toBe(true);
    t.k.uninstall("fast-travel");
  });

  it("leaving an interior for the open world doesn't make the open world a destination", () => {
    const t = setup();
    t.places.discover("cave_01", "Old Cave", new Vector3(-8, 2, 8));
    t.places.discover("mill", "Old Mill", new Vector3(400, 2, 0));
    t.svc.travel("cave_01");
    expect(t.indoors()).toBe(true);
    t.svc.travel("mill");
    expect(t.indoors()).toBe(false);
    expect(t.f.places.discoveredLocations.map((l) => l.id).sort()).toEqual(["cave_01", "mill", "start_village"]);
    t.k.uninstall("fast-travel");
  });

  it("refuses in combat, sneaking or overloaded", () => {
    for (const [over, msg] of [
      [{ inCombat: () => true }, /combat/],
      [{ sneaking: () => true }, /sneaking/],
      [{ encumbered: () => true }, /overencumbered/],
    ] as const) {
      const t = setup(over);
      t.places.discover("mill", "Old Mill", new Vector3(400, 2, 0));
      t.svc.travel("mill");
      expect(t.at().x).toBe(0);
      expect(t.notes.at(-1)).toMatch(msg);
      t.k.uninstall("fast-travel");
    }
  });

  it("the menu lists the Recall row when there is a mark", () => {
    const recall = vi.fn(() => true);
    const t = setup({ hasMark: () => true, recall });
    t.svc.toggleMenu();
    expect(t.svc.menu.isVisible).toBe(true);
    t.svc.travel(RECALL_ID);
    expect(recall).toHaveBeenCalledOnce();
    expect(t.svc.menu.isVisible).toBe(false);
    t.k.uninstall("fast-travel");
  });

  it("recalling to a mark in a cave from the open world (and back out) changes cell first", () => {
    const recall = vi.fn(() => true);
    let cell: string | null = "cave_01";
    const t = setup({ hasMark: () => true, markCell: () => cell, recall });
    t.svc.travel(RECALL_ID);
    expect(t.indoors(), "in the cave").toBe(true);
    expect(recall).toHaveBeenCalledOnce();
    cell = null;
    t.svc.travel(RECALL_ID);
    expect(t.indoors(), "back out in the open").toBe(false);
    expect(recall).toHaveBeenCalledTimes(2);
    t.k.uninstall("fast-travel");
  });

  it("no mark: says so", () => {
    const t = setup();
    t.svc.travel(RECALL_ID);
    expect(t.notes.at(-1)).toMatch(/No mark/);
    t.k.uninstall("fast-travel");
  });

  it("arrival events roll on the seeded stream: the same seed, the same events", () => {
    const run = () => {
      const t = setup();
      t.places.discover("mill", "Old Mill", new Vector3(400, 2, 0));
      for (let i = 0; i < 20; i++) t.svc.travel(i % 2 ? "mill" : "start_village");
      return t.notes.filter((n) => n.startsWith("🌫")).length;
    };
    const a = run();
    expect(a).toBeGreaterThan(0);
    expect(run()).toBe(a);
  });
});
