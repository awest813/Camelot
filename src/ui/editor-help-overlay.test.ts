import { describe, expect, it } from "vitest";
import { buildHelpOverlayLines, summarizeValidationReport } from "./editor-help-overlay";

describe("buildHelpOverlayLines", () => {
  it("returns gameplay-focused controls when editor is disabled", () => {
    const lines = buildHelpOverlayLines(false);
    expect(lines[0]).toBe("Gameplay Controls");
    expect(lines.join("\n")).toContain("I: Inventory");
    expect(lines.join("\n")).toContain("F1: Toggle this help overlay");
  });

  it("includes horse mount/dismount controls in gameplay overlay", () => {
    const lines = buildHelpOverlayLines(false);
    const joined = lines.join("\n");
    expect(joined).toContain("O: Mount / Dismount");
    expect(joined).toContain("Shift+O");
    expect(joined).toContain("Stable");
    expect(joined).toContain("Saddlebag");
  });

  it("returns editor-focused controls when editor is enabled", () => {
    const lines = buildHelpOverlayLines(true);
    expect(lines[0]).toBe("Editor Controls");
    expect(lines.join("\n")).toContain("F7: Toggle Validation Panel");
    expect(lines.join("\n")).toContain("F8: Validate Framework Quest Graphs");
    expect(lines.join("\n")).toContain("F10: Open Quest Creator");
    expect(lines.join("\n")).toContain("Ctrl+Z: Undo");
    expect(lines.join("\n")).toContain("Ctrl+Y: Redo");
    expect(lines.join("\n")).toContain("D: Duplicate Selected");
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
