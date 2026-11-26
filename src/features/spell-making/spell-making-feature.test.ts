import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import type { SpellSystem } from "../../systems/spell-system";
import type { SpellComponent } from "../../systems/spell-making-system";
import { FeedbackKey, GameplayKey, ModalKey, PurseKey, SkillsKey } from "../services";
import { SpellMakingFeature, SpellMakingKey } from "./spell-making-feature";

function setup(gold: number) {
  const k = new Kernel();
  const notes: string[] = [];
  let purse = gold;
  const learned: string[] = [];
  const spells = { registerSpell: (sp: { name: string }) => { learned.push(sp.name); }, learnSpell: vi.fn(), knownSpells: [] } as unknown as SpellSystem;
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(PurseKey, { gold: () => purse, spend: (n) => { if (purse < n) return false; purse -= n; return true; } });
  k.services.provide(SkillsKey, { level: () => 10, gainXP: vi.fn() });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  k.services.provide(GameplayKey, { canAct: () => true });
  const f = new SpellMakingFeature(spells);
  k.install(f);
  return { k, f, notes, modal, learned, svc: k.services.get(SpellMakingKey), gold: () => purse };
}

const fire: SpellComponent = { effectType: "damage", school: "destruction", magnitude: 10, duration: 0, damageType: "fire" };

describe("SpellMakingFeature (headless, through the kernel)", () => {
  it("X opens the altar (loading it); forging a spell costs its gold", async () => {
    const t = setup(1000);
    expect(t.svc.panel.current, "not loaded at start").toBeNull();
    t.svc.toggle();
    const panel = await t.svc.panel.get();
    await new Promise((r) => setTimeout(r, 0));
    expect(t.svc.panel.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
    const cost = t.f.altar.computeCost([fire]);
    panel.onForge!({ name: "Ember", components: [fire] });
    expect(t.gold()).toBe(1000 - cost);
    expect(t.notes.at(-1)).toMatch(/Spell forged: "Ember"/);
    t.svc.toggle();
    expect(t.svc.panel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalled();
  });

  it("too poor: nothing forged, no gold taken", async () => {
    const t = setup(0);
    t.svc.toggle();
    (await t.svc.panel.get()).onForge!({ name: "Ember", components: [fire] });
    expect(t.gold()).toBe(0);
    expect(t.f.altar.customSpells).toHaveLength(0);
  });
});
