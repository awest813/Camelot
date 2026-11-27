import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { AttributeSystem } from "../../systems/attribute-system";
import { SkillProgressionSystem } from "../../systems/skill-progression-system";
import { FeedbackKey } from "../services";
import { CharacterFeature, CharacterHostKey, CharacterKey, type CharacterChoice, type CharacterHostService } from "./character-feature";

function setup(answer: () => Promise<CharacterChoice>) {
  const k = new Kernel();
  const notes: string[] = [];
  const calls: string[] = [];
  const host: CharacterHostService = {
    attributes: new AttributeSystem(),
    skills: new SkillProgressionSystem(),
    syncMaxStats: () => calls.push("sync"),
    addMaxStats: () => calls.push("bonus"),
    setRacialTraits: (t) => calls.push(`traits:${t.waterBreathing}:${t.diseaseImmune}`),
    beginCreation: () => calls.push("begin"),
    endCreation: () => calls.push("end"),
    ask: answer,
    becomeHero: (name) => calls.push(`hero:${name}`),
    seedWorld: () => calls.push("seed"),
    welcome: (skip) => calls.push(`welcome:${skip}`),
  };
  k.services.provide(CharacterHostKey, host);
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  const f = new CharacterFeature();
  k.install(f);
  return { k, f, notes, calls, svc: k.services.get(CharacterKey) };
}

const choice: CharacterChoice = { name: "Gawain", raceId: "fenfolk", birthsignId: "lady_lake", classId: "wardruid", skipGameplayTips: true, worldSeed: null };

describe("CharacterFeature (headless, through the kernel)", () => {
  it("the wizard's choices make the hero", async () => {
    const t = setup(async () => choice);
    const run = t.svc.create();
    expect(t.svc.creating).toBe(true);
    await run;
    expect(t.svc.creating).toBe(false);
    expect(t.f.races.chosenRace?.id).toBe("fenfolk");
    expect(t.calls).toContain("traits:true:true");
    expect(t.calls.slice(-3)).toEqual(["hero:Gawain", "end", "welcome:true"]);
    expect(t.notes.at(-1)).toBe("Welcome, Gawain! Character creation complete.");
  });

  it("if the wizard fails, a Nord warrior, and the screen is handed back", async () => {
    const t = setup(async () => { throw new Error("no DOM"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await t.svc.create();
    expect(t.f.races.chosenRace?.id).toBe("hillfolk");
    expect(t.f.classes.chosenClass?.id).toBe("warrior");
    expect(t.calls.slice(-2)).toEqual(["end", "welcome:null"]);
  });
});
