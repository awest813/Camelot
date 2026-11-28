import { describe, it, expect, beforeEach, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { SpellSystem, DEFAULT_SPELLS } from "./spell-system";
import type { SpellDefinition } from "./spell-system";
import { listen } from "../testing/listen";

// ── Minimal stubs ─────────────────────────────────────────────────────────────

function makeScene() {
  const engine = new NullEngine();
  return new Scene(engine);
}

function makePlayer(scene: Scene) {
  const { UniversalCamera } = require("@babylonjs/core/Cameras/universalCamera");
  const { Vector3 } = require("@babylonjs/core/Maths/math.vector");
  const cam = new UniversalCamera("cam", new Vector3(0, 1, 0), scene);
  return {
    camera: cam,
    health: 100,
    maxHealth: 100,
    magicka: 200,
    maxMagicka: 200,
    bonusMagicDamage: 0,
    notifyResourceSpent: vi.fn(),
  } as any;
}

function makeUI() {
  return { showNotification: vi.fn() } as any;
}

function makeNPC(z = 5, alive = true, overrides: Record<string, unknown> = {}) {
  const { Vector3 } = require("@babylonjs/core/Maths/math.vector");
  return {
    isDead: !alive,
    // Place NPCs along the +Z axis so they are within the camera's default
    // forward-facing targeting cone (camera at origin facing +Z).
    key: "Bandit", displayName: "Bandit", mesh: { name: "Bandit", position: new Vector3(0, 0, z) },
    health: 100,
    maxHealth: 100,
    takeDamage: vi.fn(),
    applyStatusEffect: vi.fn(),
    statusEffects: [],
    damageResistances: {},
    damageWeaknesses: {},
    armorRating: 0,
    ...overrides,
  } as any;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("SpellSystem", () => {
  let scene: Scene;
  let player: any;
  let ui: any;
  let npc: any;
  let sys: SpellSystem;

  beforeEach(() => {
    scene  = makeScene();
    player = makePlayer(scene);
    ui     = makeUI();
    npc    = makeNPC();
    sys    = new SpellSystem(player, [npc], ui);
  });

  // ── Default spells ─────────────────────────────────────────────────────────

  it("contains default spell definitions", () => {
    const defs = sys.getDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(DEFAULT_SPELLS.length);
  });

  // ── Learn & equip ──────────────────────────────────────────────────────────

  it("learnSpell adds a known spell", () => {
    expect(sys.knowsSpell("kindle")).toBe(false);
    const ok = sys.learnSpell("kindle");
    expect(ok).toBe(true);
    expect(sys.knowsSpell("kindle")).toBe(true);
  });

  it("learnSpell returns false for unknown spell id", () => {
    expect(sys.learnSpell("nonexistent_spell")).toBe(false);
  });

  it("learnSpell returns false when already known", () => {
    sys.learnSpell("mending");
    expect(sys.learnSpell("mending")).toBe(false);
  });

  it("equipSpell returns false if spell not learned", () => {
    expect(sys.equipSpell("kindle")).toBe(false);
    expect(sys.equippedSpell).toBeNull();
  });

  it("equipSpell selects the spell after learning", () => {
    sys.learnSpell("kindle");
    expect(sys.equipSpell("kindle")).toBe(true);
    expect(sys.equippedSpell?.id).toBe("kindle");
  });

  // ── Cast preconditions ─────────────────────────────────────────────────────

  it("castSpell fails with no_spell_equipped when nothing is equipped", () => {
    const result = sys.castSpell();
    expect(result.success).toBe(false);
    expect(result.reason).toBe("no_spell_equipped");
  });

  it("castSpell fails with insufficient_magicka", () => {
    sys.learnSpell("balefire");
    sys.equipSpell("balefire");
    player.magicka = 0;
    const result = sys.castSpell();
    expect(result.success).toBe(false);
    expect(result.reason).toBe("insufficient_magicka");
  });

  it("castSpell fails on_cooldown after firing", () => {
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell(); // first cast
    const result = sys.castSpell();
    expect(result.success).toBe(false);
    expect(result.reason).toBe("on_cooldown");
  });

  it("castSpell fails while silenced, and spends no magicka", () => {
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.silenced = () => true;
    const before = player.magicka;
    const result = sys.castSpell();
    expect(result).toMatchObject({ success: false, reason: "silenced" });
    expect(player.magicka).toBe(before);
  });

  // ── Cast effects ───────────────────────────────────────────────────────────

  it("castSpell (destruction) deducts magicka", () => {
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    const before = player.magicka;
    const spell = sys.equippedSpell!;
    sys.castSpell();
    expect(player.magicka).toBe(before - spell.magickaCost);
  });

  it("castSpell (restoration/self) heals the player", () => {
    sys.learnSpell("mending");
    sys.equipSpell("mending");
    player.health = 50;
    player.maxHealth = 100;
    sys.castSpell();
    expect(player.health).toBeGreaterThan(50);
  });

  it("castSpell (target) calls takeDamage on nearby NPC", () => {
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    expect(npc.takeDamage).toHaveBeenCalled();
  });

  it("a spell's killing blow is reported as a kill (XP, spoils, quest credit)", () => {
    const emitted: string[] = [];
    sys.events = { emit: (name: string) => { emitted.push(name); } } as never;
    npc.takeDamage.mockImplementation(() => { npc.isDead = true; });
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    expect(emitted).toContain("npc:killed");
  });

  it("castSpell does not hit dead NPCs", () => {
    const deadNpc = makeNPC(2, false);
    sys.npcs = [deadNpc];
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    expect(deadNpc.takeDamage).not.toHaveBeenCalled();
  });

  it("magicDamageBonus adds to spell damage", () => {
    sys.magicDamageBonus = 10;
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    const called = npc.takeDamage.mock.calls[0][0] as number;
    const flamesDef = DEFAULT_SPELLS.find(s => s.id === "kindle")!;
    expect(called).toBe(flamesDef.damage! + 10);
  });

  it("bonusMagicDamage from equipment adds to spell damage", () => {
    player.bonusMagicDamage = 7;
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    const called = npc.takeDamage.mock.calls[0][0] as number;
    const flamesDef = DEFAULT_SPELLS.find(s => s.id === "kindle")!;
    expect(called).toBe(flamesDef.damage! + 7);
  });

  it("spell damage respects NPC fire resistance", () => {
    const resistant = makeNPC(5, true, { damageResistances: { fire: 0.5 } });
    sys.npcs = [resistant];
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    const called = resistant.takeDamage.mock.calls[0][0] as number;
    expect(called).toBe(4);
  });

  it("castSpell heal_other restores an NPC in the targeting cone", () => {
    const { Vector3 } = require("@babylonjs/core/Maths/math.vector");
    const targetNpc = makeNPC(5, true, {
      health: 40,
      maxHealth: 100,
      key: "Villager", displayName: "Villager", mesh: { name: "Villager", position: new Vector3(0, 0, 5) },
    });
    sys.npcs = [targetNpc];
    sys.learnSpell("mend_another");
    sys.equipSpell("mend_another");
    const result = sys.castSpell();
    expect(result.heal).toBe(15);
    expect(result.hitNpc).toBe("Villager");
    expect(targetNpc.health).toBe(55);
  });

  // ── Cooldown ───────────────────────────────────────────────────────────────

  it("update reduces cooldown over time", () => {
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    expect(sys.cooldownRemaining).toBeGreaterThan(0);
    sys.update(10);
    expect(sys.cooldownRemaining).toBe(0);
  });

  it("can cast again after cooldown expires", () => {
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    sys.update(100);
    const result = sys.castSpell();
    expect(result.success).toBe(true);
  });

  // ── Custom spell registration ──────────────────────────────────────────────

  it("registerSpell makes spell learnable", () => {
    const custom: SpellDefinition = {
      id: "void_bolt",
      name: "Void Bolt",
      school: "destruction",
      delivery: "target",
      magickaCost: 40,
      cooldown: 1.0,
      damage: 30,
      damageType: "magic",
      range: 20,
    };
    sys.registerSpell(custom);
    expect(sys.learnSpell("void_bolt")).toBe(true);
    sys.equipSpell("void_bolt");
    const result = sys.castSpell();
    expect(result.success).toBe(true);
  });

  // ── Save / load ────────────────────────────────────────────────────────────

  it("getSaveState serializes known spells and equipped spell", () => {
    sys.learnSpell("kindle");
    sys.learnSpell("mending");
    sys.equipSpell("mending");
    const state = sys.getSaveState();
    expect(state.knownSpellIds).toContain("kindle");
    expect(state.knownSpellIds).toContain("mending");
    expect(state.equippedSpellId).toBe("mending");
  });

  it("restoreFromSave rehydrates known spells and equipped spell", () => {
    sys.restoreFromSave({ knownSpellIds: ["kindle", "mending"], equippedSpellId: "kindle" });
    expect(sys.knowsSpell("kindle")).toBe(true);
    expect(sys.knowsSpell("mending")).toBe(true);
    expect(sys.equippedSpell?.id).toBe("kindle");
  });

  it("restoreFromSave ignores unknown spell ids", () => {
    sys.restoreFromSave({ knownSpellIds: ["kindle", "ghost_spell_xyz"], equippedSpellId: null });
    expect(sys.knowsSpell("kindle")).toBe(true);
    expect(sys.knowsSpell("ghost_spell_xyz")).toBe(false);
  });

  it("restoreFromSave clears equipped spell if not in restored known list", () => {
    sys.restoreFromSave({ knownSpellIds: [], equippedSpellId: "kindle" });
    expect(sys.equippedSpell).toBeNull();
  });

  // ── onSpellCast hook ───────────────────────────────────────────────────────

  it("reports spell:cast on a successful cast", () => {
    const hook = vi.fn();
    listen(sys, "spell:cast", hook);
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    expect(sys.castSpell().success).toBe(true);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][0]).toMatchObject({ spellId: "kindle" });
  });

  it("fires onHostileHit when a damaging spell lands", () => {
    const onHostile = vi.fn();
    listen(sys, "combat:hostileHit", (p) => onHostile(p.npc, p.damage));
    sys.learnSpell("kindle");
    sys.equipSpell("kindle");
    sys.castSpell();
    expect(npc.takeDamage).toHaveBeenCalled();
    expect(onHostile).toHaveBeenCalledWith(npc, expect.any(Number));
  });

  // ── Expanded school & spell casting coverage ───────────────────────────────

  it("default spells include definitions across all five magical schools", () => {
    const schools = new Set(DEFAULT_SPELLS.map((s) => s.school));
    expect(schools.has("destruction")).toBe(true);
    expect(schools.has("restoration")).toBe(true);
    expect(schools.has("alteration")).toBe(true);
    expect(schools.has("illusion")).toBe(true);
    expect(schools.has("conjuration")).toBe(true);
  });

  it("can cast a Warding self-buff spell (Bark-skin)", () => {
    sys.learnSpell("barkskin");
    sys.equipSpell("barkskin");
    const initialMagicka = player.magicka;
    const result = sys.castSpell();
    expect(result.success).toBe(true);
    expect(player.magicka).toBe(initialMagicka - 28);
  });

  it("can cast holy Restoration offensive spell (Turn Undead) and hit NPC", () => {
    sys.learnSpell("banish_dead");
    sys.equipSpell("banish_dead");
    const result = sys.castSpell();
    expect(result.success).toBe(true);
    expect(result.hitNpc).toBe(npc.mesh.name);
    expect(npc.takeDamage).toHaveBeenCalled();
  });
});

describe("SpellSystem — effects beyond harm and healing", () => {
  const cast = (id: string, npcs: any[] = []) => {
    const scene = makeScene();
    const player = makePlayer(scene);
    const sys = new SpellSystem(player, npcs, makeUI());
    const events: any[] = [];
    listen(sys, "spell:cast", (payload) => { events.push({ payload }); });
    sys.learnSpell(id);
    sys.equipSpell(id);
    const result = sys.castSpell();
    return { result, events, sys };
  };

  it("every built-in spell does something: damage, healing, or an effect", () => {
    for (const s of DEFAULT_SPELLS) expect(!!(s.damage || s.heal || s.effect), s.id).toBe(true);
  });

  it("self spells report their effect, magnitude and duration on spell:cast", () => {
    const { events } = cast("barkskin");
    expect(events.at(-1)?.payload).toMatchObject({ spellId: "barkskin", effect: "ward", magnitude: 30, duration: 60 });
  });

  it("Hush calms its target for the spell's duration", () => {
    const foe = makeNPC(5, true, { isAggressive: true, hostileOnSight: true, pacifiedTimer: 0, aiState: "attack" });
    const { result } = cast("hush", [foe]);
    expect(result.hitNpc).toBe("Bandit");
    expect(foe.pacifiedTimer).toBe(15);
    expect(foe.isAggressive).toBe(false);
  });

  it("Banish the Dead strikes the restless dead harder", () => {
    const skeleton = makeNPC(5, true, { key: "Skeleton_Warrior" });
    const bandit = makeNPC(5, true);
    const a = cast("banish_dead", [skeleton]).result.damage!;
    const b = cast("banish_dead", [bandit]).result.damage!;
    expect(a).toBeGreaterThan(b * 2);
  });

  it("Mend Another heals a friend, not a foe", () => {
    const foe = makeNPC(5, true, { isAggressive: true, hostileOnSight: true, health: 50 });
    cast("mend_another", [foe]);
    expect(foe.health).toBe(50);
    const friend = makeNPC(5, true, { isAggressive: false, hostileOnSight: false, health: 50 });
    cast("mend_another", [friend]);
    expect(friend.health).toBeGreaterThan(50);
  });
});
