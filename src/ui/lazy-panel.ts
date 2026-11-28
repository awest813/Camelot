/**
 * A panel loaded on first use (its code split out of the game's start-up
 * bundle).  Until then it is closed: `isVisible` is false and `close()` does
 * nothing.  `get()` loads it (once; a failed load is tried again next time)
 * and gives the ready panel.
 *
 * `openWith(show, release)` opens it: while it loads it counts as open, so a
 * second toggle closes it instead of opening it twice, and Escape (which
 * closes the open window) calls the open off instead of pausing underneath.
 * `release` runs if the open is called off (at once) or the panel can't
 * load: give the input back (the panel's own close would have).
 */
import { asyncWork } from "../core/async-work";

export interface ClosablePanel {
  readonly isVisible: boolean;
  close(): void;
}

export class LazyPanel<T extends ClosablePanel> {
  private _panel: T | null = null;
  private _loading: Promise<T> | null = null;
  private _opening = false;
  private _cancelled = false;
  private _release: ((err?: unknown) => void) | undefined;
  private _show: ((panel: T) => void) | undefined;

  /** `load` builds the panel (dynamic import + wiring); it runs once. */
  constructor(private readonly _load: () => Promise<T>) {}

  /** Shown, or on its way (loading to be shown, and not called off). */
  public get isVisible(): boolean {
    return this.isOpening || (this._panel?.isVisible ?? false);
  }

  /** Close it (or, while it loads, call the open off). */
  public close(): void {
    if (this._opening) {
      if (this._cancelled) return;
      this._cancelled = true;
      // Released now, not when the code arrives: by then another window may
      // have taken the input, and a late release would hand it back to play.
      this._release?.();
      return;
    }
    this._panel?.close();
  }

  /** Whether it is loading to be shown (an open called off is not). */
  public get isOpening(): boolean {
    return this._opening && !this._cancelled;
  }

  /**
   * Load (if need be) and show: `show` gets the ready panel unless the open
   * was called off meanwhile; `release` runs if it was, or if it could not
   * load (`err` set).
   */
  public openWith(show: (panel: T) => void, release?: (err?: unknown) => void): void {
    // Opened again while still loading: an open called off is back on.
    this._release = release;
    this._show = show;
    if (this._opening) { this._cancelled = false; return; }
    this._opening = true;
    this._cancelled = false;
    this.get().then(
      (panel) => {
        this._opening = false;
        if (!this._cancelled) this._show?.(panel); // (a called-off open was released when called off)
      },
      (err: unknown) => {
        this._opening = false;
        console.warn("[lazy-panel] could not load a panel", err);
        if (!this._cancelled) this._release?.(err);
      },
    );
  }

  /** The panel if it has loaded, else null. */
  public get current(): T | null {
    return this._panel;
  }

  /** The panel, loading it the first time. */
  public get(): Promise<T> {
    this._loading ??= asyncWork.ordered(this._load()).then(
      (p) => (this._panel = p),
      (err: unknown) => {
        this._loading = null; // try again next time (a chunk that failed to arrive)
        throw err;
      },
    );
    return this._loading;
  }
}
