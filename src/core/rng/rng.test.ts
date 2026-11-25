import { describe, expect, it } from "vitest";

describe("fresh entropy and the cosmetic stream", () => {
  it("freshEntropy gives uint32s that differ; freshId is a short base-36 string", async () => {
    const { freshEntropy, freshId } = await import("./rng");
    const a = freshEntropy(), b = freshEntropy();
    expect(Number.isInteger(a) && a >= 0 && a <= 0xffffffff).toBe(true);
    expect(a).not.toBe(b);
    expect(freshId()).toMatch(/^[0-9a-z]{1,7}$/);
  });

  it("the cosmetic stream is seeded (the same from run to run)", async () => {
    const { Rng } = await import("./rng");
    const a = new Rng("cosmetic"), b = new Rng("cosmetic");
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });
});
