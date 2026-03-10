import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SpellMakingSystem,
  MIN_SPELL_COST,
  MAX_SPELL_COST,
  MAX_COMPONENTS,
  type SpellComponent,
} from "./spell-making-system";
import type { SpellSystem } from "./spell-system";
import type { BarterSystem } from "./barter-system";

// ── Minimal mocks ─────────────────────────────────────────────────────────────

function makeSpellSystem(): SpellSystem {
  const registered: Map<string, any> = new Map();
  const learned: Set<string> = new Set();
  return {
    registerSpell: vi.fn((def: any) => { registered.set(def.id, def); }),
    learnSpell:    vi.fn((id: string) => { learned.add(id); return true; }),
    knowsSpell:    (id: string) => learned.has(id),
    _registered:   registered,
    _learned:      learned,
  } as unknown as SpellSystem;
}

function makeBarterSystem(gold = 1000): BarterSystem {
  const system = { playerGold: gold } as unknown as BarterSystem;
  return system;
}

const FIRE_COMPONENT: SpellComponent = {
  effectType: "damage",
  school: "destruction",
  magnitude: 20,
  duration: 3,
  damageType: "fire",
};

const HEAL_COMPONENT: SpellComponent = {
  effectType: "heal",
  school: "restoration",
  magnitude: 30,
  duration: 0,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SpellMakingSystem", () => {
  let sms: SpellMakingSystem;
  let spellSystem: ReturnType<typeof makeSpellSystem>;
  let barter: BarterSystem;

  beforeEach(() => {
    spellSystem = makeSpellSystem();
    barter = makeBarterSystem(1000);
    sms = new SpellMakingSystem(spellSystem as unknown as SpellSystem);
  });

  // ── computeCost ────────────────────────────────────────────────────────────

  it("computeCost returns MIN_SPELL_COST for tiny magnitudes", () => {
    const cost = sms.computeCost([{ effectType: "damage", school: "destruction", magnitude: 1, duration: 1 }]);
    expect(cost).toBe(MIN_SPELL_COST);
  });

  it("computeCost is capped at MAX_SPELL_COST", () => {
    const cost = sms.computeCost([{ effectType: "damage", school: "destruction", magnitude: 10000, duration: 9999 }]);
    expect(cost).toBe(MAX_SPELL_COST);
  });

  it("computeCost scales with magnitude and duration", () => {
    const low  = sms.computeCost([{ effectType: "damage", school: "destruction", magnitude: 10, duration: 3 }]);
    const high = sms.computeCost([{ effectType: "damage", school: "destruction", magnitude: 50, duration: 10 }]);
    expect(high).toBeGreaterThan(low);
  });

  it("computeCost returns 0 for empty components", () => {
    expect(sms.computeCost([])).toBe(0);
  });

  // ── forgeSpell validation ──────────────────────────────────────────────────

  it("rejects empty name", () => {
    const result = sms.forgeSpell("", [FIRE_COMPONENT], barter);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_name");
  });

  it("rejects whitespace-only name", () => {
    const result = sms.forgeSpell("   ", [FIRE_COMPONENT], barter);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_name");
  });

  it("rejects no components", () => {
    const result = sms.forgeSpell("Empty", [], barter);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_components");
  });

  it("rejects too many components", () => {
    const extra: SpellComponent[] = Array(MAX_COMPONENTS + 1).fill(FIRE_COMPONENT);
    const result = sms.forgeSpell("Overload", extra, barter);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_many_components");
  });

  it("rejects duplicate spell name (case-insensitive)", () => {
    sms.forgeSpell("My Fire", [FIRE_COMPONENT], barter);
    const result = sms.forgeSpell("my fire", [FIRE_COMPONENT], barter);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("duplicate_name");
  });

  it("rejects when player has insufficient gold", () => {
    const poorBarter = makeBarterSystem(0);
    const result = sms.forgeSpell("Inferno", [FIRE_COMPONENT], poorBarter);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("insufficient_gold");
  });

  // ── forgeSpell success ─────────────────────────────────────────────────────

  it("forgeSpell returns ok=true with a spell when conditions are met", () => {
    const result = sms.forgeSpell("Inferno", [FIRE_COMPONENT], barter);
    expect(result.ok).toBe(true);
    expect(result.spell).toBeDefined();
    expect(result.spell!.name).toBe("Inferno");
  });

  it("forgeSpell deducts gold from barterSystem", () => {
    const before = barter.playerGold;
    const result = sms.forgeSpell("Inferno", [FIRE_COMPONENT], barter);
    expect(result.goldCost).toBeGreaterThan(0);
    expect(barter.playerGold).toBe(before - result.goldCost!);
  });

  it("forgeSpell registers and learns the new spell", () => {
    const result = sms.forgeSpell("Inferno", [FIRE_COMPONENT], barter);
    expect(spellSystem.registerSpell).toHaveBeenCalledWith(expect.objectContaining({ name: "Inferno" }));
    expect(spellSystem.learnSpell).toHaveBeenCalledWith(result.spell!.id);
  });

  it("forgeSpell works with null barter (no gold deduction)", () => {
    const result = sms.forgeSpell("Inferno", [FIRE_COMPONENT], null);
    expect(result.ok).toBe(true);
  });

  it("forgeSpell with heal component builds a self-delivery spell", () => {
    const result = sms.forgeSpell("Healing Wave", [HEAL_COMPONENT], barter);
    expect(result.ok).toBe(true);
    expect(result.spell!.delivery).toBe("self");
    expect(result.spell!.heal).toBeGreaterThan(0);
  });

  it("forgeSpell with two components produces a combined spell", () => {
    const result = sms.forgeSpell("FlameBolt", [FIRE_COMPONENT, HEAL_COMPONENT], barter);
    expect(result.ok).toBe(true);
    // damage from fire + some heal contribution from heal
    expect(result.spell!.damage).toBeGreaterThan(0);
  });

  it("forgeSpell generates unique IDs for different spells", () => {
    const r1 = sms.forgeSpell("Spell One", [FIRE_COMPONENT], barter);
    const r2 = sms.forgeSpell("Spell Two", [FIRE_COMPONENT], makeBarterSystem(1000));
    expect(r1.spell!.id).not.toBe(r2.spell!.id);
  });

  it("fires onSpellForged callback", () => {
    const cb = vi.fn();
    sms.onSpellForged = cb;
    const result = sms.forgeSpell("Inferno", [FIRE_COMPONENT], barter);
    expect(cb).toHaveBeenCalledWith(result.spell, result.goldCost);
  });

  // ── customSpells accessor ──────────────────────────────────────────────────

  it("customSpells lists all forged spells", () => {
    sms.forgeSpell("Spell A", [FIRE_COMPONENT], barter);
    sms.forgeSpell("Spell B", [HEAL_COMPONENT], makeBarterSystem(1000));
    expect(sms.customSpells.length).toBe(2);
  });

  // ── Persistence ────────────────────────────────────────────────────────────

  it("getSaveState captures custom spells", () => {
    sms.forgeSpell("Inferno", [FIRE_COMPONENT], barter);
    const state = sms.getSaveState();
    expect(state.customSpells.length).toBe(1);
    expect(state.customSpells[0].name).toBe("Inferno");
  });

  it("restoreFromSave re-registers and re-learns spells", () => {
    sms.forgeSpell("Inferno", [FIRE_COMPONENT], barter);
    const state = sms.getSaveState();

    const sms2 = new SpellMakingSystem(spellSystem as unknown as SpellSystem);
    sms2.restoreFromSave(state);

    expect(sms2.customSpells.length).toBe(1);
    expect(spellSystem.registerSpell).toHaveBeenCalledTimes(2); // once forge + once restore
  });

  it("restoreFromSave handles null gracefully", () => {
    expect(() => sms.restoreFromSave(null as any)).not.toThrow();
    expect(sms.customSpells.length).toBe(0);
  });

  it("full round-trip save/restore preserves spell", () => {
    sms.forgeSpell("Inferno", [FIRE_COMPONENT], barter);
    const state = sms.getSaveState();

    const sp2 = makeSpellSystem();
    const sms2 = new SpellMakingSystem(sp2 as unknown as SpellSystem);
    sms2.restoreFromSave(state);

    expect(sms2.customSpells[0].name).toBe("Inferno");
  });
});
