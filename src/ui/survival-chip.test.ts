import { describe, expect, it } from "vitest";
import { survivalTags } from "./survival-chip";

describe("survival chip", () => {
  it("shows what matters: the bonuses, and needs past ordinary; nothing when all is ordinary", () => {
    expect(survivalTags("normal", "normal", "warm")).toEqual([]);
    expect(survivalTags("satiated", "rested", "warm").map((t) => t.text)).toEqual(["Well fed", "Rested"]);
    expect(survivalTags("starving", "tired", "freezing").map((t) => t.text)).toEqual(["Starving", "Tired", "Freezing"]);
  });
});

describe("survival chip — ailments", () => {
  it("a carried disease shows by name", async () => {
    const { SurvivalChip } = await import("./survival-chip");
    const chip = new SurvivalChip();
    chip.update("normal", "normal", "warm", ["Marsh Ague"]);
    const el = document.querySelector(".survival-chip") as HTMLElement;
    expect(el.textContent).toContain("Marsh Ague");
    expect(el.style.display).toBe("flex");
    chip.update("normal", "normal", "warm", []);
    expect(el.style.display).toBe("none");
  });
});

describe("statusChip", () => {
  it("shows its text, hides on null", async () => {
    const { statusChip } = await import("./hud-chips");
    const chip = statusChip(0, "Bounty on your head");
    chip.set("⚖ Wanted: 40g bounty");
    const el = document.querySelector('[aria-label="Bounty on your head"]') as HTMLElement;
    expect(el.textContent).toBe("⚖ Wanted: 40g bounty");
    chip.set(null);
    expect(el.style.display).toBe("none");
  });
});
