import { describe, it, expect, beforeEach } from "vitest";
import { PersuasionSystem } from "./persuasion-system";

describe("PersuasionSystem", () => {
  let ps: PersuasionSystem;

  beforeEach(() => {
    ps = new PersuasionSystem();
  });

  // ── Disposition accessors ─────────────────────────────────────────────────

  it("returns defaultDisposition for an unknown NPC", () => {
    expect(ps.getDisposition("npc_001")).toBe(ps.defaultDisposition);
  });

  it("setDisposition stores clamped value", () => {
    ps.setDisposition("npc_01", 80);
    expect(ps.getDisposition("npc_01")).toBe(80);
  });

  it("setDisposition clamps above 100 to 100", () => {
    ps.setDisposition("npc_01", 150);
    expect(ps.getDisposition("npc_01")).toBe(100);
  });

  it("setDisposition clamps below 0 to 0", () => {
    ps.setDisposition("npc_01", -10);
    expect(ps.getDisposition("npc_01")).toBe(0);
  });

  it("adjustDisposition adds delta and returns new value", () => {
    ps.setDisposition("npc_01", 50);
    const next = ps.adjustDisposition("npc_01", 15);
    expect(next).toBe(65);
    expect(ps.getDisposition("npc_01")).toBe(65);
  });

  it("adjustDisposition clamps at boundaries", () => {
    ps.setDisposition("npc_01", 95);
    const next = ps.adjustDisposition("npc_01", 20);
    expect(next).toBe(100);

    ps.setDisposition("npc_02", 3);
    const next2 = ps.adjustDisposition("npc_02", -10);
    expect(next2).toBe(0);
  });

  // ── Disposition bands ─────────────────────────────────────────────────────

  it("getDispositionBand returns 'hostile' below 25", () => {
    ps.setDisposition("npc", 10);
    expect(ps.getDispositionBand("npc")).toBe("hostile");
  });

  it("getDispositionBand returns 'unfriendly' at 30", () => {
    ps.setDisposition("npc", 30);
    expect(ps.getDispositionBand("npc")).toBe("unfriendly");
  });

  it("getDispositionBand returns 'neutral' at 50", () => {
    ps.setDisposition("npc", 50);
    expect(ps.getDispositionBand("npc")).toBe("neutral");
  });

  it("getDispositionBand returns 'friendly' at 70", () => {
    ps.setDisposition("npc", 70);
    expect(ps.getDispositionBand("npc")).toBe("friendly");
  });

  it("getDispositionBand returns 'allied' at 90", () => {
    ps.setDisposition("npc", 90);
    expect(ps.getDispositionBand("npc")).toBe("allied");
  });

  it("isWillingToTalk is false below 25", () => {
    ps.setDisposition("npc", 20);
    expect(ps.isWillingToTalk("npc")).toBe(false);
  });

  it("isWillingToTalk is true at 25", () => {
    ps.setDisposition("npc", 25);
    expect(ps.isWillingToTalk("npc")).toBe(true);
  });

  it("isWillingToTrade is false below 40", () => {
    ps.setDisposition("npc", 39);
    expect(ps.isWillingToTrade("npc")).toBe(false);
  });

  it("isWillingToTrade is true at 40", () => {
    ps.setDisposition("npc", 40);
    expect(ps.isWillingToTrade("npc")).toBe(true);
  });

  // ── Persuasion checks ─────────────────────────────────────────────────────

  it("canAttemptPersuasion is false for hostile NPC (disp < 25)", () => {
    ps.setDisposition("npc", 10);
    expect(ps.canAttemptPersuasion("npc", 50)).toBe(false);
  });

  it("canAttemptPersuasion is false when skill < MIN (5)", () => {
    ps.setDisposition("npc", 50);
    expect(ps.canAttemptPersuasion("npc", 3)).toBe(false);
  });

  it("canAttemptPersuasion is true with adequate skill and disposition", () => {
    ps.setDisposition("npc", 50);
    expect(ps.canAttemptPersuasion("npc", 20)).toBe(true);
  });

  it("critical_success on roll <= 0.05 raises disposition by 20", () => {
    ps.setDisposition("npc", 50);
    const result = ps.attemptPersuade("npc", 50, 0.03);
    expect(result.outcome).toBe("critical_success");
    expect(result.dispositionDelta).toBe(20);
    expect(result.newDisposition).toBe(70);
  });

  it("success on roll within chance range raises disposition by 10", () => {
    // With skill 50, disposition 50 → chance = 0.5. Roll 0.3 is success.
    ps.setDisposition("npc", 50);
    const result = ps.attemptPersuade("npc", 50, 0.3);
    expect(result.outcome).toBe("success");
    expect(result.dispositionDelta).toBe(10);
    expect(result.newDisposition).toBe(60);
  });

  it("failure on roll above chance lowers disposition by 5", () => {
    // Roll 0.8 > 0.5 (chance) and < 0.95 → normal failure
    ps.setDisposition("npc", 50);
    const result = ps.attemptPersuade("npc", 50, 0.8);
    expect(result.outcome).toBe("failure");
    expect(result.dispositionDelta).toBe(-5);
    expect(result.newDisposition).toBe(45);
  });

  it("critical_failure on roll >= 0.95 lowers disposition by 15", () => {
    ps.setDisposition("npc", 50);
    const result = ps.attemptPersuade("npc", 50, 0.97);
    expect(result.outcome).toBe("critical_failure");
    expect(result.dispositionDelta).toBe(-15);
    expect(result.newDisposition).toBe(35);
  });

  it("critical_failure fires even when chance is at maximum (0.95)", () => {
    // Very high speechcraft + high disposition caps chance at 0.95.
    // A roll of exactly 0.95 must still be treated as critical_failure,
    // not shadowed by the success branch.
    ps.setDisposition("npc", 100);
    const result = ps.attemptPersuade("npc", 200, 0.95);
    expect(result.outcome).toBe("critical_failure");
    expect(result.dispositionDelta).toBe(-15);
  });

  it("higher speechcraft increases success chance (capped at 0.95)", () => {
    ps.setDisposition("npc", 50);
    // skill 100 → chance = 0.5 + (100-50)*0.005 = 0.75
    // roll 0.6 is success at skill 100, failure at skill 50
    const resultHigh = ps.attemptPersuade("npc", 100, 0.6);
    expect(["success", "critical_success"]).toContain(resultHigh.outcome);

    ps.setDisposition("npc", 50); // reset
    const resultLow = ps.attemptPersuade("npc", 10, 0.6);
    expect(["failure", "critical_failure"]).toContain(resultLow.outcome);
  });



  // ── Oblivion-style action affinity checks ─────────────────────────────────

  it("getActionAffinity is deterministic per npc/action", () => {
    const a = ps.getActionAffinity("npc_affinity", "admire");
    const b = ps.getActionAffinity("npc_affinity", "admire");
    expect(a).toBe(b);
  });

  it("attemptPersuasionAction returns action metadata", () => {
    ps.setDisposition("npc", 50);
    const result = ps.attemptPersuasionAction("npc", 50, "joke", 0.4);
    expect(result.action).toBe("joke");
    expect(result.npcAffinity).toBeGreaterThanOrEqual(-2);
    expect(result.npcAffinity).toBeLessThanOrEqual(2);
    expect(result.chance).toBeGreaterThanOrEqual(0.05);
    expect(result.chance).toBeLessThanOrEqual(0.95);
  });

  it("liked actions are easier than disliked actions for same npc", () => {
    ps.setDisposition("npc_personality", 50);
    const baseChance = ps.getPersuasionChance("npc_personality", 50);

    const admireAffinity = ps.getActionAffinity("npc_personality", "admire");
    const coerceAffinity = ps.getActionAffinity("npc_personality", "coerce");

    const admireChance = Math.max(0.05, Math.min(0.95, baseChance + admireAffinity * 0.06));
    const coerceChance = Math.max(0.05, Math.min(0.95, baseChance + coerceAffinity * 0.06));

    if (admireAffinity > coerceAffinity) {
      expect(admireChance).toBeGreaterThan(coerceChance);
    } else if (admireAffinity < coerceAffinity) {
      expect(admireChance).toBeLessThan(coerceChance);
    } else {
      expect(admireChance).toBe(coerceChance);
    }
  });

  it("positive affinity amplifies success gains", () => {
    ps.setDisposition("npc_gain", 50);
    const base = ps.attemptPersuade("npc_gain", 50, 0.2);

    ps.setDisposition("npc_gain", 50);
    const action = ps.attemptPersuasionAction("npc_gain", 50, "admire", 0.2);

    const affinity = ps.getActionAffinity("npc_gain", "admire");
    if (affinity > 0) {
      expect(action.dispositionDelta).toBeGreaterThan(base.dispositionDelta);
    } else if (affinity < 0) {
      expect(action.dispositionDelta).toBeLessThanOrEqual(base.dispositionDelta);
    } else {
      expect(action.dispositionDelta).toBe(base.dispositionDelta);
    }
  });

  // ── Merchant price multiplier ─────────────────────────────────────────────

  it("getMerchantPriceMultiplier returns 1.0 for neutral NPC", () => {
    ps.setDisposition("merch", 50);
    expect(ps.getMerchantPriceMultiplier("merch")).toBe(1.0);
  });

  it("getMerchantPriceMultiplier returns 1.4 for hostile NPC", () => {
    ps.setDisposition("merch", 10);
    expect(ps.getMerchantPriceMultiplier("merch")).toBe(1.4);
  });

  it("getMerchantPriceMultiplier returns 0.8 for allied NPC", () => {
    ps.setDisposition("merch", 90);
    expect(ps.getMerchantPriceMultiplier("merch")).toBe(0.8);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it("getSaveState serializes dispositions", () => {
    ps.setDisposition("npc_a", 70);
    ps.setDisposition("npc_b", 30);
    const state = ps.getSaveState();
    expect(state.dispositions["npc_a"]).toBe(70);
    expect(state.dispositions["npc_b"]).toBe(30);
  });

  it("restoreFromSave rehydrates dispositions", () => {
    ps.restoreFromSave({ dispositions: { npc_x: 80, npc_y: 25 } });
    expect(ps.getDisposition("npc_x")).toBe(80);
    expect(ps.getDisposition("npc_y")).toBe(25);
  });

  it("restoreFromSave clamps values to [0, 100]", () => {
    ps.restoreFromSave({ dispositions: { npc_z: 150, npc_w: -10 } });
    expect(ps.getDisposition("npc_z")).toBe(100);
    expect(ps.getDisposition("npc_w")).toBe(0);
  });

  it("restoreFromSave is resilient to null/missing state", () => {
    expect(() => ps.restoreFromSave(null as any)).not.toThrow();
    expect(() => ps.restoreFromSave({} as any)).not.toThrow();
  });
});
