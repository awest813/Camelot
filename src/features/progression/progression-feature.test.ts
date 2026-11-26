import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { AttributeSystem } from "../../systems/attribute-system";
import { ClassSystem } from "../../systems/class-system";
import { SkillProgressionSystem } from "../../systems/skill-progression-system";
import type { PerkSystem } from "../../systems/perk-system";
import { FeedbackKey, GameplayKey, ModalKey } from "../services";
import { ProgressionFeature, ProgressionHostKey, ProgressionKey } from "./progression-feature";

function setup() {
  const k = new Kernel();
  const notes: string[] = [];
  const attributes = new AttributeSystem();
  const classes = new ClassSystem();
  classes.chooseClass("warrior", attributes, new SkillProgressionSystem());
  let points = 0;
  const perks = { addPerkPoints: (n: number) => { points += n; }, get perkPoints() { return points; }, getAllPerks: () => [], unlock: () => false } as unknown as PerkSystem;
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  const reached: number[] = [];
  k.services.provide(ProgressionHostKey, {
    attributes, classes, perks: () => perks, syncMaxStats: vi.fn(), levelReached: (l) => reached.push(l),
    offerAttributes: vi.fn(), sheet: () => ({ name: "Gawain" }) as never, setSheetOpen: vi.fn(),
  });
  k.services.provide(ModalKey, modal);
  let free = true;
  k.services.provide(GameplayKey, { canAct: () => free });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  const f = new ProgressionFeature();
  k.install(f);
  const levels: number[] = [];
  k.events.on("player:levelUp", ({ newLevel }) => levels.push(newLevel));
  return { k, f, notes, modal, reached, levels, classes, points: () => points, svc: k.services.get(ProgressionKey), busy: (b: boolean) => { free = !b; } };
}

describe("ProgressionFeature (headless, through the kernel)", () => {
  it("a level-up earned inside a menu waits until the menu closes (never stacks on it)", () => {
    const t = setup();
    t.busy(true); // e.g. the alchemy panel is open
    const major = t.classes.chosenClass!.majorSkills[0];
    for (let i = 0; i < 10; i++) t.svc.skillRaised(major);
    t.k.phases.run("ui", 1 / 60);
    expect(t.svc.levelUp.isVisible).toBe(false);
    expect(t.modal.suspendGameplay).not.toHaveBeenCalled();
    t.busy(false);
    t.k.phases.run("ui", 1 / 60);
    expect(t.svc.levelUp.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
  });

  it("ten major-skill raises open the level-up; confirming it levels up (no soft-lock)", () => {
    const t = setup();
    const major = t.classes.chosenClass!.majorSkills[0];
    for (let i = 0; i < 10; i++) t.svc.skillRaised(major);
    t.k.phases.run("ui", 1 / 60);
    expect(t.svc.levelUp.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();

    // The dialog's confirm reaches the level system and gives play back.
    t.svc.levelUp.onConfirm!("strength", "endurance", "agility");
    expect(t.f.levels.characterLevel).toBe(2);
    expect(t.levels).toEqual([2]);
    expect(t.reached).toEqual([2]);
    expect(t.points()).toBe(1);
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
    expect(t.notes).toContain("Character Level 2!");
  });

  it("Tab opens the character sheet with the level, and closes it", () => {
    const t = setup();
    t.svc.toggleSheet();
    expect(t.svc.sheet.isVisible).toBe(true);
    t.svc.toggleSheet();
    expect(t.svc.sheet.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
  });
});
