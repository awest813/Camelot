/**
 * A panel loaded on first use (its code split out of the game's start-up
 * bundle).  Until then it is closed: `isVisible` is false and `close()` does
 * nothing.  `get()` loads it (once; a failed load is tried again next time)
 * and gives the ready panel.
 *
 * `openWith(show, release)` opens it: while it loads it counts as open, so a
 * second toggle closes it instead of opening it twice, and Escape (which
 * closes the open window) calls the open off instead of pausing underneath.
 * `release` runs if the open is called off or the panel can't load: give
 * the input back (the panel's own close would have).
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

  /** `load` builds the panel (dynamic import + wiring); it runs once. */
  constructor(private readonly _load: () => Promise<T>) {}

  /** Shown, or on its way (loading to be shown). */
  public get isVisible(): boolean {
    return this._opening || (this._panel?.isVisible ?? false);
  }

  /** Close it (or, while it loads, call the open off). */
  public close(): void {
    if (this._opening) {
      this._cancelled = true;
      return;
    }
    this._panel?.close();
  }

  /** Whether it is loading to be shown. */
  public get isOpening(): boolean {
    return this._opening;
  }

  /**
   * Load (if need be) and show: `show` gets the ready panel unless the open
   * was called off meanwhile; `release` runs if it was, or if it could not
   * load (`err` set).
   */
  public openWith(show: (panel: T) => void, release?: (err?: unknown) => void): void {
    if (this._opening) return;
    this._opening = true;
    this._cancelled = false;
    this.get().then(
      (panel) => {
        this._opening = false;
        if (this._cancelled) release?.();
        else show(panel);
      },
      (err: unknown) => {
        this._opening = false;
        console.warn("[lazy-panel] could not load a panel", err);
        release?.(err);
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
