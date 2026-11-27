import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OldTongueSystem,
  BUILTIN_SHOUTS,
  GAME_MINUTES_PER_HOUR,
} from "./old-tongue-system";
import type {
  ShoutDefinition,
  OldTongueSaveState,
  ShoutTierEffect,
} from "./old-tongue-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCustomShout(overrides: Partial<ShoutDefinition> = {}): ShoutDefinition {
  return {
    id: "test_shout",
    name: "Test Shout",
    description: "A test shout.",
    words: [
      { word: "TEST", translation: "Test" },
      { word: "ZWEI", translation: "Two"  },
      { word: "DREI", translation: "Three"},
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

describe("OldTongueSystem — initial state", () => {
  it("starts with no awen", () => {
    const sys = new OldTongueSystem();
    expect(sys.awen).toBe(0);
  });

  it("starts with no equipped shout", () => {
    const sys = new OldTongueSystem();
    expect(sys.equippedShoutId).toBeNull();
  });

  it("registers all built-in shouts on construction", () => {
    const sys = new OldTongueSystem();
    for (const def of BUILTIN_SHOUTS) {
      expect(sys.registeredShoutIds).toContain(def.id);
    }
  });

  it("registers exactly 8 built-in shouts", () => {
    const sys = new OldTongueSystem();
    expect(sys.registeredShoutIds).toHaveLength(8);
  });

  it("no word is learned or unlocked by default", () => {
    const sys = new OldTongueSystem();
    for (let i = 0; i < 3; i++) {
      expect(sys.isWordLearned("gust", i as 0 | 1 | 2)).toBe(false);
      expect(sys.isWordUnlocked("gust", i as 0 | 1 | 2)).toBe(false);
    }
  });
});

// ── registerShout / removeShout / getShout ────────────────────────────────────

describe("OldTongueSystem — registration", () => {
  it("registers a custom shout", () => {
    const sys  = new OldTongueSystem();
    const def  = makeCustomShout();
    sys.registerShout(def);
    expect(sys.registeredShoutIds).toContain("test_shout");
  });

  it("getShout returns the definition", () => {
    const sys = new OldTongueSystem();
    const def = sys.getShout("gust")!;
    expect(def.name).toBe("Gust");
  });

  it("getShout returns undefined for unknown id", () => {
    const sys = new OldTongueSystem();
    expect(sys.getShout("no_such_shout")).toBeUndefined();
  });

  it("getAllShouts returns all definitions", () => {
    const sys = new OldTongueSystem();
    const all = sys.getAllShouts();
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(all.find(s => s.id === "flame")).toBeDefined();
  });

  it("removeShout removes the shout and returns true", () => {
    const sys = new OldTongueSystem();
    sys.registerShout(makeCustomShout());
    expect(sys.removeShout("test_shout")).toBe(true);
    expect(sys.registeredShoutIds).not.toContain("test_shout");
  });

  it("removeShout returns false for unknown shout", () => {
    const sys = new OldTongueSystem();
    expect(sys.removeShout("no_such_shout")).toBe(false);
  });

  it("removeShout clears the equipped shout when the equipped one is removed", () => {
    const sys = new OldTongueSystem();
    sys.registerShout(makeCustomShout());
    sys.equipShout("test_shout");
    sys.removeShout("test_shout");
    expect(sys.equippedShoutId).toBeNull();
  });

  it("re-registering an existing id replaces the definition", () => {
    const sys = new OldTongueSystem();
    const updated = makeCustomShout({ name: "Updated Name" });
    sys.registerShout(updated);
    expect(sys.getShout("test_shout")!.name).toBe("Updated Name");
  });

  it("re-registering preserves existing word state", () => {
    const sys = new OldTongueSystem();
    sys.registerShout(makeCustomShout());
    sys.gainAwen();
    sys.learnWord("test_shout", 0);
    sys.unlockWord("test_shout", 0);
    // Re-register
    sys.registerShout(makeCustomShout({ name: "Updated" }));
    expect(sys.isWordUnlocked("test_shout", 0)).toBe(true);
  });
});

// ── Dragon souls ───────────────────────────────────────────────────────────────

describe("OldTongueSystem — awen", () => {
  it("gainAwen increments souls by 1", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    expect(sys.awen).toBe(1);
  });

  it("gainAwen(3) increments by 3", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(3);
    expect(sys.awen).toBe(3);
  });

  it("gainAwen ignores 0", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(0);
    expect(sys.awen).toBe(0);
  });

  it("onAwenGained callback fires with new total", () => {
    const sys = new OldTongueSystem();
    const cb = vi.fn();
    sys.onAwenGained = cb;
    sys.gainAwen(2);
    expect(cb).toHaveBeenCalledWith(2);
  });

  it("spendAwen deducts souls and returns true", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(5);
    expect(sys.spendAwen(3)).toBe(true);
    expect(sys.awen).toBe(2);
  });

  it("spendAwen returns false when insufficient", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(1);
    expect(sys.spendAwen(2)).toBe(false);
    expect(sys.awen).toBe(1);
  });
});

// ── Word learning ─────────────────────────────────────────────────────────────

describe("OldTongueSystem — learnWord", () => {
  it("learnWord marks the word as learned", () => {
    const sys = new OldTongueSystem();
    expect(sys.learnWord("gust", 0)).toBe(true);
    expect(sys.isWordLearned("gust", 0)).toBe(true);
  });

  it("learnWord is idempotent", () => {
    const sys = new OldTongueSystem();
    sys.learnWord("gust", 0);
    expect(sys.learnWord("gust", 0)).toBe(true);
    expect(sys.isWordLearned("gust", 0)).toBe(true);
  });

  it("learnWord returns false for unknown shout", () => {
    const sys = new OldTongueSystem();
    expect(sys.learnWord("no_such" as any, 0)).toBe(false);
  });

  it("onWordLearned callback fires on first discovery", () => {
    const sys = new OldTongueSystem();
    const cb = vi.fn();
    sys.onWordLearned = cb;
    sys.learnWord("gust", 0);
    expect(cb).toHaveBeenCalledWith("gust", 0, expect.objectContaining({ word: "GWYNT" }));
  });

  it("onWordLearned does not fire when already known", () => {
    const sys = new OldTongueSystem();
    const cb = vi.fn();
    sys.onWordLearned = cb;
    sys.learnWord("gust", 0);
    sys.learnWord("gust", 0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("learnWord returns false for invalid index", () => {
    const sys = new OldTongueSystem();
    expect(sys.learnWord("gust", 5 as any)).toBe(false);
  });
});

// ── Word unlocking ────────────────────────────────────────────────────────────

describe("OldTongueSystem — unlockWord", () => {
  it("unlockWord returns false when word not learned", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    expect(sys.unlockWord("gust", 0)).toBe(false);
  });

  it("unlockWord returns false with no awen", () => {
    const sys = new OldTongueSystem();
    sys.learnWord("gust", 0);
    expect(sys.unlockWord("gust", 0)).toBe(false);
  });

  it("unlockWord succeeds when learned and soul available", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    sys.learnWord("gust", 0);
    expect(sys.unlockWord("gust", 0)).toBe(true);
    expect(sys.isWordUnlocked("gust", 0)).toBe(true);
    expect(sys.awen).toBe(0);
  });

  it("unlockWord spends exactly one soul per unlock", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(3);
    sys.learnWord("gust", 0);
    sys.learnWord("gust", 1);
    sys.unlockWord("gust", 0);
    sys.unlockWord("gust", 1);
    expect(sys.awen).toBe(1);
  });

  it("unlockWord enforces word ordering (cannot unlock word 2 before word 1)", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(3);
    sys.learnWord("gust", 0);
    sys.learnWord("gust", 1);
    // word 0 not yet unlocked — word 1 must fail
    expect(sys.unlockWord("gust", 1)).toBe(false);
  });

  it("onWordUnlocked callback fires", () => {
    const sys = new OldTongueSystem();
    const cb  = vi.fn();
    sys.onWordUnlocked = cb;
    sys.gainAwen();
    sys.learnWord("flame", 0);
    sys.unlockWord("flame", 0);
    expect(cb).toHaveBeenCalledWith("flame", 0, expect.objectContaining({ word: "TÂN" }));
  });

  it("unlockWord is idempotent when already unlocked", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(2);
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    // second call — no more soul cost
    const result = sys.unlockWord("gust", 0);
    expect(result).toBe(true);
    expect(sys.awen).toBe(1); // only one soul spent total
  });

  it("getUnlockedTier reflects unlocked word count", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(3);
    sys.learnWord("gust", 0);
    sys.learnWord("gust", 1);
    sys.learnWord("gust", 2);
    expect(sys.getUnlockedTier("gust")).toBe(0);
    sys.unlockWord("gust", 0);
    expect(sys.getUnlockedTier("gust")).toBe(1);
    sys.unlockWord("gust", 1);
    expect(sys.getUnlockedTier("gust")).toBe(2);
    sys.unlockWord("gust", 2);
    expect(sys.getUnlockedTier("gust")).toBe(3);
  });
});

// ── Equipping ─────────────────────────────────────────────────────────────────

describe("OldTongueSystem — equipShout / unequipShout", () => {
  it("equipShout returns true for a registered shout", () => {
    const sys = new OldTongueSystem();
    expect(sys.equipShout("gust")).toBe(true);
    expect(sys.equippedShoutId).toBe("gust");
  });

  it("equipShout returns false for unknown shout", () => {
    const sys = new OldTongueSystem();
    expect(sys.equipShout("no_such_shout")).toBe(false);
    expect(sys.equippedShoutId).toBeNull();
  });

  it("unequipShout clears the equipped shout", () => {
    const sys = new OldTongueSystem();
    sys.equipShout("gust");
    sys.unequipShout();
    expect(sys.equippedShoutId).toBeNull();
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────

describe("OldTongueSystem — cooldown", () => {
  it("cooldownRemaining is 0 when shout has never been used", () => {
    const sys = new OldTongueSystem();
    expect(sys.cooldownRemaining("gust", 0)).toBe(0);
  });

  it("cooldownRemaining returns remaining seconds after use", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(3);
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    sys.equipShout("gust");
    sys.useShout(0);

    // Tier 1 cooldown = 2 s → 2/60 minutes
    // After 1 second has passed (1/60 minute), ~1 second remains
    const afterOneSecond = 1 / 60;
    const remaining = sys.cooldownRemaining("gust", afterOneSecond);
    expect(remaining).toBeCloseTo(1, 0);
  });

  it("cooldownRemaining returns 0 after full cooldown elapsed", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    sys.equipShout("gust");
    sys.useShout(0);

    const cooldownMinutes = 2 / 60; // 2 second cooldown in minutes
    expect(sys.cooldownRemaining("gust", cooldownMinutes + 0.001)).toBe(0);
  });

  it("isShoutReady returns false when no shout equipped", () => {
    const sys = new OldTongueSystem();
    expect(sys.isShoutReady(0)).toBe(false);
  });

  it("isShoutReady returns false when no words unlocked", () => {
    const sys = new OldTongueSystem();
    sys.equipShout("gust");
    expect(sys.isShoutReady(0)).toBe(false);
  });

  it("isShoutReady returns true when equipped and off cooldown", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    sys.equipShout("gust");
    expect(sys.isShoutReady(0)).toBe(true);
  });

  it("isShoutReady returns false while on cooldown", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    sys.equipShout("gust");
    sys.useShout(0);
    expect(sys.isShoutReady(0)).toBe(false);
  });
});

// ── useShout ──────────────────────────────────────────────────────────────────

describe("OldTongueSystem — useShout", () => {
  it("returns failure when no shout is equipped", () => {
    const sys = new OldTongueSystem();
    const result = sys.useShout(0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("no_shout_equipped");
  });

  it("returns failure when no words are unlocked", () => {
    const sys = new OldTongueSystem();
    sys.equipShout("gust");
    const result = sys.useShout(0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("no_words_unlocked");
  });

  it("returns on_cooldown while shout is recharging", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    sys.equipShout("gust");
    sys.useShout(0);
    const result = sys.useShout(0);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("on_cooldown");
      expect(result.cooldownRemainingSeconds).toBeGreaterThan(0);
    }
  });

  it("returns success with tier 1 when only first word is unlocked", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    sys.learnWord("flame", 0);
    sys.unlockWord("flame", 0);
    sys.equipShout("flame");
    const result = sys.useShout(0);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.wordCount).toBe(1);
      expect(result.tier.effects.fire_damage).toBe(25);
    }
  });

  it("returns success with tier 3 when all three words are unlocked", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(3);
    for (let i = 0; i < 3; i++) {
      sys.learnWord("flame", i as 0 | 1 | 2);
      sys.unlockWord("flame", i as 0 | 1 | 2);
    }
    sys.equipShout("flame");
    const result = sys.useShout(0);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.wordCount).toBe(3);
      expect(result.tier.effects.fire_damage).toBe(80);
    }
  });

  it("onShoutUsed callback fires on successful use", () => {
    const sys = new OldTongueSystem();
    const cb  = vi.fn();
    sys.onShoutUsed = cb;
    sys.gainAwen();
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    sys.equipShout("gust");
    sys.useShout(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("success allows re-use after cooldown expires", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    sys.equipShout("gust");
    sys.useShout(0);
    const cooldownMinutes = 2 / 60;
    const result = sys.useShout(cooldownMinutes + 0.01);
    expect(result.success).toBe(true);
  });
});

// ── Built-in shout spot-checks ────────────────────────────────────────────────

describe("OldTongueSystem — built-in shout definitions", () => {
  const sys = new OldTongueSystem();

  it("Gust has correct first word", () => {
    const def = sys.getShout("gust")!;
    expect(def.words[0]!.word).toBe("GWYNT");
  });

  it("Swift Feet tier 3 dash distance is 75", () => {
    const def = sys.getShout("swift_feet")!;
    expect(def.tiers[2]!.effects.dash_distance).toBe(75);
  });

  it("Held Moment tier 3 time_scale is 0.1", () => {
    const def = sys.getShout("held_moment")!;
    expect(def.tiers[2]!.effects.time_scale).toBe(0.1);
  });

  it("Clear Sky has zero cooldown side-effects only", () => {
    const def = sys.getShout("clear_sky")!;
    expect(def.tiers[0]!.cooldownSeconds).toBe(5);
  });

  it("Shade-step has all three tiers defined", () => {
    const def = sys.getShout("shade_step")!;
    expect(def.tiers[2]).toBeDefined();
  });

  it("Hoarfrost tier 1 freezes for 5 seconds", () => {
    const def = sys.getShout("hoarfrost")!;
    expect(def.tiers[0]!.effects.freeze_duration).toBe(5);
  });

  it("Battle-wind tier 2 attack_speed_mult is 1.5", () => {
    const def = sys.getShout("battle_wind")!;
    expect(def.tiers[1]!.effects.attack_speed_mult).toBe(1.5);
  });
});

// ── Save / restore ────────────────────────────────────────────────────────────

describe("OldTongueSystem — getSaveState / restoreFromSave", () => {
  it("save → restore round-trips awen", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(7);
    const saved = sys.getSaveState();
    const sys2  = new OldTongueSystem();
    sys2.restoreFromSave(saved);
    expect(sys2.awen).toBe(7);
  });

  it("save → restore round-trips equipped shout", () => {
    const sys = new OldTongueSystem();
    sys.equipShout("held_moment");
    const sys2 = new OldTongueSystem();
    sys2.restoreFromSave(sys.getSaveState());
    expect(sys2.equippedShoutId).toBe("held_moment");
  });

  it("save → restore round-trips learned and unlocked words", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(2);
    sys.learnWord("flame", 0);
    sys.learnWord("flame", 1);
    sys.unlockWord("flame", 0);
    sys.unlockWord("flame", 1);
    const sys2 = new OldTongueSystem();
    sys2.restoreFromSave(sys.getSaveState());
    expect(sys2.isWordLearned("flame", 0)).toBe(true);
    expect(sys2.isWordLearned("flame", 1)).toBe(true);
    expect(sys2.isWordUnlocked("flame", 0)).toBe(true);
    expect(sys2.isWordUnlocked("flame", 1)).toBe(true);
    expect(sys2.isWordUnlocked("flame", 2)).toBe(false);
  });

  it("save → restore round-trips lastUsedMinutes (cooldown)", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen();
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    sys.equipShout("gust");
    sys.useShout(100);
    const sys2 = new OldTongueSystem();
    sys2.restoreFromSave(sys.getSaveState());
    // At same game time (100), should still be on cooldown
    expect(sys2.cooldownRemaining("gust", 100)).toBeGreaterThan(0);
  });

  it("restore does not fire callbacks", () => {
    const sys = new OldTongueSystem();
    sys.gainAwen(3);
    sys.learnWord("gust", 0);
    sys.unlockWord("gust", 0);
    const saved = sys.getSaveState();

    const sys2 = new OldTongueSystem();
    const cb   = vi.fn();
    sys2.onWordUnlocked = cb;
    sys2.onAwenGained = cb;
    sys2.restoreFromSave(saved);
    expect(cb).not.toHaveBeenCalled();
  });

  it("restore ignores unknown shout ids gracefully", () => {
    const badSave: OldTongueSaveState = {
      awen:     0,
      equippedShoutId: null,
      shoutStates: {
        nonexistent_shout: {
          learned:  [true, false, false],
          unlocked: [true, false, false],
          lastUsedMinutes: null,
        },
      },
    };
    const sys = new OldTongueSystem();
    expect(() => sys.restoreFromSave(badSave)).not.toThrow();
  });

  it("restore with unknown equipped shout clears equipped slot", () => {
    const badSave: OldTongueSaveState = {
      awen: 0,
      equippedShoutId: "unknown_shout",
      shoutStates: {},
    };
    const sys = new OldTongueSystem();
    sys.restoreFromSave(badSave);
    expect(sys.equippedShoutId).toBeNull();
  });
});

describe("OldTongueSystem — saves from before the rename", () => {
  it("reads awen saved as dragonSouls", () => {
    const sys = new OldTongueSystem();
    sys.restoreFromSave({ dragonSouls: 4, equippedShoutId: null, shoutStates: {} } as never);
    expect(sys.awen).toBe(4);
  });
});
