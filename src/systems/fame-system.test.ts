import { describe, it, expect, beforeEach, vi } from "vitest";
import { FameSystem, FAME_MAX } from "./fame-system";

describe("FameSystem", () => {
  let fs: FameSystem;

  beforeEach(() => {
    fs = new FameSystem();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts with zero fame and infamy", () => {
    expect(fs.fame).toBe(0);
    expect(fs.infamy).toBe(0);
  });

  it("starts with neutral disposition modifier", () => {
    expect(fs.dispositionModifier).toBe(0);
  });

  it("starts with Unknown fame label", () => {
    expect(fs.fameLabel).toBe("Unknown");
  });

  it("starts with Clean infamy label", () => {
    expect(fs.infamyLabel).toBe("Clean");
  });

  // ── addFame ────────────────────────────────────────────────────────────────

  it("addFame increases fame", () => {
    fs.addFame(50);
    expect(fs.fame).toBe(50);
  });

  it("addFame caps at FAME_MAX", () => {
    fs.addFame(FAME_MAX + 999);
    expect(fs.fame).toBe(FAME_MAX);
  });

  it("addFame ignores zero and negative amounts", () => {
    fs.addFame(0);
    fs.addFame(-10);
    expect(fs.fame).toBe(0);
  });

  it("addFame fires onFameChange callback", () => {
    const cb = vi.fn();
    fs.onFameChange = cb;
    fs.addFame(10);
    expect(cb).toHaveBeenCalledWith(10, 0);
  });

  // ── addInfamy ──────────────────────────────────────────────────────────────

  it("addInfamy increases infamy", () => {
    fs.addInfamy(30);
    expect(fs.infamy).toBe(30);
  });

  it("addInfamy caps at FAME_MAX", () => {
    fs.addInfamy(FAME_MAX + 1);
    expect(fs.infamy).toBe(FAME_MAX);
  });

  it("addInfamy ignores zero and negative amounts", () => {
    fs.addInfamy(-5);
    expect(fs.infamy).toBe(0);
  });

  it("addInfamy fires onFameChange callback", () => {
    const cb = vi.fn();
    fs.onFameChange = cb;
    fs.addInfamy(20);
    expect(cb).toHaveBeenCalledWith(0, 20);
  });

  // ── netFame ────────────────────────────────────────────────────────────────

  it("netFame is fame minus infamy", () => {
    fs.addFame(100);
    fs.addInfamy(30);
    expect(fs.netFame).toBe(70);
  });

  it("netFame is negative when infamy exceeds fame", () => {
    fs.addInfamy(80);
    expect(fs.netFame).toBe(-80);
  });

  // ── dispositionModifier ───────────────────────────────────────────────────

  it("returns positive disposition when fame > infamy", () => {
    fs.addFame(200); // net = +200 → max positive
    expect(fs.dispositionModifier).toBeGreaterThan(0);
  });

  it("returns negative disposition when infamy > fame", () => {
    fs.addInfamy(200);
    expect(fs.dispositionModifier).toBeLessThan(0);
  });

  it("dispositionModifier magnitude is capped at 20", () => {
    fs.addFame(FAME_MAX);
    expect(Math.abs(fs.dispositionModifier)).toBeLessThanOrEqual(20);
  });

  it("dispositionModifier saturates at net 200 fame", () => {
    fs.addFame(200);
    const mod200 = fs.dispositionModifier;
    fs.addFame(800); // well above saturation
    expect(fs.dispositionModifier).toBe(mod200); // capped at same value
  });

  // ── fameLabel ─────────────────────────────────────────────────────────────

  it("fameLabel progresses through tiers", () => {
    fs.addFame(10);
    expect(fs.fameLabel).toBe("Emerging");
    fs.addFame(40);
    expect(fs.fameLabel).toBe("Known");
    fs.addFame(100);
    expect(fs.fameLabel).toBe("Respected");
  });

  it("fameLabel shows Legendary Hero at 800+", () => {
    fs.addFame(800);
    expect(fs.fameLabel).toBe("Legendary Hero");
  });

  // ── infamyLabel ───────────────────────────────────────────────────────────

  it("infamyLabel progresses through tiers", () => {
    fs.addInfamy(10);
    expect(fs.infamyLabel).toBe("Shady");
    fs.addInfamy(40);
    expect(fs.infamyLabel).toBe("Suspect");
  });

  it("infamyLabel shows Most Wanted at 800+", () => {
    fs.addInfamy(800);
    expect(fs.infamyLabel).toBe("Most Wanted");
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState captures fame and infamy", () => {
    fs.addFame(42);
    fs.addInfamy(17);
    const state = fs.getSaveState();
    expect(state.fame).toBe(42);
    expect(state.infamy).toBe(17);
  });

  it("restoreFromSave re-populates values", () => {
    const fs2 = new FameSystem();
    fs2.restoreFromSave({ fame: 99, infamy: 55 });
    expect(fs2.fame).toBe(99);
    expect(fs2.infamy).toBe(55);
  });

  it("restoreFromSave handles null gracefully", () => {
    expect(() => fs.restoreFromSave(null as any)).not.toThrow();
    expect(fs.fame).toBe(0);
  });

  it("restoreFromSave clamps out-of-range values", () => {
    fs.restoreFromSave({ fame: -100, infamy: FAME_MAX + 999 });
    expect(fs.fame).toBe(0);
    expect(fs.infamy).toBe(FAME_MAX);
  });

  it("full round-trip save/restore preserves values", () => {
    fs.addFame(123);
    fs.addInfamy(456);
    const state = fs.getSaveState();
    const fs2   = new FameSystem();
    fs2.restoreFromSave(state);
    expect(fs2.fame).toBe(123);
    expect(fs2.infamy).toBe(456);
  });
});
