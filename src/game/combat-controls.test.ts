import { describe, it, expect, vi } from "vitest";
import { CombatControls, type CombatControlsDeps } from "./combat-controls";

function setup(opts: { archetype?: string; blocked?: boolean } = {}) {
  const combat = {
    activeWeaponArchetype: opts.archetype ?? "sword", isChargingStaff: false,
    meleeAttack: vi.fn(() => true), powerAttack: vi.fn(() => true), beginStaffCharge: vi.fn(() => { combat.isChargingStaff = true; }),
    releaseStaffCharge: vi.fn(), tryDodgeRoll: vi.fn(), beginBlock: vi.fn(), endBlock: vi.fn(),
  };
  const projectiles = { isDrawing: false, beginDraw: vi.fn(() => { projectiles.isDrawing = true; return true; }), releaseArrow: vi.fn(() => { projectiles.isDrawing = false; return true; }) };
  const spells = { castSpell: vi.fn(), knownSpells: [{ id: "a" }, { id: "b" }], equippedSpell: { id: "b" } as { id: string } | null, equipSpell: vi.fn() };
  const swing = vi.fn(), twang = vi.fn(), noise = vi.fn();
  const deps = {
    combat: () => combat, projectiles: () => projectiles, stealth: () => ({ pushNoise: noise }), spells: () => spells,
    races: () => ({ chosenRace: null }), effects: () => ({}), gameTime: () => 0,
    blocked: () => !!opts.blocked, free: () => true, swing, twang, notify: vi.fn(),
  } as unknown as CombatControlsDeps;
  return { c: new CombatControls(deps), combat, projectiles, spells, swing, twang, noise };
}

describe("CombatControls", () => {
  it("attack swings a blade, or draws a bow (with noise); releasing looses the arrow", () => {
    const sword = setup();
    sword.c.attack();
    expect(sword.combat.meleeAttack).toHaveBeenCalledOnce();
    expect(sword.swing).toHaveBeenCalledWith(false);

    const bow = setup({ archetype: "bow" });
    bow.c.attack();
    expect(bow.projectiles.isDrawing).toBe(true);
    expect(bow.noise).toHaveBeenCalledWith(0.4);
    bow.c.releaseBow();
    expect(bow.twang).toHaveBeenCalledOnce();
  });

  it("Q casts, or charges a staff and lets it go on release", () => {
    const t = setup({ archetype: "staff" });
    t.c.castDown();
    expect(t.combat.beginStaffCharge).toHaveBeenCalled();
    t.c.castUp();
    expect(t.combat.releaseStaffCharge).toHaveBeenCalled();
    const s = setup();
    s.c.castDown();
    expect(s.spells.castSpell).toHaveBeenCalled();
  });

  it("cycling spells wraps around; nothing happens while blocked", () => {
    const t = setup();
    t.c.cycleSpell();
    expect(t.spells.equipSpell).toHaveBeenCalledWith("a");
    const b = setup({ blocked: true });
    b.c.attack();
    b.c.powerAttack();
    b.c.castDown();
    expect(b.combat.meleeAttack).not.toHaveBeenCalled();
    expect(b.combat.powerAttack).not.toHaveBeenCalled();
    expect(b.spells.castSpell).not.toHaveBeenCalled();
  });
});
