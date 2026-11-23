import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import type { NPC } from "../../entities/npc";
import { FeedbackKey, ModalKey, SkillsKey } from "../services";
import { PickpocketFeature, PickpocketKey, ThiefHostKey, COIN_PURSE } from "./pickpocket-feature";

function setup(opts: { crouching?: boolean; noticed?: boolean; sneak?: number } = {}) {
  const k = new Kernel();
  const notes: string[] = [];
  const got: string[] = [];
  const reported: string[] = [];
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  const f = new PickpocketFeature((id) => (id === "iron_dagger" ? "Iron Dagger" : undefined));
  const mark = { key: "Farmer Tom", displayName: "Farmer Tom", mesh: { name: "Farmer Tom" }, startingEquipmentIds: ["iron_dagger"], isAggressive: false } as unknown as NPC;
  f.registerNpc(mark); // before install, as the game does
  k.services.provide(ThiefHostKey, {
    crouching: () => opts.crouching ?? true,
    noticed: () => opts.noticed ?? false,
    reportTheft: (id) => { reported.push(id); },
    receive: (id) => { got.push(id); },
  });
  k.services.provide(SkillsKey, { level: () => opts.sneak ?? 100, gainXP: vi.fn() });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  const opened: string[] = [];
  k.events.on("pickpocket:opened", ({ npcName }) => opened.push(npcName));
  k.install(f);
  return { k, f, notes, got, reported, modal, opened, mark, svc: k.services.get(PickpocketKey) };
}

describe("PickpocketFeature (headless, through the kernel)", () => {
  it("a peaceful mark carries their gear and a coin purse", () => {
    const t = setup();
    expect(t.f.system.getNpcInventory("Farmer Tom")!.map((i) => i.name)).toEqual(["Iron Dagger", "Coin Purse"]);
    t.k.uninstall("pickpocket");
  });

  it("opening the picker suspends play and tells the tutorial", () => {
    const t = setup();
    t.svc.open(t.mark);
    expect(t.svc.panel.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
    expect(t.opened).toEqual(["Farmer Tom"]);
    t.svc.close();
    expect(t.svc.panel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
    t.k.uninstall("pickpocket");
  });

  it("standing up mid-steal: told why, nothing taken", () => {
    const t = setup({ crouching: false });
    t.svc.open(t.mark);
    t.svc.panel.onStealItem!(COIN_PURSE);
    expect(t.notes.at(-1)).toBe("You must stay crouched to pickpocket.");
    expect(t.got).toEqual([]);
    t.k.uninstall("pickpocket");
  });

  it("a master thief empties the mark, and the picker closes", () => {
    const t = setup({ sneak: 100 });
    t.svc.open(t.mark);
    for (let i = 0; i < 40 && t.svc.panel.isVisible; i++) {
      const next = t.f.system.getNpcInventory("Farmer Tom")?.[0];
      if (!next) break;
      t.svc.panel.onStealItem!(next.id);
    }
    // Every lift either landed or got the thief caught.
    expect(t.got.length + t.reported.length).toBeGreaterThan(0);
    if (t.reported.length === 0) {
      expect(t.got.sort()).toEqual([COIN_PURSE, "iron_dagger"].sort());
      expect(t.svc.panel.isVisible).toBe(false);
    }
    t.k.uninstall("pickpocket");
  });
});
