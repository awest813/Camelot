import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MapAnnotationSystem,
  AnnotationStroke,
  AnnotationSnapshot,
  StrokeStyle,
} from "./map-annotation-system";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("MapAnnotationSystem", () => {
  let ink: MapAnnotationSystem;

  beforeEach(() => {
    ink = new MapAnnotationSystem();
  });

  // ── Stroke creation ───────────────────────────────────────────────────────

  describe("beginStroke / addPoint / endStroke", () => {
    it("creates a stroke with default style", () => {
      const id = ink.beginStroke();
      expect(id).toMatch(/^stroke_\d+$/);
      const stroke = ink.getStroke(id);
      expect(stroke).toBeDefined();
      expect(stroke!.style.color).toBe("#ff0000");
      expect(stroke!.style.width).toBe(2);
      expect(stroke!.completed).toBe(false);
    });

    it("creates a stroke with custom style", () => {
      const id = ink.beginStroke({ color: "#00ff00", width: 5 });
      const stroke = ink.getStroke(id);
      expect(stroke!.style.color).toBe("#00ff00");
      expect(stroke!.style.width).toBe(5);
    });

    it("creates a stroke with a label", () => {
      const id = ink.beginStroke({}, "blocked area");
      const stroke = ink.getStroke(id);
      expect(stroke!.label).toBe("blocked area");
    });

    it("addPoint appends to a stroke", () => {
      const id = ink.beginStroke();
      expect(ink.addPoint(id, 10, 20)).toBe(true);
      expect(ink.addPoint(id, 12, 22)).toBe(true);
      expect(ink.getStroke(id)!.points).toHaveLength(2);
    });

    it("addPoint returns false for unknown stroke", () => {
      expect(ink.addPoint("unknown", 0, 0)).toBe(false);
    });

    it("addPoint returns false for completed stroke", () => {
      const id = ink.beginStroke();
      ink.addPoint(id, 1, 2);
      ink.endStroke(id);
      expect(ink.addPoint(id, 3, 4)).toBe(false);
    });

    it("endStroke completes the stroke", () => {
      const id = ink.beginStroke();
      ink.addPoint(id, 5, 6);
      expect(ink.endStroke(id)).toBe(true);
      expect(ink.getStroke(id)!.completed).toBe(true);
    });

    it("endStroke returns false for unknown stroke", () => {
      expect(ink.endStroke("unknown")).toBe(false);
    });

    it("endStroke returns false for already completed stroke", () => {
      const id = ink.beginStroke();
      ink.endStroke(id);
      expect(ink.endStroke(id)).toBe(false);
    });

    it("generates unique ids for each stroke", () => {
      const id1 = ink.beginStroke();
      const id2 = ink.beginStroke();
      const id3 = ink.beginStroke();
      expect(new Set([id1, id2, id3]).size).toBe(3);
    });
  });

  // ── Stroke management ─────────────────────────────────────────────────────

  describe("stroke management", () => {
    it("getAllStrokes returns all strokes", () => {
      ink.beginStroke();
      ink.beginStroke();
      expect(ink.getAllStrokes()).toHaveLength(2);
    });

    it("getCompletedStrokes returns only completed strokes", () => {
      const id1 = ink.beginStroke();
      const id2 = ink.beginStroke();
      ink.addPoint(id1, 0, 0);
      ink.endStroke(id1);
      expect(ink.getCompletedStrokes()).toHaveLength(1);
      expect(ink.getCompletedStrokes()[0].id).toBe(id1);
    });

    it("strokeCount returns total count", () => {
      ink.beginStroke();
      ink.beginStroke();
      expect(ink.strokeCount).toBe(2);
    });

    it("removeStroke removes a stroke", () => {
      const id = ink.beginStroke();
      expect(ink.removeStroke(id)).toBe(true);
      expect(ink.getStroke(id)).toBeUndefined();
    });

    it("removeStroke returns false for unknown id", () => {
      expect(ink.removeStroke("unknown")).toBe(false);
    });

    it("clear removes all strokes", () => {
      ink.beginStroke();
      ink.beginStroke();
      ink.clear();
      expect(ink.strokeCount).toBe(0);
    });

    it("setStrokeLabel updates the label", () => {
      const id = ink.beginStroke();
      expect(ink.setStrokeLabel(id, "my label")).toBe(true);
      expect(ink.getStroke(id)!.label).toBe("my label");
    });

    it("setStrokeLabel returns false for unknown stroke", () => {
      expect(ink.setStrokeLabel("unknown", "label")).toBe(false);
    });

    it("setStrokeStyle updates style properties", () => {
      const id = ink.beginStroke({ color: "#000000", width: 1 });
      expect(ink.setStrokeStyle(id, { color: "#ffffff" })).toBe(true);
      expect(ink.getStroke(id)!.style.color).toBe("#ffffff");
      expect(ink.getStroke(id)!.style.width).toBe(1); // unchanged
    });

    it("setStrokeStyle returns false for unknown stroke", () => {
      expect(ink.setStrokeStyle("unknown", { color: "#fff" })).toBe(false);
    });
  });

  // ── Undo ──────────────────────────────────────────────────────────────────

  describe("undoLastStroke", () => {
    it("removes the last completed stroke", () => {
      const id1 = ink.beginStroke();
      ink.addPoint(id1, 0, 0);
      ink.endStroke(id1);
      const id2 = ink.beginStroke();
      ink.addPoint(id2, 1, 1);
      ink.endStroke(id2);

      const undone = ink.undoLastStroke();
      expect(undone).not.toBeNull();
      expect(undone!.id).toBe(id2);
      expect(ink.getStroke(id2)).toBeUndefined();
      expect(ink.getStroke(id1)).toBeDefined();
    });

    it("returns null when no completed strokes exist", () => {
      ink.beginStroke(); // not completed
      expect(ink.undoLastStroke()).toBeNull();
    });

    it("returns null on empty system", () => {
      expect(ink.undoLastStroke()).toBeNull();
    });
  });

  // ── Visibility ────────────────────────────────────────────────────────────

  describe("visibility", () => {
    it("starts visible", () => {
      expect(ink.isVisible).toBe(true);
    });

    it("can be toggled", () => {
      ink.setVisible(false);
      expect(ink.isVisible).toBe(false);
      ink.setVisible(true);
      expect(ink.isVisible).toBe(true);
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validate()", () => {
    it("returns no issues for valid strokes", () => {
      const id = ink.beginStroke();
      ink.addPoint(id, 0, 0);
      ink.addPoint(id, 1, 1);
      ink.endStroke(id);
      expect(ink.validate()).toHaveLength(0);
    });

    it("reports empty completed strokes", () => {
      const id = ink.beginStroke();
      ink.endStroke(id);
      const issues = ink.validate();
      expect(issues.some(i => i.code === "empty-stroke")).toBe(true);
    });

    it("reports single-point strokes", () => {
      const id = ink.beginStroke();
      ink.addPoint(id, 5, 5);
      ink.endStroke(id);
      const issues = ink.validate();
      expect(issues.some(i => i.code === "single-point")).toBe(true);
    });

    it("does not validate in-progress strokes", () => {
      const id = ink.beginStroke();
      // 0 points, not completed — should not appear in validation
      expect(ink.validate()).toHaveLength(0);
    });
  });

  // ── Serialisation ─────────────────────────────────────────────────────────

  describe("export / import", () => {
    it("exports completed strokes only", () => {
      const id1 = ink.beginStroke({ color: "#aaa", width: 3 }, "note");
      ink.addPoint(id1, 10, 20);
      ink.addPoint(id1, 30, 40);
      ink.endStroke(id1);
      const id2 = ink.beginStroke(); // not completed

      const data = ink.export();
      expect(data.strokes).toHaveLength(1);
      expect(data.strokes[0].id).toBe(id1);
      expect(data.strokes[0].points).toHaveLength(2);
      expect(data.strokes[0].style.color).toBe("#aaa");
      expect(data.strokes[0].label).toBe("note");
    });

    it("import replaces all strokes", () => {
      ink.beginStroke();
      const snapshot: AnnotationSnapshot = {
        strokes: [
          {
            id: "stroke_100",
            points: [{ x: 1, z: 2 }, { x: 3, z: 4 }],
            style: { color: "#00f", width: 4 },
            label: "imported",
          },
        ],
      };
      ink.import(snapshot);
      expect(ink.strokeCount).toBe(1);
      expect(ink.getStroke("stroke_100")).toBeDefined();
      expect(ink.getStroke("stroke_100")!.completed).toBe(true);
      expect(ink.getStroke("stroke_100")!.label).toBe("imported");
    });

    it("import handles empty/null snapshot gracefully", () => {
      ink.beginStroke();
      ink.import(null as any);
      expect(ink.strokeCount).toBe(0);
    });

    it("import handles missing strokes array", () => {
      ink.import({} as any);
      expect(ink.strokeCount).toBe(0);
    });

    it("round-trip export → import preserves data", () => {
      const id = ink.beginStroke({ color: "#123", width: 7 }, "test");
      ink.addPoint(id, 5, 10);
      ink.addPoint(id, 15, 20);
      ink.endStroke(id);

      const data = ink.export();
      ink.clear();
      ink.import(data);

      expect(ink.strokeCount).toBe(1);
      const restored = ink.getStroke(id)!;
      expect(restored.points).toHaveLength(2);
      expect(restored.style.color).toBe("#123");
      expect(restored.label).toBe("test");
    });

    it("new strokes after import get unique ids", () => {
      const snapshot: AnnotationSnapshot = {
        strokes: [{
          id: "stroke_50",
          points: [{ x: 0, z: 0 }],
          style: { color: "#000", width: 1 },
        }],
      };
      ink.import(snapshot);
      const newId = ink.beginStroke();
      expect(parseInt(newId.replace("stroke_", ""), 10)).toBeGreaterThan(50);
    });
  });

  // ── Snapshot / restore ────────────────────────────────────────────────────

  describe("getSnapshot / restoreSnapshot", () => {
    it("getSnapshot returns export data", () => {
      const id = ink.beginStroke();
      ink.addPoint(id, 1, 2);
      ink.endStroke(id);
      const snap = ink.getSnapshot();
      expect(snap.strokes).toHaveLength(1);
    });

    it("restoreSnapshot restores state", () => {
      const id = ink.beginStroke();
      ink.addPoint(id, 1, 2);
      ink.endStroke(id);
      const snap = ink.getSnapshot();

      ink.clear();
      ink.restoreSnapshot(snap);
      expect(ink.strokeCount).toBe(1);
    });
  });

  // ── Queries ───────────────────────────────────────────────────────────────

  describe("strokesAt()", () => {
    it("finds strokes near a point", () => {
      const id = ink.beginStroke();
      ink.addPoint(id, 10, 20);
      ink.addPoint(id, 12, 22);
      ink.endStroke(id);

      expect(ink.strokesAt(10, 20)).toHaveLength(1);
      expect(ink.strokesAt(11, 21, 2)).toHaveLength(1);
      expect(ink.strokesAt(100, 200)).toHaveLength(0);
    });
  });

  describe("getBounds()", () => {
    it("returns null for empty system", () => {
      expect(ink.getBounds()).toBeNull();
    });

    it("computes bounding box of all points", () => {
      const id1 = ink.beginStroke();
      ink.addPoint(id1, 5, 10);
      ink.addPoint(id1, 15, 30);
      ink.endStroke(id1);

      const id2 = ink.beginStroke();
      ink.addPoint(id2, 0, 20);
      ink.addPoint(id2, 10, 0);
      ink.endStroke(id2);

      const bounds = ink.getBounds();
      expect(bounds).not.toBeNull();
      expect(bounds!.minX).toBe(0);
      expect(bounds!.minZ).toBe(0);
      expect(bounds!.maxX).toBe(15);
      expect(bounds!.maxZ).toBe(30);
    });
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────

  describe("callbacks", () => {
    it("fires onStrokeBegin", () => {
      const cb = vi.fn();
      ink.onStrokeBegin = cb;
      ink.beginStroke();
      expect(cb).toHaveBeenCalledOnce();
    });

    it("fires onPointAdded", () => {
      const cb = vi.fn();
      ink.onPointAdded = cb;
      const id = ink.beginStroke();
      ink.addPoint(id, 1, 2);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb.mock.calls[0][0]).toBe(id);
      expect(cb.mock.calls[0][1]).toEqual({ x: 1, z: 2 });
    });

    it("fires onStrokeEnd", () => {
      const cb = vi.fn();
      ink.onStrokeEnd = cb;
      const id = ink.beginStroke();
      ink.addPoint(id, 0, 0);
      ink.endStroke(id);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("fires onStrokeRemoved", () => {
      const cb = vi.fn();
      ink.onStrokeRemoved = cb;
      const id = ink.beginStroke();
      ink.removeStroke(id);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb.mock.calls[0][0]).toBe(id);
    });

    it("fires onClear", () => {
      const cb = vi.fn();
      ink.onClear = cb;
      ink.beginStroke();
      ink.clear();
      expect(cb).toHaveBeenCalledOnce();
    });

    it("fires onStrokeRemoved when undoing", () => {
      const cb = vi.fn();
      const id = ink.beginStroke();
      ink.addPoint(id, 0, 0);
      ink.endStroke(id);
      ink.onStrokeRemoved = cb;
      ink.undoLastStroke();
      expect(cb).toHaveBeenCalledOnce();
    });
  });
});
