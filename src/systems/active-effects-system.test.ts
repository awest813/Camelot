import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActiveEffectsSystem } from "./active-effects-system";
import type { AffectablePlayer } from "./active-effects-system";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePlayer(
  overrides: Partial<AffectablePlayer> = {},
): AffectablePlayer {
  return {
    health:      100,
    maxHealth:   100,
    magicka:     80,
    maxMagicka:  80,
    stamina:     60,
    maxStamina:  60,
    ...overrides,
  };
}

describe("ActiveEffectsSystem", () => {
  let aes: ActiveEffectsSystem;

  beforeEach(() => {
    aes = new ActiveEffectsSystem();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts with no active effects", () => {
    expect(aes.activeEffects).toHaveLength(0);
  });

  it("isSilenced is false with no effects", () => {
    expect(aes.isSilenced).toBe(false);
  });

  // ── addEffect ──────────────────────────────────────────────────────────────

  it("addEffect registers a new effect", () => {
    aes.addEffect({ id: "e1", name: "Heal", effectType: "health_restore", magnitude: 5, duration: 10 });
    expect(aes.activeEffects).toHaveLength(1);
    expect(aes.activeEffects[0].name).toBe("Heal");
  });

  it("addEffect refreshes duration if effect already exists", () => {
    aes.addEffect({ id: "e1", name: "Heal", effectType: "health_restore", magnitude: 5, duration: 10 });
    aes.addEffect({ id: "e1", name: "Heal", effectType: "health_restore", magnitude: 5, duration: 20 });
    expect(aes.activeEffects).toHaveLength(1);
    expect(aes.activeEffects[0].duration).toBe(20);
  });

  it("addEffect stores totalDuration from duration when not provided", () => {
    aes.addEffect({ id: "e2", name: "X", effectType: "silence", magnitude: 1, duration: 15 });
    expect(aes.getEffect("e2")!.totalDuration).toBe(15);
  });

  it("addEffect stores explicit totalDuration when provided", () => {
    aes.addEffect({ id: "e3", name: "Y", effectType: "silence", magnitude: 1, duration: 5, totalDuration: 30 });
    expect(aes.getEffect("e3")!.totalDuration).toBe(30);
  });

  // ── removeEffect ──────────────────────────────────────────────────────────

  it("removeEffect deletes the effect", () => {
    aes.addEffect({ id: "e1", name: "X", effectType: "silence", magnitude: 1, duration: 10 });
    aes.removeEffect("e1");
    expect(aes.activeEffects).toHaveLength(0);
  });

  it("removeEffect is a no-op for unknown ids", () => {
    expect(() => aes.removeEffect("nope")).not.toThrow();
  });

  // ── getEffect ─────────────────────────────────────────────────────────────

  it("getEffect returns undefined for unknown id", () => {
    expect(aes.getEffect("none")).toBeUndefined();
  });

  it("getEffect returns effect data", () => {
    aes.addEffect({ id: "fx1", name: "Fire", effectType: "fire_damage", magnitude: 3, duration: 5 });
    const e = aes.getEffect("fx1");
    expect(e).toBeDefined();
    expect(e!.effectType).toBe("fire_damage");
  });

  // ── totalMagnitude ────────────────────────────────────────────────────────

  it("totalMagnitude sums magnitudes for matching type", () => {
    aes.addEffect({ id: "r1", name: "R1", effectType: "resist_damage", magnitude: 10, duration: 30 });
    aes.addEffect({ id: "r2", name: "R2", effectType: "resist_damage", magnitude: 15, duration: 30 });
    expect(aes.totalMagnitude("resist_damage")).toBe(25);
  });

  it("totalMagnitude returns 0 when no matching effects", () => {
    expect(aes.totalMagnitude("burden")).toBe(0);
  });

  // ── isSilenced ────────────────────────────────────────────────────────────

  it("isSilenced returns true when silence effect is active", () => {
    aes.addEffect({ id: "sil", name: "Silence", effectType: "silence", magnitude: 1, duration: 5 });
    expect(aes.isSilenced).toBe(true);
  });

  it("isSilenced returns false after silence effect expires", () => {
    aes.addEffect({ id: "sil", name: "Silence", effectType: "silence", magnitude: 1, duration: 1 });
    aes.update(2, makePlayer()); // advance past duration
    expect(aes.isSilenced).toBe(false);
  });

  // ── update — health_restore ────────────────────────────────────────────────

  it("update restores health over time", () => {
    const player = makePlayer({ health: 50 });
    aes.addEffect({ id: "hr", name: "Heal", effectType: "health_restore", magnitude: 10, duration: 5 });
    aes.update(1, player);
    expect(player.health).toBeCloseTo(60);
  });

  it("update does not restore health beyond maxHealth", () => {
    const player = makePlayer({ health: 95 });
    aes.addEffect({ id: "hr", name: "Heal", effectType: "health_restore", magnitude: 20, duration: 5 });
    aes.update(1, player);
    expect(player.health).toBe(100);
  });

  // ── update — magicka_restore ───────────────────────────────────────────────

  it("update restores magicka over time", () => {
    const player = makePlayer({ magicka: 20 });
    aes.addEffect({ id: "mr", name: "Mag Restore", effectType: "magicka_restore", magnitude: 10, duration: 3 });
    aes.update(1, player);
    expect(player.magicka).toBeCloseTo(30);
  });

  // ── update — fire_damage ───────────────────────────────────────────────────

  it("update applies fire damage over time", () => {
    const player = makePlayer({ health: 100 });
    aes.addEffect({ id: "fd", name: "Burn", effectType: "fire_damage", magnitude: 10, duration: 3 });
    aes.update(1, player);
    expect(player.health).toBeCloseTo(90);
  });

  it("update does not lower health below 0 from DoT", () => {
    const player = makePlayer({ health: 5 });
    aes.addEffect({ id: "fd", name: "Burn", effectType: "fire_damage", magnitude: 100, duration: 3 });
    aes.update(1, player);
    expect(player.health).toBe(0);
  });

  // ── update — expiry ────────────────────────────────────────────────────────

  it("removes expired finite effects after their duration", () => {
    aes.addEffect({ id: "short", name: "S", effectType: "silence", magnitude: 1, duration: 1 });
    aes.update(1.1, makePlayer());
    expect(aes.activeEffects).toHaveLength(0);
  });

  it("fires onEffectExpired for expired effects", () => {
    const cb = vi.fn();
    aes.onEffectExpired = cb;
    aes.addEffect({ id: "short", name: "S", effectType: "silence", magnitude: 1, duration: 0.5 });
    aes.update(1, makePlayer());
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].id).toBe("short");
  });

  it("keeps infinite-duration effects across many updates", () => {
    aes.addEffect({ id: "inf", name: "Inf", effectType: "fortify_health", magnitude: 50, duration: Infinity });
    aes.update(1000, makePlayer());
    expect(aes.activeEffects).toHaveLength(1);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState captures finite effects", () => {
    aes.addEffect({ id: "e1", name: "Heal", effectType: "health_restore", magnitude: 5, duration: 10 });
    const state = aes.getSaveState();
    expect(state.effects).toHaveLength(1);
    expect(state.effects[0].id).toBe("e1");
  });

  it("getSaveState excludes infinite-duration effects", () => {
    aes.addEffect({ id: "inf", name: "I", effectType: "fortify_health", magnitude: 10, duration: Infinity });
    const state = aes.getSaveState();
    expect(state.effects).toHaveLength(0);
  });

  it("restoreFromSave re-populates effects", () => {
    aes.addEffect({ id: "e2", name: "Burn", effectType: "fire_damage", magnitude: 3, duration: 8 });
    const state = aes.getSaveState();
    const aes2  = new ActiveEffectsSystem();
    aes2.restoreFromSave(state);
    expect(aes2.activeEffects).toHaveLength(1);
    expect(aes2.activeEffects[0].name).toBe("Burn");
  });

  it("restoreFromSave handles null gracefully", () => {
    expect(() => aes.restoreFromSave(null as any)).not.toThrow();
    expect(aes.activeEffects).toHaveLength(0);
  });

  it("restoreFromSave skips entries with expired duration (duration <= 0)", () => {
    aes.restoreFromSave({
      effects: [
        { id: "x", name: "X", effectType: "silence", magnitude: 1, duration: 0, totalDuration: 5 },
      ],
    });
    expect(aes.activeEffects).toHaveLength(0);
  });

  it("restoreFromSave skips malformed entries", () => {
    aes.restoreFromSave({
      effects: [{ id: null, name: "bad" } as any],
    });
    expect(aes.activeEffects).toHaveLength(0);
  });

  it("full round-trip save/restore preserves effect data", () => {
    aes.addEffect({ id: "dot", name: "Frost", effectType: "frost_damage", magnitude: 7, duration: 12 });
    const state = aes.getSaveState();
    const aes2  = new ActiveEffectsSystem();
    aes2.restoreFromSave(state);
    const e = aes2.getEffect("dot");
    expect(e).toBeDefined();
    expect(e!.magnitude).toBe(7);
    expect(e!.duration).toBe(12);
  });
});
