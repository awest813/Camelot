import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DragonShoutSystem,
  BUILTIN_SHOUTS,
  GAME_MINUTES_PER_HOUR,
} from "./dragon-shout-system";
import type {
  ShoutDefinition,
  DragonShoutSaveState,
  ShoutTierEffect,
} from "./dragon-shout-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCustomShout(overrides: Partial<ShoutDefinition> = {}): ShoutDefinition {
  return {
    id: "test_shout",
    name: "Test Shout",
    description: "A test shout.",
    words: [
      { dragonWord: "TEST", translation: "Test" },
      { dragonWord: "ZWEI", translation: "Two"  },
      { dragonWord: "DREI", translation: "Three"},
    ],
    tiers: [
      { description: "Tier 1", cooldownSeconds: 10, effects: { damage: 10 } },
      { description: "Tier 2", cooldownSeconds: 20, effects: { damage: 20 } },
      { description: "Tier 3", cooldownSeconds: 30, effects: { damage: 30 } },
    ],
    ...overrides,
  };
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe("DragonShoutSystem — initial state", () => {
  it("starts with 0 dragon souls", () => {
    const sys = new DragonShoutSystem();
    expect(sys.dragonSouls).toBe(0);
  });

  it("starts with no equipped shout", () => {
    const sys = new DragonShoutSystem();
    expect(sys.equippedShoutId).toBeNull();
  });

  it("registers all built-in shouts on construction", () => {
    const sys = new DragonShoutSystem();
    for (const def of BUILTIN_SHOUTS) {
      expect(sys.registeredShoutIds).toContain(def.id);
    }
  });

  it("registers exactly 8 built-in shouts", () => {
    const sys = new DragonShoutSystem();
    expect(sys.registeredShoutIds).toHaveLength(8);
  });

  it("no word is learned or unlocked by default", () => {
    const sys = new DragonShoutSystem();
    for (let i = 0; i < 3; i++) {
      expect(sys.isWordLearned("unrelenting_force", i as 0 | 1 | 2)).toBe(false);
      expect(sys.isWordUnlocked("unrelenting_force", i as 0 | 1 | 2)).toBe(false);
    }
  });
});

// ── registerShout / removeShout / getShout ────────────────────────────────────

describe("DragonShoutSystem — registration", () => {
  it("registers a custom shout", () => {
    const sys  = new DragonShoutSystem();
    const def  = makeCustomShout();
    sys.registerShout(def);
    expect(sys.registeredShoutIds).toContain("test_shout");
  });

  it("getShout returns the definition", () => {
    const sys = new DragonShoutSystem();
    const def = sys.getShout("unrelenting_force")!;
    expect(def.name).toBe("Unrelenting Force");
  });

  it("getShout returns undefined for unknown id", () => {
    const sys = new DragonShoutSystem();
    expect(sys.getShout("no_such_shout")).toBeUndefined();
  });

  it("getAllShouts returns all definitions", () => {
    const sys = new DragonShoutSystem();
    const all = sys.getAllShouts();
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(all.find(s => s.id === "fire_breath")).toBeDefined();
  });

  it("removeShout removes the shout and returns true", () => {
    const sys = new DragonShoutSystem();
    sys.registerShout(makeCustomShout());
    expect(sys.removeShout("test_shout")).toBe(true);
    expect(sys.registeredShoutIds).not.toContain("test_shout");
  });

  it("removeShout returns false for unknown shout", () => {
    const sys = new DragonShoutSystem();
    expect(sys.removeShout("no_such_shout")).toBe(false);
  });

  it("removeShout clears the equipped shout when the equipped one is removed", () => {
    const sys = new DragonShoutSystem();
    sys.registerShout(makeCustomShout());
    sys.equipShout("test_shout");
    sys.removeShout("test_shout");
    expect(sys.equippedShoutId).toBeNull();
  });

  it("re-registering an existing id replaces the definition", () => {
    const sys = new DragonShoutSystem();
    const updated = makeCustomShout({ name: "Updated Name" });
    sys.registerShout(updated);
    expect(sys.getShout("test_shout")!.name).toBe("Updated Name");
  });

  it("re-registering preserves existing word state", () => {
    const sys = new DragonShoutSystem();
    sys.registerShout(makeCustomShout());
    sys.gainDragonSoul();
    sys.learnWord("test_shout", 0);
    sys.unlockWord("test_shout", 0);
    // Re-register
    sys.registerShout(makeCustomShout({ name: "Updated" }));
    expect(sys.isWordUnlocked("test_shout", 0)).toBe(true);
  });
});

// ── Dragon souls ───────────────────────────────────────────────────────────────

describe("DragonShoutSystem — dragon souls", () => {
  it("gainDragonSoul increments souls by 1", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    expect(sys.dragonSouls).toBe(1);
  });

  it("gainDragonSoul(3) increments by 3", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(3);
    expect(sys.dragonSouls).toBe(3);
  });

  it("gainDragonSoul ignores 0", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(0);
    expect(sys.dragonSouls).toBe(0);
  });

  it("onDragonSoulGained callback fires with new total", () => {
    const sys = new DragonShoutSystem();
    const cb = vi.fn();
    sys.onDragonSoulGained = cb;
    sys.gainDragonSoul(2);
    expect(cb).toHaveBeenCalledWith(2);
  });

  it("spendDragonSouls deducts souls and returns true", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(5);
    expect(sys.spendDragonSouls(3)).toBe(true);
    expect(sys.dragonSouls).toBe(2);
  });

  it("spendDragonSouls returns false when insufficient", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(1);
    expect(sys.spendDragonSouls(2)).toBe(false);
    expect(sys.dragonSouls).toBe(1);
  });
});

// ── Word learning ─────────────────────────────────────────────────────────────

describe("DragonShoutSystem — learnWord", () => {
  it("learnWord marks the word as learned", () => {
    const sys = new DragonShoutSystem();
    expect(sys.learnWord("unrelenting_force", 0)).toBe(true);
    expect(sys.isWordLearned("unrelenting_force", 0)).toBe(true);
  });

  it("learnWord is idempotent", () => {
    const sys = new DragonShoutSystem();
    sys.learnWord("unrelenting_force", 0);
    expect(sys.learnWord("unrelenting_force", 0)).toBe(true);
    expect(sys.isWordLearned("unrelenting_force", 0)).toBe(true);
  });

  it("learnWord returns false for unknown shout", () => {
    const sys = new DragonShoutSystem();
    expect(sys.learnWord("no_such" as any, 0)).toBe(false);
  });

  it("onWordLearned callback fires on first discovery", () => {
    const sys = new DragonShoutSystem();
    const cb = vi.fn();
    sys.onWordLearned = cb;
    sys.learnWord("unrelenting_force", 0);
    expect(cb).toHaveBeenCalledWith("unrelenting_force", 0, expect.objectContaining({ dragonWord: "FUS" }));
  });

  it("onWordLearned does not fire when already known", () => {
    const sys = new DragonShoutSystem();
    const cb = vi.fn();
    sys.onWordLearned = cb;
    sys.learnWord("unrelenting_force", 0);
    sys.learnWord("unrelenting_force", 0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("learnWord returns false for invalid index", () => {
    const sys = new DragonShoutSystem();
    expect(sys.learnWord("unrelenting_force", 5 as any)).toBe(false);
  });
});

// ── Word unlocking ────────────────────────────────────────────────────────────

describe("DragonShoutSystem — unlockWord", () => {
  it("unlockWord returns false when word not learned", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    expect(sys.unlockWord("unrelenting_force", 0)).toBe(false);
  });

  it("unlockWord returns false when no dragon souls", () => {
    const sys = new DragonShoutSystem();
    sys.learnWord("unrelenting_force", 0);
    expect(sys.unlockWord("unrelenting_force", 0)).toBe(false);
  });

  it("unlockWord succeeds when learned and soul available", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    sys.learnWord("unrelenting_force", 0);
    expect(sys.unlockWord("unrelenting_force", 0)).toBe(true);
    expect(sys.isWordUnlocked("unrelenting_force", 0)).toBe(true);
    expect(sys.dragonSouls).toBe(0);
  });

  it("unlockWord spends exactly one soul per unlock", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(3);
    sys.learnWord("unrelenting_force", 0);
    sys.learnWord("unrelenting_force", 1);
    sys.unlockWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 1);
    expect(sys.dragonSouls).toBe(1);
  });

  it("unlockWord enforces word ordering (cannot unlock word 2 before word 1)", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(3);
    sys.learnWord("unrelenting_force", 0);
    sys.learnWord("unrelenting_force", 1);
    // word 0 not yet unlocked — word 1 must fail
    expect(sys.unlockWord("unrelenting_force", 1)).toBe(false);
  });

  it("onWordUnlocked callback fires", () => {
    const sys = new DragonShoutSystem();
    const cb  = vi.fn();
    sys.onWordUnlocked = cb;
    sys.gainDragonSoul();
    sys.learnWord("fire_breath", 0);
    sys.unlockWord("fire_breath", 0);
    expect(cb).toHaveBeenCalledWith("fire_breath", 0, expect.objectContaining({ dragonWord: "YOL" }));
  });

  it("unlockWord is idempotent when already unlocked", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(2);
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    // second call — no more soul cost
    const result = sys.unlockWord("unrelenting_force", 0);
    expect(result).toBe(true);
    expect(sys.dragonSouls).toBe(1); // only one soul spent total
  });

  it("getUnlockedTier reflects unlocked word count", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(3);
    sys.learnWord("unrelenting_force", 0);
    sys.learnWord("unrelenting_force", 1);
    sys.learnWord("unrelenting_force", 2);
    expect(sys.getUnlockedTier("unrelenting_force")).toBe(0);
    sys.unlockWord("unrelenting_force", 0);
    expect(sys.getUnlockedTier("unrelenting_force")).toBe(1);
    sys.unlockWord("unrelenting_force", 1);
    expect(sys.getUnlockedTier("unrelenting_force")).toBe(2);
    sys.unlockWord("unrelenting_force", 2);
    expect(sys.getUnlockedTier("unrelenting_force")).toBe(3);
  });
});

// ── Equipping ─────────────────────────────────────────────────────────────────

describe("DragonShoutSystem — equipShout / unequipShout", () => {
  it("equipShout returns true for a registered shout", () => {
    const sys = new DragonShoutSystem();
    expect(sys.equipShout("unrelenting_force")).toBe(true);
    expect(sys.equippedShoutId).toBe("unrelenting_force");
  });

  it("equipShout returns false for unknown shout", () => {
    const sys = new DragonShoutSystem();
    expect(sys.equipShout("no_such_shout")).toBe(false);
    expect(sys.equippedShoutId).toBeNull();
  });

  it("unequipShout clears the equipped shout", () => {
    const sys = new DragonShoutSystem();
    sys.equipShout("unrelenting_force");
    sys.unequipShout();
    expect(sys.equippedShoutId).toBeNull();
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────

describe("DragonShoutSystem — cooldown", () => {
  it("cooldownRemaining is 0 when shout has never been used", () => {
    const sys = new DragonShoutSystem();
    expect(sys.cooldownRemaining("unrelenting_force", 0)).toBe(0);
  });

  it("cooldownRemaining returns remaining seconds after use", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(3);
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    sys.equipShout("unrelenting_force");
    sys.useShout(0);

    // Tier 1 cooldown = 2 s → 2/60 minutes
    // After 1 second has passed (1/60 minute), ~1 second remains
    const afterOneSecond = 1 / 60;
    const remaining = sys.cooldownRemaining("unrelenting_force", afterOneSecond);
    expect(remaining).toBeCloseTo(1, 0);
  });

  it("cooldownRemaining returns 0 after full cooldown elapsed", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    sys.equipShout("unrelenting_force");
    sys.useShout(0);

    const cooldownMinutes = 2 / 60; // 2 second cooldown in minutes
    expect(sys.cooldownRemaining("unrelenting_force", cooldownMinutes + 0.001)).toBe(0);
  });

  it("isShoutReady returns false when no shout equipped", () => {
    const sys = new DragonShoutSystem();
    expect(sys.isShoutReady(0)).toBe(false);
  });

  it("isShoutReady returns false when no words unlocked", () => {
    const sys = new DragonShoutSystem();
    sys.equipShout("unrelenting_force");
    expect(sys.isShoutReady(0)).toBe(false);
  });

  it("isShoutReady returns true when equipped and off cooldown", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    sys.equipShout("unrelenting_force");
    expect(sys.isShoutReady(0)).toBe(true);
  });

  it("isShoutReady returns false while on cooldown", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    sys.equipShout("unrelenting_force");
    sys.useShout(0);
    expect(sys.isShoutReady(0)).toBe(false);
  });
});

// ── useShout ──────────────────────────────────────────────────────────────────

describe("DragonShoutSystem — useShout", () => {
  it("returns failure when no shout is equipped", () => {
    const sys = new DragonShoutSystem();
    const result = sys.useShout(0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("no_shout_equipped");
  });

  it("returns failure when no words are unlocked", () => {
    const sys = new DragonShoutSystem();
    sys.equipShout("unrelenting_force");
    const result = sys.useShout(0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("no_words_unlocked");
  });

  it("returns on_cooldown while shout is recharging", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    sys.equipShout("unrelenting_force");
    sys.useShout(0);
    const result = sys.useShout(0);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("on_cooldown");
      expect(result.cooldownRemainingSeconds).toBeGreaterThan(0);
    }
  });

  it("returns success with tier 1 when only first word is unlocked", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    sys.learnWord("fire_breath", 0);
    sys.unlockWord("fire_breath", 0);
    sys.equipShout("fire_breath");
    const result = sys.useShout(0);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.wordCount).toBe(1);
      expect(result.tier.effects.fire_damage).toBe(25);
    }
  });

  it("returns success with tier 3 when all three words are unlocked", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(3);
    for (let i = 0; i < 3; i++) {
      sys.learnWord("fire_breath", i as 0 | 1 | 2);
      sys.unlockWord("fire_breath", i as 0 | 1 | 2);
    }
    sys.equipShout("fire_breath");
    const result = sys.useShout(0);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.wordCount).toBe(3);
      expect(result.tier.effects.fire_damage).toBe(80);
    }
  });

  it("onShoutUsed callback fires on successful use", () => {
    const sys = new DragonShoutSystem();
    const cb  = vi.fn();
    sys.onShoutUsed = cb;
    sys.gainDragonSoul();
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    sys.equipShout("unrelenting_force");
    sys.useShout(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("success allows re-use after cooldown expires", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    sys.equipShout("unrelenting_force");
    sys.useShout(0);
    const cooldownMinutes = 2 / 60;
    const result = sys.useShout(cooldownMinutes + 0.01);
    expect(result.success).toBe(true);
  });
});

// ── Built-in shout spot-checks ────────────────────────────────────────────────

describe("DragonShoutSystem — built-in shout definitions", () => {
  const sys = new DragonShoutSystem();

  it("Unrelenting Force has correct first word", () => {
    const def = sys.getShout("unrelenting_force")!;
    expect(def.words[0]!.dragonWord).toBe("FUS");
  });

  it("Whirlwind Sprint tier 3 dash distance is 75", () => {
    const def = sys.getShout("whirlwind_sprint")!;
    expect(def.tiers[2]!.effects.dash_distance).toBe(75);
  });

  it("Slow Time tier 3 time_scale is 0.1", () => {
    const def = sys.getShout("slow_time")!;
    expect(def.tiers[2]!.effects.time_scale).toBe(0.1);
  });

  it("Clear Skies has zero cooldown side-effects only", () => {
    const def = sys.getShout("clear_skies")!;
    expect(def.tiers[0]!.cooldownSeconds).toBe(5);
  });

  it("Become Ethereal has all three tiers defined", () => {
    const def = sys.getShout("become_ethereal")!;
    expect(def.tiers[2]).toBeDefined();
  });

  it("Ice Form tier 1 freezes for 5 seconds", () => {
    const def = sys.getShout("ice_form")!;
    expect(def.tiers[0]!.effects.freeze_duration).toBe(5);
  });

  it("Elemental Fury tier 2 attack_speed_mult is 1.5", () => {
    const def = sys.getShout("elemental_fury")!;
    expect(def.tiers[1]!.effects.attack_speed_mult).toBe(1.5);
  });
});

// ── Save / restore ────────────────────────────────────────────────────────────

describe("DragonShoutSystem — getSaveState / restoreFromSave", () => {
  it("save → restore round-trips dragon souls", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(7);
    const saved = sys.getSaveState();
    const sys2  = new DragonShoutSystem();
    sys2.restoreFromSave(saved);
    expect(sys2.dragonSouls).toBe(7);
  });

  it("save → restore round-trips equipped shout", () => {
    const sys = new DragonShoutSystem();
    sys.equipShout("slow_time");
    const sys2 = new DragonShoutSystem();
    sys2.restoreFromSave(sys.getSaveState());
    expect(sys2.equippedShoutId).toBe("slow_time");
  });

  it("save → restore round-trips learned and unlocked words", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(2);
    sys.learnWord("fire_breath", 0);
    sys.learnWord("fire_breath", 1);
    sys.unlockWord("fire_breath", 0);
    sys.unlockWord("fire_breath", 1);
    const sys2 = new DragonShoutSystem();
    sys2.restoreFromSave(sys.getSaveState());
    expect(sys2.isWordLearned("fire_breath", 0)).toBe(true);
    expect(sys2.isWordLearned("fire_breath", 1)).toBe(true);
    expect(sys2.isWordUnlocked("fire_breath", 0)).toBe(true);
    expect(sys2.isWordUnlocked("fire_breath", 1)).toBe(true);
    expect(sys2.isWordUnlocked("fire_breath", 2)).toBe(false);
  });

  it("save → restore round-trips lastUsedMinutes (cooldown)", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul();
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    sys.equipShout("unrelenting_force");
    sys.useShout(100);
    const sys2 = new DragonShoutSystem();
    sys2.restoreFromSave(sys.getSaveState());
    // At same game time (100), should still be on cooldown
    expect(sys2.cooldownRemaining("unrelenting_force", 100)).toBeGreaterThan(0);
  });

  it("restore does not fire callbacks", () => {
    const sys = new DragonShoutSystem();
    sys.gainDragonSoul(3);
    sys.learnWord("unrelenting_force", 0);
    sys.unlockWord("unrelenting_force", 0);
    const saved = sys.getSaveState();

    const sys2 = new DragonShoutSystem();
    const cb   = vi.fn();
    sys2.onWordUnlocked = cb;
    sys2.onDragonSoulGained = cb;
    sys2.restoreFromSave(saved);
    expect(cb).not.toHaveBeenCalled();
  });

  it("restore ignores unknown shout ids gracefully", () => {
    const badSave: DragonShoutSaveState = {
      dragonSouls:     0,
      equippedShoutId: null,
      shoutStates: {
        nonexistent_shout: {
          learned:  [true, false, false],
          unlocked: [true, false, false],
          lastUsedMinutes: null,
        },
      },
    };
    const sys = new DragonShoutSystem();
    expect(() => sys.restoreFromSave(badSave)).not.toThrow();
  });

  it("restore with unknown equipped shout clears equipped slot", () => {
    const badSave: DragonShoutSaveState = {
      dragonSouls: 0,
      equippedShoutId: "unknown_shout",
      shoutStates: {},
    };
    const sys = new DragonShoutSystem();
    sys.restoreFromSave(badSave);
    expect(sys.equippedShoutId).toBeNull();
  });
});
