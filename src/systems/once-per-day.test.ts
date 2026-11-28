import { describe, it, expect } from "vitest";
import { OncePerDay } from "./once-per-day";

describe("OncePerDay", () => {
  it("once per key per game day", () => {
    const once = new OncePerDay();
    expect(once.take("Smith", 60)).toBe(true);
    expect(once.take("Smith", 600), "same day").toBe(false);
    expect(once.take("Baker", 600), "another key").toBe(true);
    expect(once.take("Smith", 24 * 60 + 5), "next day").toBe(true);
  });
});
