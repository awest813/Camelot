import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { AttributeSystem } from "../../systems/attribute-system";
import { SkillProgressionSystem } from "../../systems/skill-progression-system";
import { ClockKey, FeedbackKey } from "../services";
import { CharacterFeature, CharacterHostKey, CharacterKey, type CharacterChoice, type CharacterHostService } from "./character-feature";

function setup(answer: () => Promise<CharacterChoice>) {
  const k = new Kernel();
  const notes: string[] = [];
  const calls: string[] = [];
  const host: CharacterHostService = {
    attributes: new AttributeSystem(),
    skills: new SkillProgressionSystem(),
    syncMaxStats: () => calls.push("sync"),
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
  it("a loaded Fen-folk hero breathes water and shrugs off disease again", () => {
    const t = setup(async () => choice);
    t.f.races.restoreFromSave({ chosenId: "fenfolk" } as never);
    t.k.events.emit("save:loaded", {});
    expect(t.calls).toContain("traits:true:true");
    t.k.uninstall("character");
  });

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

  it("if the wizard fails, a Hill-folk warrior, and the screen is handed back", async () => {
    const t = setup(async () => { throw new Error("no DOM"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await t.svc.create();
    expect(t.f.races.chosenRace?.id).toBe("hillfolk");
    expect(t.f.classes.chosenClass?.id).toBe("warrior");
    expect(t.calls.slice(-2)).toEqual(["end", "welcome:null"]);
  });

  it("the HUD shows both daily powers, and when each is ready again", async () => {
    const t = setup(async () => ({ ...choice, birthsignId: "grail" }));
    let hours = 10;
    t.k.services.provide(ClockKey, { hour: () => hours % 24, elapsedHours: () => hours });
    await t.svc.create();
    t.k.phases.run("ui", 1);
    const chip = () => document.querySelector(".powers-hud")?.textContent;
    expect(chip()).toBe("VMarsh-mendingREADYShift+VGrail's GraceREADY");
    t.f.birthsigns.activatePower(hours * 60);
    hours += 2;
    t.k.phases.run("ui", 1);
    expect(chip()).toBe("VMarsh-mendingREADYShift+VGrail's Grace22h 00m");
    t.k.uninstall("character");
    expect(document.querySelector(".powers-hud"), "the feature takes its chip away").toBeNull();
  });

  it("catching or curing a disease brings the maxima up to date", () => {
    const t = setup(async () => choice);
    t.calls.length = 0;
    t.k.events.emit("disease:contracted", { diseaseId: "flux" });
    t.k.events.emit("disease:cured", { diseaseId: "flux" });
    expect(t.calls).toEqual(["sync", "sync"]);
  });
});
