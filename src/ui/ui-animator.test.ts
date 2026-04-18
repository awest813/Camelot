// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UIAnimator } from "./ui-animator";

// ── Mock the motion library ───────────────────────────────────────────────────
vi.mock("motion", () => {
  const mockAnimation = {
    then: vi.fn((cb: () => void) => {
      cb();
      return mockAnimation;
    }),
  };
  return { animateMini: vi.fn(() => mockAnimation) };
});

import { animateMini } from "motion";
const mockAnimate = animateMini as ReturnType<typeof vi.fn>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("UIAnimator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  describe("constructor", () => {
    it("accepts an explicit reducedMotion=true override", () => {
      const a = new UIAnimator({ reducedMotion: true });
      const el = makeEl();
      a.panelIn(el);
      expect(mockAnimate).not.toHaveBeenCalled();
    });

    it("accepts an explicit reducedMotion=false override", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      a.panelIn(el);
      expect(mockAnimate).toHaveBeenCalledOnce();
    });

    it("defaults to reducedMotion=false when matchMedia is absent", () => {
      // jsdom does not provide matchMedia by default
      const a = new UIAnimator();
      const el = makeEl();
      a.panelIn(el);
      expect(mockAnimate).toHaveBeenCalledOnce();
    });
  });

  describe("panelIn()", () => {
    it("calls animate() with the element", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      a.panelIn(el);
      expect(mockAnimate).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ opacity: [0, 1] }),
        expect.any(Object),
      );
    });

    it("animates from opacity 0 to 1", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      a.panelIn(el);
      const [, keyframes] = mockAnimate.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
      expect(keyframes.opacity).toEqual([0, 1]);
    });

    it("animates y from 10 to 0", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      a.panelIn(el);
      const [, keyframes] = mockAnimate.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
      expect(keyframes.y).toEqual([10, 0]);
    });

    it("animates scale from 0.97 to 1", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      a.panelIn(el);
      const [, keyframes] = mockAnimate.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
      expect(keyframes.scale).toEqual([0.97, 1]);
    });

    it("does not call animate() when reducedMotion is true", () => {
      const a = new UIAnimator({ reducedMotion: true });
      const el = makeEl();
      a.panelIn(el);
      expect(mockAnimate).not.toHaveBeenCalled();
    });
  });

  describe("panelOut()", () => {
    it("calls animate() with the element", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      const done = vi.fn();
      a.panelOut(el, done);
      expect(mockAnimate).toHaveBeenCalledWith(
        el,
        expect.objectContaining({ opacity: [1, 0] }),
        expect.any(Object),
      );
    });

    it("animates opacity from 1 to 0", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      const done = vi.fn();
      a.panelOut(el, done);
      const [, keyframes] = mockAnimate.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
      expect(keyframes.opacity).toEqual([1, 0]);
    });

    it("invokes done after the animation completes", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      const done = vi.fn();
      a.panelOut(el, done);
      // Mock `.then` fires synchronously in the mock above
      expect(done).toHaveBeenCalledOnce();
    });

    it("invokes done synchronously when reducedMotion is true", () => {
      const a = new UIAnimator({ reducedMotion: true });
      const el = makeEl();
      const done = vi.fn();
      a.panelOut(el, done);
      expect(done).toHaveBeenCalledOnce();
      expect(mockAnimate).not.toHaveBeenCalled();
    });

    it("does not call animate() when reducedMotion is true", () => {
      const a = new UIAnimator({ reducedMotion: true });
      const el = makeEl();
      a.panelOut(el, vi.fn());
      expect(mockAnimate).not.toHaveBeenCalled();
    });
  });

  describe("integration: panelIn then panelOut", () => {
    it("entrance then exit animations both fire on the same element", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      a.panelIn(el);
      a.panelOut(el, vi.fn());
      expect(mockAnimate).toHaveBeenCalledTimes(2);
    });

    it("done callback from panelOut receives no arguments", () => {
      const a = new UIAnimator({ reducedMotion: false });
      const el = makeEl();
      const done = vi.fn();
      a.panelOut(el, done);
      expect(done).toHaveBeenCalledWith();
    });
  });
});
