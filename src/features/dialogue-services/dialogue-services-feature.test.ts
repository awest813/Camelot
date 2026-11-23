import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import type { TrainerSystem } from "../../systems/trainer-system";
import { FeedbackKey, PurseKey, SkillsKey } from "../services";
import { DialogueServicesFeature, DialogueHostKey } from "./dialogue-services-feature";

function setup(opts: { trainOk?: boolean; reason?: string; restOk?: boolean } = {}) {
  const k = new Kernel();
  const notes: string[] = [];
  const xp: number[] = [];
  const trainers = {
    getTrainer: (id: string) => (id === "t_blade" ? { skillId: "blade" } : undefined),
    train: vi.fn(() => (opts.trainOk ? { success: true } : { success: false, reason: opts.reason ?? "insufficient_gold" })),
    getCost: () => 120,
  } as unknown as TrainerSystem;
  const rest = vi.fn(() => (opts.restOk === false ? null : "It is morning."));
  k.services.provide(DialogueHostKey, { trainers, skillName: () => "Blade", restAtInn: rest });
  k.services.provide(SkillsKey, { level: () => 30, gainXP: (_s, n) => { xp.push(n); } });
  k.services.provide(PurseKey, { gold: () => 50, spend: () => true });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.install(new DialogueServicesFeature());
  const say = (eventId: string, payload?: Record<string, unknown>) => k.events.emit("dialogue:action", { eventId, npcName: "Someone", payload });
  return { k, notes, xp, trainers, rest, say };
}

describe("DialogueServicesFeature (headless, through the kernel)", () => {
  it("a trainer explains why there's no lesson", () => {
    const t = setup({ reason: "insufficient_gold" });
    t.say("trainer:train", { trainerId: "t_blade" });
    expect(t.trainers.train).toHaveBeenCalledWith("t_blade", 30, 50);
    expect(t.notes.at(-1)).toBe("You need 120 gold for the next lesson.");
    t.say("trainer:train", { trainerId: "nobody" });
    expect(t.notes.at(-1)).toBe("That trainer is not available.");
  });

  it("a night at the inn: the hours asked for (8 by default), and a little Speechcraft", () => {
    const t = setup();
    t.say("rest:inn", { hours: 6 });
    t.say("rest:inn");
    expect(t.rest.mock.calls.map((c) => (c as unknown[])[0])).toEqual([6, 8]);
    expect(t.notes.at(-1)).toBe("You slept soundly. It is morning.");
    expect(t.xp).toEqual([6, 6]);
  });

  it("other actions are not its business", () => {
    const t = setup();
    t.say("barter:open");
    expect(t.notes).toEqual([]);
  });
});
