import { describe, it, expect, beforeEach, vi } from "vitest";
import { JailSystem } from "./jail-system";
import { SkillProgressionSystem } from "./skill-progression-system";

// ── Minimal stubs ──────────────────────────────────────────────────────────────

function makeTimeSystem(initial = 0) {
  let time = initial;
  return {
    get currentHour() { return time; },
    advanceHours(h: number) { time += h; },
  } as any;
}

function makeCrimeSystem() {
  let cleared = false;
  return {
    clearAllBounties() { cleared = true; },
    get wasCleared() { return cleared; },
  } as any;
}

describe("JailSystem", () => {
  let js: JailSystem;

  beforeEach(() => {
    js = new JailSystem();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts with no records", () => {
    expect(js.records).toHaveLength(0);
    expect(js.totalSentences).toBe(0);
  });

  // ── serveJailTime — guard conditions ──────────────────────────────────────

  it("returns failure when bounty is 0", () => {
    const result = js.serveJailTime(0, "town");
    expect(result.ok).toBe(false);
    expect(result.hoursServed).toBe(0);
  });

  it("returns failure when bounty is negative", () => {
    const result = js.serveJailTime(-50, "town");
    expect(result.ok).toBe(false);
  });

  // ── serveJailTime — sentence calculation ──────────────────────────────────

  it("sentence length is bounty / 10, minimum 1 hour", () => {
    const result = js.serveJailTime(5, "town"); // 5/10 = 0.5 → clamped to 1
    expect(result.ok).toBe(true);
    expect(result.hoursServed).toBe(1);
  });

  it("sentence length for 100 gold is 10 hours", () => {
    const result = js.serveJailTime(100, "town");
    expect(result.hoursServed).toBe(10);
  });

  it("sentence is capped at 72 hours", () => {
    const result = js.serveJailTime(10_000, "town"); // 10000/10 = 1000 → 72
    expect(result.hoursServed).toBe(72);
  });

  // ── serveJailTime — time advance ──────────────────────────────────────────

  it("advances the time system by sentence hours", () => {
    const time = makeTimeSystem(0);
    js.serveJailTime(100, "town", time, null, null);
    expect(time.currentHour).toBe(10);
  });

  it("works without a time system (null)", () => {
    expect(() => js.serveJailTime(50, "town", null, null, null)).not.toThrow();
  });

  // ── serveJailTime — crime system ──────────────────────────────────────────

  it("clears all bounties via CrimeSystem", () => {
    const crime = makeCrimeSystem();
    js.serveJailTime(50, "town", null, null, crime);
    expect(crime.wasCleared).toBe(true);
  });

  it("works without a CrimeSystem (null)", () => {
    expect(() => js.serveJailTime(50, "town", null, null, null)).not.toThrow();
  });

  // ── serveJailTime — skill loss ─────────────────────────────────────────────

  it("reduces skill levels for long sentences", () => {
    const skills = new SkillProgressionSystem();
    // Manually set all affected skills to level 20 for a clear baseline
    (["blade","marksman","sneak","alchemy","speechcraft","destruction","restoration"] as const)
      .forEach(s => skills.setSkillLevel(s, 20));
    // 200 gold → 20 hours → 20 × 0.5 = 10 total loss, floor(10/7) = 1 per skill
    js.serveJailTime(200, "town", null, skills, null);
    expect(js.records[0].skillLoss).toBeGreaterThan(0);
  });

  it("does not reduce skills below 0", () => {
    const skills = new SkillProgressionSystem();
    // All skills start at 0; a long sentence should not go negative
    js.serveJailTime(10_000, "town", null, skills, null);
    (["blade","marksman","sneak","alchemy","speechcraft","destruction","restoration"] as const)
      .forEach(s => expect(skills.getSkill(s)!.level).toBeGreaterThanOrEqual(0));
  });

  it("reports skillLoss 0 for small bounties (< loss threshold)", () => {
    const skills = new SkillProgressionSystem();
    // 10 gold → 1 hour → 1 × 0.5 = 0.5 total loss, floor(0.5/7) = 0 per skill
    const result = js.serveJailTime(10, "town", null, skills, null);
    expect(result.skillLoss).toBe(0);
  });

  it("works without a SkillProgressionSystem (null)", () => {
    expect(() => js.serveJailTime(50, "town", null, null, null)).not.toThrow();
  });

  // ── serveJailTime — records ───────────────────────────────────────────────

  it("records the sentence after jail time served", () => {
    js.serveJailTime(100, "town");
    expect(js.records).toHaveLength(1);
    expect(js.records[0].bounty).toBe(100);
    expect(js.records[0].factionId).toBe("town");
  });

  it("accumulates multiple records", () => {
    js.serveJailTime(50, "town");
    js.serveJailTime(150, "guild");
    expect(js.totalSentences).toBe(2);
  });

  // ── message ───────────────────────────────────────────────────────────────

  it("message includes hours served", () => {
    const result = js.serveJailTime(100, "town");
    expect(result.message).toMatch(/10 hours/i);
  });

  it("message uses singular 'hour' for 1-hour sentence", () => {
    const result = js.serveJailTime(5, "town"); // → 1 hour
    expect(result.message).toMatch(/1 hour/i);
    expect(result.message).not.toMatch(/1 hours/i);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState captures records", () => {
    js.serveJailTime(80, "guild");
    const state = js.getSaveState();
    expect(state.records).toHaveLength(1);
    expect(state.records[0].factionId).toBe("guild");
  });

  it("restoreFromSave re-populates records", () => {
    js.serveJailTime(80, "guild");
    const state = js.getSaveState();
    const js2   = new JailSystem();
    js2.restoreFromSave(state);
    expect(js2.totalSentences).toBe(1);
    expect(js2.records[0].bounty).toBe(80);
  });

  it("restoreFromSave handles null gracefully", () => {
    expect(() => js.restoreFromSave(null as any)).not.toThrow();
    expect(js.records).toHaveLength(0);
  });

  it("restoreFromSave skips malformed entries", () => {
    js.restoreFromSave({ records: [{ factionId: null } as any] });
    expect(js.records).toHaveLength(0);
  });

  it("full round-trip save/restore preserves all fields", () => {
    js.serveJailTime(200, "guard_faction", null, null, null, 480);
    const state = js.getSaveState();
    const js2   = new JailSystem();
    js2.restoreFromSave(state);
    const rec = js2.records[0];
    expect(rec.bounty).toBe(200);
    expect(rec.factionId).toBe("guard_faction");
    expect(rec.hoursServed).toBe(20);
    expect(rec.timestamp).toBe(480);
  });
});
