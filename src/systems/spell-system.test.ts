import { describe, it, expect, beforeEach, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { SpellSystem, DEFAULT_SPELLS } from "./spell-system";
import type { SpellDefinition } from "./spell-system";

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
    notifyResourceSpent: vi.fn(),
  } as any;
}

function makeUI() {
  return { showNotification: vi.fn() } as any;
}

function makeNPC(x = 5, alive = true) {
  const { Vector3 } = require("@babylonjs/core/Maths/math.vector");
  return {
    isDead: !alive,
    mesh: { name: "Bandit", position: new Vector3(x, 0, 0) },
    takeDamage: vi.fn(),
    applyStatusEffect: vi.fn(),
    statusEffects: [],
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
    expect(sys.knowsSpell("flames")).toBe(false);
    const ok = sys.learnSpell("flames");
    expect(ok).toBe(true);
    expect(sys.knowsSpell("flames")).toBe(true);
  });

  it("learnSpell returns false for unknown spell id", () => {
    expect(sys.learnSpell("nonexistent_spell")).toBe(false);
  });

  it("learnSpell returns false when already known", () => {
    sys.learnSpell("healing");
    expect(sys.learnSpell("healing")).toBe(false);
  });

  it("equipSpell returns false if spell not learned", () => {
    expect(sys.equipSpell("flames")).toBe(false);
    expect(sys.equippedSpell).toBeNull();
  });

  it("equipSpell selects the spell after learning", () => {
    sys.learnSpell("flames");
    expect(sys.equipSpell("flames")).toBe(true);
    expect(sys.equippedSpell?.id).toBe("flames");
  });

  // ── Cast preconditions ─────────────────────────────────────────────────────

  it("castSpell fails with no_spell_equipped when nothing is equipped", () => {
    const result = sys.castSpell();
    expect(result.success).toBe(false);
    expect(result.reason).toBe("no_spell_equipped");
  });

  it("castSpell fails with insufficient_magicka", () => {
    sys.learnSpell("fireball");
    sys.equipSpell("fireball");
    player.magicka = 0;
    const result = sys.castSpell();
    expect(result.success).toBe(false);
    expect(result.reason).toBe("insufficient_magicka");
  });

  it("castSpell fails on_cooldown after firing", () => {
    sys.learnSpell("flames");
    sys.equipSpell("flames");
    sys.castSpell(); // first cast
    const result = sys.castSpell();
    expect(result.success).toBe(false);
    expect(result.reason).toBe("on_cooldown");
  });

  // ── Cast effects ───────────────────────────────────────────────────────────

  it("castSpell (destruction) deducts magicka", () => {
    sys.learnSpell("flames");
    sys.equipSpell("flames");
    const before = player.magicka;
    const spell = sys.equippedSpell!;
    sys.castSpell();
    expect(player.magicka).toBe(before - spell.magickaCost);
  });

  it("castSpell (restoration/self) heals the player", () => {
    sys.learnSpell("healing");
    sys.equipSpell("healing");
    player.health = 50;
    player.maxHealth = 100;
    sys.castSpell();
    expect(player.health).toBeGreaterThan(50);
  });

  it("castSpell (target) calls takeDamage on nearby NPC", () => {
    sys.learnSpell("flames");
    sys.equipSpell("flames");
    sys.castSpell();
    expect(npc.takeDamage).toHaveBeenCalled();
  });

  it("castSpell does not hit dead NPCs", () => {
    const deadNpc = makeNPC(2, false);
    sys.npcs = [deadNpc];
    sys.learnSpell("flames");
    sys.equipSpell("flames");
    sys.castSpell();
    expect(deadNpc.takeDamage).not.toHaveBeenCalled();
  });

  it("magicDamageBonus adds to spell damage", () => {
    sys.magicDamageBonus = 10;
    sys.learnSpell("flames");
    sys.equipSpell("flames");
    sys.castSpell();
    const called = npc.takeDamage.mock.calls[0][0] as number;
    const flamesDef = DEFAULT_SPELLS.find(s => s.id === "flames")!;
    expect(called).toBe(flamesDef.damage! + 10);
  });

  // ── Cooldown ───────────────────────────────────────────────────────────────

  it("update reduces cooldown over time", () => {
    sys.learnSpell("flames");
    sys.equipSpell("flames");
    sys.castSpell();
    expect(sys.cooldownRemaining).toBeGreaterThan(0);
    sys.update(10);
    expect(sys.cooldownRemaining).toBe(0);
  });

  it("can cast again after cooldown expires", () => {
    sys.learnSpell("flames");
    sys.equipSpell("flames");
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
    sys.learnSpell("flames");
    sys.learnSpell("healing");
    sys.equipSpell("healing");
    const state = sys.getSaveState();
    expect(state.knownSpellIds).toContain("flames");
    expect(state.knownSpellIds).toContain("healing");
    expect(state.equippedSpellId).toBe("healing");
  });

  it("restoreFromSave rehydrates known spells and equipped spell", () => {
    sys.restoreFromSave({ knownSpellIds: ["flames", "healing"], equippedSpellId: "flames" });
    expect(sys.knowsSpell("flames")).toBe(true);
    expect(sys.knowsSpell("healing")).toBe(true);
    expect(sys.equippedSpell?.id).toBe("flames");
  });

  it("restoreFromSave ignores unknown spell ids", () => {
    sys.restoreFromSave({ knownSpellIds: ["flames", "ghost_spell_xyz"], equippedSpellId: null });
    expect(sys.knowsSpell("flames")).toBe(true);
    expect(sys.knowsSpell("ghost_spell_xyz")).toBe(false);
  });

  it("restoreFromSave clears equipped spell if not in restored known list", () => {
    sys.restoreFromSave({ knownSpellIds: [], equippedSpellId: "flames" });
    expect(sys.equippedSpell).toBeNull();
  });

  // ── onSpellCast hook ───────────────────────────────────────────────────────

  it("fires onSpellCast hook on successful cast", () => {
    const hook = vi.fn();
    sys.onSpellCast = hook;
    sys.learnSpell("flames");
    sys.equipSpell("flames");
    sys.castSpell();
    expect(hook).toHaveBeenCalledTimes(1);
    const [spell, result] = hook.mock.calls[0];
    expect(spell.id).toBe("flames");
    expect(result.success).toBe(true);
  });
});
