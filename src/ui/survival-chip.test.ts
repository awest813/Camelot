import { describe, expect, it } from "vitest";
import { survivalTags } from "./survival-chip";

describe("survival chip", () => {
  it("shows what matters: the bonuses, and needs past ordinary; nothing when all is ordinary", () => {
    expect(survivalTags("normal", "normal", "warm")).toEqual([]);
    expect(survivalTags("satiated", "rested", "warm").map((t) => t.text)).toEqual(["Well fed", "Rested"]);
    expect(survivalTags("starving", "tired", "freezing").map((t) => t.text)).toEqual(["Starving", "Tired", "Freezing"]);
  });
});
