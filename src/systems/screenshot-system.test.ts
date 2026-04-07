// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SCREENSHOT_CONFIG,
  ScreenshotSystem,
} from "./screenshot-system";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCanvas(dataUrl = "data:image/png;base64,FAKE"): HTMLCanvasElement {
  return { toDataURL: vi.fn().mockReturnValue(dataUrl) } as unknown as HTMLCanvasElement;
}

function makeAnchor(): HTMLAnchorElement & { click: ReturnType<typeof vi.fn> } {
  const el = { href: "", download: "", click: vi.fn() };
  return el as unknown as HTMLAnchorElement & { click: ReturnType<typeof vi.fn> };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ScreenshotSystem", () => {
  let system: ScreenshotSystem;

  beforeEach(() => {
    system = new ScreenshotSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── DEFAULT_SCREENSHOT_CONFIG ─────────────────────────────────────────────

  describe("DEFAULT_SCREENSHOT_CONFIG", () => {
    it("has format 'png'", () => {
      expect(DEFAULT_SCREENSHOT_CONFIG.format).toBe("png");
    });

    it("has quality 0.92", () => {
      expect(DEFAULT_SCREENSHOT_CONFIG.quality).toBeCloseTo(0.92, 5);
    });
  });

  // ── Constructor ───────────────────────────────────────────────────────────

  describe("constructor()", () => {
    it("uses default format and quality when called with no args", () => {
      expect(system.format).toBe(DEFAULT_SCREENSHOT_CONFIG.format);
      expect(system.quality).toBeCloseTo(DEFAULT_SCREENSHOT_CONFIG.quality, 5);
    });

    it("accepts a partial config override for format", () => {
      const s = new ScreenshotSystem({ format: "jpeg" });
      expect(s.format).toBe("jpeg");
      expect(s.quality).toBeCloseTo(DEFAULT_SCREENSHOT_CONFIG.quality, 5);
    });

    it("accepts a partial config override for quality", () => {
      const s = new ScreenshotSystem({ quality: 0.75 });
      expect(s.format).toBe("png");
      expect(s.quality).toBeCloseTo(0.75, 5);
    });

    it("accepts full config overrides", () => {
      const s = new ScreenshotSystem({ format: "jpeg", quality: 0.5 });
      expect(s.format).toBe("jpeg");
      expect(s.quality).toBeCloseTo(0.5, 5);
    });

    it("onCapture is null by default", () => {
      expect(system.onCapture).toBeNull();
    });
  });

  // ── setFormat ─────────────────────────────────────────────────────────────

  describe("setFormat()", () => {
    it("changes the format to jpeg", () => {
      system.setFormat("jpeg");
      expect(system.format).toBe("jpeg");
    });

    it("changes the format back to png", () => {
      system.setFormat("jpeg");
      system.setFormat("png");
      expect(system.format).toBe("png");
    });
  });

  // ── setQuality ────────────────────────────────────────────────────────────

  describe("setQuality()", () => {
    it("updates the quality value", () => {
      system.setQuality(0.5);
      expect(system.quality).toBeCloseTo(0.5, 5);
    });

    it("accepts boundary value 0", () => {
      system.setQuality(0);
      expect(system.quality).toBeCloseTo(0, 5);
    });

    it("accepts boundary value 1", () => {
      system.setQuality(1);
      expect(system.quality).toBeCloseTo(1, 5);
    });

    it("throws for quality below 0", () => {
      expect(() => system.setQuality(-0.1)).toThrow("quality");
    });

    it("throws for quality above 1", () => {
      expect(() => system.setQuality(1.1)).toThrow("quality");
    });

    it("throws for NaN quality", () => {
      expect(() => system.setQuality(NaN)).toThrow("quality");
    });
  });

  // ── capture ───────────────────────────────────────────────────────────────

  describe("capture()", () => {
    it("calls canvas.toDataURL with 'image/png' mime type by default", () => {
      const canvas = makeCanvas();
      system.capture(canvas);
      expect(canvas.toDataURL).toHaveBeenCalledWith("image/png", DEFAULT_SCREENSHOT_CONFIG.quality);
    });

    it("calls canvas.toDataURL with 'image/jpeg' mime type after setFormat('jpeg')", () => {
      const canvas = makeCanvas("data:image/jpeg;base64,FAKE");
      system.setFormat("jpeg");
      system.capture(canvas);
      expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", DEFAULT_SCREENSHOT_CONFIG.quality);
    });

    it("passes updated quality to toDataURL", () => {
      const canvas = makeCanvas();
      system.setQuality(0.6);
      system.capture(canvas);
      expect(canvas.toDataURL).toHaveBeenCalledWith("image/png", 0.6);
    });

    it("returns the data URL string from the canvas", () => {
      const url = "data:image/png;base64,TESTDATA";
      const canvas = makeCanvas(url);
      expect(system.capture(canvas)).toBe(url);
    });
  });

  // ── download ──────────────────────────────────────────────────────────────

  describe("download()", () => {
    it("creates an anchor, sets href and download, then clicks it", () => {
      const canvas = makeCanvas("data:image/png;base64,DLTEST");
      const anchor = makeAnchor();
      vi.spyOn(document, "createElement").mockReturnValueOnce(anchor as unknown as HTMLElement);

      system.download(canvas);

      expect(anchor.href).toBe("data:image/png;base64,DLTEST");
      expect(anchor.download).toMatch(/^screenshot-.*\.png$/);
      expect(anchor.click).toHaveBeenCalledOnce();
    });

    it("uses the provided filename when given", () => {
      const canvas = makeCanvas();
      const anchor = makeAnchor();
      vi.spyOn(document, "createElement").mockReturnValueOnce(anchor as unknown as HTMLElement);

      system.download(canvas, "my-shot.png");

      expect(anchor.download).toBe("my-shot.png");
    });

    it("returns the data URL", () => {
      const url = "data:image/png;base64,RETTEST";
      const canvas = makeCanvas(url);
      const anchor = makeAnchor();
      vi.spyOn(document, "createElement").mockReturnValueOnce(anchor as unknown as HTMLElement);

      expect(system.download(canvas)).toBe(url);
    });

    it("fires onCapture with the data URL and filename", () => {
      const canvas = makeCanvas("data:image/png;base64,CBTEST");
      const anchor = makeAnchor();
      vi.spyOn(document, "createElement").mockReturnValueOnce(anchor as unknown as HTMLElement);

      const cb = vi.fn();
      system.onCapture = cb;
      system.download(canvas, "cb-shot.png");

      expect(cb).toHaveBeenCalledWith("data:image/png;base64,CBTEST", "cb-shot.png");
    });

    it("does not fire onCapture when callback is null", () => {
      const canvas = makeCanvas();
      const anchor = makeAnchor();
      vi.spyOn(document, "createElement").mockReturnValueOnce(anchor as unknown as HTMLElement);

      expect(() => system.download(canvas)).not.toThrow();
    });

    it("auto-generates a PNG filename by default", () => {
      const canvas = makeCanvas();
      const anchor = makeAnchor();
      vi.spyOn(document, "createElement").mockReturnValueOnce(anchor as unknown as HTMLElement);

      system.download(canvas);

      expect(anchor.download).toMatch(/^screenshot-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
    });

    it("auto-generates a JPEG filename when format is jpeg", () => {
      const canvas = makeCanvas("data:image/jpeg;base64,JPGTEST");
      const anchor = makeAnchor();
      vi.spyOn(document, "createElement").mockReturnValueOnce(anchor as unknown as HTMLElement);

      system.setFormat("jpeg");
      system.download(canvas);

      expect(anchor.download).toMatch(/\.jpeg$/);
    });
  });

  // ── getSnapshot / restoreSnapshot ─────────────────────────────────────────

  describe("getSnapshot()", () => {
    it("returns the current format and quality", () => {
      system.setFormat("jpeg");
      system.setQuality(0.8);
      const snap = system.getSnapshot();
      expect(snap.format).toBe("jpeg");
      expect(snap.quality).toBeCloseTo(0.8, 5);
    });

    it("snapshot is a plain object (not a live reference)", () => {
      const snap = system.getSnapshot();
      snap.format = "jpeg";
      expect(system.format).toBe("png");
    });
  });

  describe("restoreSnapshot()", () => {
    it("restores format and quality from a snapshot", () => {
      system.setFormat("jpeg");
      system.setQuality(0.7);

      const snap = system.getSnapshot();

      const other = new ScreenshotSystem();
      other.restoreSnapshot(snap);

      expect(other.format).toBe("jpeg");
      expect(other.quality).toBeCloseTo(0.7, 5);
    });

    it("round-trips default config through snapshot", () => {
      const snap = system.getSnapshot();
      const other = new ScreenshotSystem({ format: "jpeg", quality: 0.5 });
      other.restoreSnapshot(snap);

      expect(other.format).toBe(DEFAULT_SCREENSHOT_CONFIG.format);
      expect(other.quality).toBeCloseTo(DEFAULT_SCREENSHOT_CONFIG.quality, 5);
    });
  });
});
