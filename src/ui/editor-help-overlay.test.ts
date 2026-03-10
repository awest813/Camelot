import { describe, expect, it } from "vitest";
import { buildHelpOverlayLines, summarizeValidationReport } from "./editor-help-overlay";

describe("buildHelpOverlayLines", () => {
  it("returns gameplay-focused controls when editor is disabled", () => {
    const lines = buildHelpOverlayLines(false);
    expect(lines[0]).toBe("Gameplay Controls");
    expect(lines.join("\n")).toContain("I: Inventory");
    expect(lines.join("\n")).toContain("F1: Toggle this help overlay");
  });

  it("returns editor-focused controls when editor is enabled", () => {
    const lines = buildHelpOverlayLines(true);
    expect(lines[0]).toBe("Editor Controls");
    expect(lines.join("\n")).toContain("F7: Validate Map");
    expect(lines.join("\n")).toContain("F8: Validate Framework Quest Graphs");
  });
});

describe("summarizeValidationReport", () => {
  it("returns pass summary for valid map", () => {
    expect(summarizeValidationReport({ isValid: true, issues: [] })).toContain("passed");
  });

  it("returns grouped summary for invalid map", () => {
    const summary = summarizeValidationReport({
      isValid: false,
      issues: [
        { code: "entity-overlap", message: "x" },
        { code: "entity-overlap", message: "y" },
        { code: "orphaned-quest-marker", message: "z" },
      ],
    });

    expect(summary).toContain("3 issue");
    expect(summary).toContain("entity-overlap (2)");
  });
});
