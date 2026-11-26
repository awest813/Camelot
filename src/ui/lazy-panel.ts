/**
 * A panel loaded on first use (its code split out of the game's start-up
 * bundle).  Until then it is closed: `isVisible` is false and `close()` does
 * nothing.  `get()` loads it (once) and gives the ready panel.
 */
export interface ClosablePanel {
  readonly isVisible: boolean;
  close(): void;
}

export class LazyPanel<T extends ClosablePanel> {
  private _panel: T | null = null;
  private _loading: Promise<T> | null = null;

  /** `load` builds the panel (dynamic import + wiring); it runs once. */
  constructor(private readonly _load: () => Promise<T>) {}

  public get isVisible(): boolean {
    return this._panel?.isVisible ?? false;
  }

  public close(): void {
    this._panel?.close();
  }

  /** The panel if it has loaded, else null. */
  public get current(): T | null {
    return this._panel;
  }

  /** The panel, loading it the first time. */
  public get(): Promise<T> {
    this._loading ??= this._load().then((p) => (this._panel = p));
    return this._loading;
  }
}
