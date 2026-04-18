import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarkRecallSystem } from "./mark-recall-system";
import type { MarkPosition, MarkRecallSaveState } from "./mark-recall-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makePos(x = 10, y = 0, z = -20): MarkPosition {
  return { x, y, z };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MarkRecallSystem — initial state", () => {
  it("starts with no mark", () => {
    const sys = new MarkRecallSystem();
    expect(sys.hasMarked).toBe(false);
  });

  it("markedPosition is null before marking", () => {
    const sys = new MarkRecallSystem();
    expect(sys.markedPosition).toBeNull();
  });

  it("markedCellId is null before marking", () => {
    const sys = new MarkRecallSystem();
    expect(sys.markedCellId).toBeNull();
  });
});

describe("MarkRecallSystem — mark()", () => {
  it("sets hasMarked to true", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    expect(sys.hasMarked).toBe(true);
  });

  it("stores the marked position", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 5, y: 2, z: -8 });
    expect(sys.markedPosition).toEqual({ x: 5, y: 2, z: -8 });
  });

  it("stores a null cellId by default", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    expect(sys.markedCellId).toBeNull();
  });

  it("stores an explicit cellId", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos(), "cell_vivec_arena");
    expect(sys.markedCellId).toBe("cell_vivec_arena");
  });

  it("passing null cellId stores null", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos(), null);
    expect(sys.markedCellId).toBeNull();
  });

  it("fires onMark callback with position and cellId", () => {
    const sys = new MarkRecallSystem();
    const cb = vi.fn();
    sys.onMark = cb;
    sys.mark({ x: 1, y: 2, z: 3 }, "cell_balmora");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 }, "cell_balmora");
  });

  it("fires onMark with null cellId when none provided", () => {
    const sys = new MarkRecallSystem();
    const cb = vi.fn();
    sys.onMark = cb;
    sys.mark(makePos());
    expect(cb).toHaveBeenCalledWith(expect.any(Object), null);
  });

  it("overwrites a previous mark", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 1, y: 0, z: 1 }, "cell_a");
    sys.mark({ x: 99, y: 5, z: -3 }, "cell_b");
    expect(sys.markedPosition).toEqual({ x: 99, y: 5, z: -3 });
    expect(sys.markedCellId).toBe("cell_b");
  });

  it("overwrite fires onMark again", () => {
    const sys = new MarkRecallSystem();
    const cb = vi.fn();
    sys.onMark = cb;
    sys.mark(makePos());
    sys.mark(makePos(50, 0, 50));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("markedPosition returns a copy — mutation does not affect stored state", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 10, y: 0, z: 20 });
    const pos = sys.markedPosition!;
    (pos as MarkPosition).x = 999;
    expect(sys.markedPosition!.x).toBe(10);
  });
});

describe("MarkRecallSystem — recall()", () => {
  it("returns null when no mark set", () => {
    const sys = new MarkRecallSystem();
    expect(sys.recall()).toBeNull();
  });

  it("returns the marked position and cellId", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 7, y: 1, z: -14 }, "cell_ald_ruhn");
    const result = sys.recall();
    expect(result).not.toBeNull();
    expect(result!.position).toEqual({ x: 7, y: 1, z: -14 });
    expect(result!.cellId).toBe("cell_ald_ruhn");
  });

  it("fires onRecall callback with position and cellId", () => {
    const sys = new MarkRecallSystem();
    const cb = vi.fn();
    sys.onRecall = cb;
    sys.mark({ x: 2, y: 0, z: 4 }, "cell_sadrith_mora");
    sys.recall();
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ x: 2, y: 0, z: 4 }, "cell_sadrith_mora");
  });

  it("does NOT clear the mark after recall", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    sys.recall();
    expect(sys.hasMarked).toBe(true);
  });

  it("can recall multiple times to the same mark", () => {
    const sys = new MarkRecallSystem();
    const cb = vi.fn();
    sys.onRecall = cb;
    sys.mark(makePos());
    sys.recall();
    sys.recall();
    sys.recall();
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("returns a copy — mutation does not affect stored position", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 10, y: 0, z: 20 });
    const result = sys.recall()!;
    (result.position as MarkPosition).x = 999;
    expect(sys.markedPosition!.x).toBe(10);
  });

  it("recall returns null after clearMark", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    sys.clearMark();
    expect(sys.recall()).toBeNull();
  });
});

describe("MarkRecallSystem — clearMark()", () => {
  it("sets hasMarked to false", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    sys.clearMark();
    expect(sys.hasMarked).toBe(false);
  });

  it("clears markedPosition to null", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    sys.clearMark();
    expect(sys.markedPosition).toBeNull();
  });

  it("clears markedCellId to null", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos(), "cell_x");
    sys.clearMark();
    expect(sys.markedCellId).toBeNull();
  });

  it("fires onMarkCleared callback", () => {
    const sys = new MarkRecallSystem();
    const cb = vi.fn();
    sys.onMarkCleared = cb;
    sys.mark(makePos());
    sys.clearMark();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("clearMark is a no-op when no mark exists — does not fire callback", () => {
    const sys = new MarkRecallSystem();
    const cb = vi.fn();
    sys.onMarkCleared = cb;
    sys.clearMark();
    expect(cb).not.toHaveBeenCalled();
  });

  it("clearMark after clearMark is still a no-op", () => {
    const sys = new MarkRecallSystem();
    const cb = vi.fn();
    sys.onMarkCleared = cb;
    sys.mark(makePos());
    sys.clearMark();
    sys.clearMark();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("can mark again after clearing", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 1, y: 0, z: 1 });
    sys.clearMark();
    sys.mark({ x: 50, y: 0, z: 50 });
    expect(sys.hasMarked).toBe(true);
    expect(sys.markedPosition).toEqual({ x: 50, y: 0, z: 50 });
  });
});

describe("MarkRecallSystem — null-safe callbacks", () => {
  it("mark works with no callbacks attached", () => {
    const sys = new MarkRecallSystem();
    expect(() => sys.mark(makePos())).not.toThrow();
  });

  it("recall works with no callbacks attached", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    expect(() => sys.recall()).not.toThrow();
  });

  it("clearMark works with no callbacks attached", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    expect(() => sys.clearMark()).not.toThrow();
  });
});

describe("MarkRecallSystem — getSaveState() / restoreFromSave()", () => {
  it("getSaveState returns hasMarked false when no mark", () => {
    const sys = new MarkRecallSystem();
    const state = sys.getSaveState();
    expect(state.hasMarked).toBe(false);
    expect(state.position).toBeNull();
    expect(state.cellId).toBeNull();
  });

  it("getSaveState returns the stored position and cellId", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 3, y: 1, z: -7 }, "cell_mournhold");
    const state = sys.getSaveState();
    expect(state.hasMarked).toBe(true);
    expect(state.position).toEqual({ x: 3, y: 1, z: -7 });
    expect(state.cellId).toBe("cell_mournhold");
  });

  it("getSaveState returns a copy — mutation does not affect internal state", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 10, y: 0, z: 20 });
    const state = sys.getSaveState();
    state.position!.x = 999;
    expect(sys.markedPosition!.x).toBe(10);
  });

  it("restoreFromSave restores mark state", () => {
    const sys = new MarkRecallSystem();
    const savedState: MarkRecallSaveState = {
      hasMarked: true,
      position: { x: 5, y: 2, z: -9 },
      cellId: "cell_vivec_palace",
    };
    sys.restoreFromSave(savedState);
    expect(sys.hasMarked).toBe(true);
    expect(sys.markedPosition).toEqual({ x: 5, y: 2, z: -9 });
    expect(sys.markedCellId).toBe("cell_vivec_palace");
  });

  it("restoreFromSave restores no-mark state", () => {
    const sys = new MarkRecallSystem();
    sys.mark(makePos());
    const savedState: MarkRecallSaveState = {
      hasMarked: false,
      position: null,
      cellId: null,
    };
    sys.restoreFromSave(savedState);
    expect(sys.hasMarked).toBe(false);
    expect(sys.markedPosition).toBeNull();
    expect(sys.markedCellId).toBeNull();
  });

  it("restoreFromSave does NOT fire callbacks", () => {
    const sys = new MarkRecallSystem();
    const markCb = vi.fn();
    const recallCb = vi.fn();
    sys.onMark = markCb;
    sys.onRecall = recallCb;
    sys.restoreFromSave({ hasMarked: true, position: { x: 1, y: 2, z: 3 }, cellId: null });
    expect(markCb).not.toHaveBeenCalled();
    expect(recallCb).not.toHaveBeenCalled();
  });

  it("restoreFromSave safety: hasMarked true with null position resets to unmarked", () => {
    const sys = new MarkRecallSystem();
    sys.restoreFromSave({ hasMarked: true, position: null, cellId: null });
    expect(sys.hasMarked).toBe(false);
    expect(sys.recall()).toBeNull();
  });

  it("round-trip save/restore preserves position and cellId", () => {
    const original = new MarkRecallSystem();
    original.mark({ x: 42, y: 7, z: -100 }, "cell_red_mountain");
    const state = original.getSaveState();

    const restored = new MarkRecallSystem();
    restored.restoreFromSave(state);

    expect(restored.hasMarked).toBe(true);
    expect(restored.markedPosition).toEqual({ x: 42, y: 7, z: -100 });
    expect(restored.markedCellId).toBe("cell_red_mountain");
  });

  it("round-trip save/restore with no mark stays unmarked", () => {
    const original = new MarkRecallSystem();
    const state = original.getSaveState();

    const restored = new MarkRecallSystem();
    restored.restoreFromSave(state);
    expect(restored.hasMarked).toBe(false);
    expect(restored.recall()).toBeNull();
  });

  it("recall works after restore", () => {
    const sys = new MarkRecallSystem();
    sys.restoreFromSave({ hasMarked: true, position: { x: 9, y: 0, z: 3 }, cellId: "cell_gnisis" });
    const result = sys.recall();
    expect(result).not.toBeNull();
    expect(result!.position).toEqual({ x: 9, y: 0, z: 3 });
    expect(result!.cellId).toBe("cell_gnisis");
  });
});

describe("MarkRecallSystem — full workflow", () => {
  it("mark → recall → clearMark → recall returns null", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 1, y: 0, z: 1 }, "cell_a");
    const r1 = sys.recall();
    expect(r1!.cellId).toBe("cell_a");
    sys.clearMark();
    const r2 = sys.recall();
    expect(r2).toBeNull();
  });

  it("mark open-world → recall → re-mark interior → recall gives new position", () => {
    const sys = new MarkRecallSystem();
    sys.mark({ x: 100, y: 0, z: 200 }, null);
    sys.mark({ x: 5, y: 0, z: 5 }, "cell_interior");
    const result = sys.recall()!;
    expect(result.position).toEqual({ x: 5, y: 0, z: 5 });
    expect(result.cellId).toBe("cell_interior");
  });

  it("onMark fires with latest position when overwriting", () => {
    const positions: MarkPosition[] = [];
    const sys = new MarkRecallSystem();
    sys.onMark = (pos) => positions.push({ ...pos });
    sys.mark({ x: 1, y: 0, z: 1 });
    sys.mark({ x: 2, y: 0, z: 2 });
    sys.mark({ x: 3, y: 0, z: 3 });
    expect(positions).toHaveLength(3);
    expect(positions[2]).toEqual({ x: 3, y: 0, z: 3 });
  });
});
