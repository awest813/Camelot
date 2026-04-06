/**
 * ScreenshotSystem — headless, no BabylonJS dependencies.
 *
 * Captures the active WebGL canvas using the HTML5 Canvas API and triggers a
 * browser file download.  The system is intentionally thin so that it can be
 * unit-tested without a real rendering context.
 *
 * Usage:
 *   const ss = new ScreenshotSystem();
 *   ss.download(canvas);                       // PNG download with auto timestamp name
 *   ss.download(canvas, "boss-fight.png");     // named PNG download
 *
 *   ss.setFormat("jpeg");
 *   ss.setQuality(0.85);
 *   const dataUrl = ss.capture(canvas);        // returns data URL without downloading
 *
 *   ss.onCapture = (dataUrl, filename) => { ... };
 */

export type ScreenshotFormat = "png" | "jpeg";

export interface ScreenshotConfig {
  /** Image format for saved screenshots. */
  format: ScreenshotFormat;
  /** JPEG quality in the range [0, 1].  Ignored for PNG. */
  quality: number;
}

export interface ScreenshotSaveState {
  format: ScreenshotFormat;
  quality: number;
}

export const DEFAULT_SCREENSHOT_CONFIG: Readonly<ScreenshotConfig> = {
  format: "png",
  quality: 0.92,
};

export class ScreenshotSystem {
  private _format: ScreenshotFormat;
  private _quality: number;

  /** Called after a screenshot download is initiated. Receives the data URL and filename. */
  onCapture: ((dataUrl: string, filename: string) => void) | null = null;

  constructor(config: Partial<ScreenshotConfig> = {}) {
    this._format = config.format ?? DEFAULT_SCREENSHOT_CONFIG.format;
    this._quality = config.quality ?? DEFAULT_SCREENSHOT_CONFIG.quality;
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  get format(): ScreenshotFormat {
    return this._format;
  }

  get quality(): number {
    return this._quality;
  }

  setFormat(format: ScreenshotFormat): void {
    this._format = format;
  }

  /** @throws {Error} if quality is not a finite number in [0, 1] */
  setQuality(quality: number): void {
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
      throw new Error(`Screenshot quality must be between 0 and 1, got ${quality}`);
    }
    this._quality = quality;
  }

  // ── Capture ────────────────────────────────────────────────────────────────

  /**
   * Reads the current pixels from the canvas and returns a data URL.
   * Does NOT trigger a download.
   */
  capture(canvas: HTMLCanvasElement): string {
    const mimeType = this._format === "jpeg" ? "image/jpeg" : "image/png";
    return canvas.toDataURL(mimeType, this._quality);
  }

  /**
   * Captures the canvas and triggers a browser file download.
   * Returns the data URL of the captured image.
   */
  download(canvas: HTMLCanvasElement, filename?: string): string {
    const dataUrl = this.capture(canvas);
    const resolvedFilename = filename ?? this._buildFilename();
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = resolvedFilename;
    link.click();
    this.onCapture?.(dataUrl, resolvedFilename);
    return dataUrl;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  getSnapshot(): ScreenshotSaveState {
    return { format: this._format, quality: this._quality };
  }

  restoreSnapshot(state: ScreenshotSaveState): void {
    this._format = state.format;
    this._quality = state.quality;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _buildFilename(): string {
    // Keep only "YYYY-MM-DDTHH-MM-SS" (19 chars) to produce a safe filename
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `screenshot-${ts}.${this._format}`;
  }
}
