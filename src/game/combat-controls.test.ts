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

describe("omen powers (Shift+V)", () => {
  let clock = 600;
  async function omenSetup(signId: string, target: object | null = null) {
    clock = 600;
    const { BirthsignSystem } = await import("../systems/birthsign-system");
    const omens = new BirthsignSystem();
    omens.chooseBirthsign(signId);
    const added: Array<{ effectType: string; magnitude: number; duration: number }> = [];
    const stealth = { pushNoise: vi.fn(), unseenSeconds: 0 };
    const containers = { masterKeys: 0 };
    const notes: string[] = [];
    const deps = {
      combat: () => ({}), projectiles: () => ({}), stealth: () => stealth,
      spells: () => ({ targetInFront: () => target }),
      races: () => ({ chosenRace: null }), omens: () => omens, containers: () => containers,
      effects: () => ({ addEffect: (e: { effectType: string; magnitude: number; duration: number }) => added.push(e) }),
      gameTime: () => clock, blocked: () => false, free: () => true, swing: vi.fn(), twang: vi.fn(), notify: (t: string) => notes.push(t),
    } as unknown as CombatControlsDeps;
    return { c: new CombatControls(deps), omens, added, stealth, containers, notes };
  }

  it("the Grail heals 200 over five seconds, once a day", async () => {
    const t = await omenSetup("grail");
    t.c.omenPower();
    expect(t.added).toEqual([expect.objectContaining({ effectType: "health_restore", magnitude: 40, duration: 5 })]);
    t.c.omenPower();
    expect(t.added).toHaveLength(1);
    expect(t.notes.at(-1)).toMatch(/recharging/);
  });

  it("a power comes back a game-day later, across midnight (the clock never wraps)", async () => {
    const t = await omenSetup("grail");
    t.c.omenPower();
    clock = 600 + 1439;
    t.c.omenPower();
    expect(t.added, "not yet").toHaveLength(1);
    clock = 600 + 1440;
    t.c.omenPower();
    expect(t.added, "a day on, again").toHaveLength(2);
  });

  it("Under the Hill hides you for a minute; the Locked Door gives one master key", async () => {
    const hill = await omenSetup("hollow_hill");
    hill.c.omenPower();
    expect(hill.stealth.unseenSeconds).toBe(60);
    const door = await omenSetup("locked_door");
    door.c.omenPower();
    expect(door.containers.masterKeys).toBe(1);
  });

  it("Spellbound holds the foe in front of you; with no foe, nothing is spent", async () => {
    const none = await omenSetup("enchantress", null);
    none.c.omenPower();
    expect(none.notes.at(-1)).toMatch(/no foe in front/);
    expect(none.omens.canActivatePower(600), "the power is still there").toBe(true);

    const foe = { applyStatusEffect: vi.fn(), isStaggered: false, isAttackTelegraphing: true, staggerTimer: 0 };
    const t = await omenSetup("enchantress", foe);
    t.c.omenPower();
    expect(foe.applyStatusEffect).toHaveBeenCalledWith(expect.objectContaining({ type: "freeze", remainingDuration: 10 }));
    expect(foe.staggerTimer).toBe(10);
  });

  it("the Adder poisons the foe in front of you; a sign with no power says so", async () => {
    const foe = { applyStatusEffect: vi.fn(), provoked: false };
    const t = await omenSetup("adder", foe);
    t.c.omenPower();
    expect(foe.applyStatusEffect).toHaveBeenCalledWith(expect.objectContaining({ type: "poison", damagePerTick: 3, remainingDuration: 20 }));
    const plain = await omenSetup("sword_stone");
    plain.c.omenPower();
    expect(plain.notes.at(-1)).toBe("Your omen grants no power.");
  });
});
