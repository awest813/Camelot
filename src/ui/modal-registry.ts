/**
 * Every panel that takes over the screen, in Escape order.  Escape closes
 * the first open one; pausing closes them all; "is any open?" blocks play.
 *
 * One list instead of three hand-kept ones (they had drifted: Escape missed
 * the shouts panel and the World Builder, so it paused the game under them).
 */
export interface Modal {
  readonly id: string;
  isOpen(): boolean;
  /** Close it and hand input back as its own close path does. */
  close(): void;
}

export class ModalRegistry {
  private readonly _modals: Modal[] = [];

  /** Register panels; earlier ones close first on Escape. */
  public add(...modals: Modal[]): void {
    for (const m of modals) {
      if (this._modals.some((x) => x.id === m.id)) throw new Error(`modal '${m.id}' is already registered`);
      this._modals.push(m);
    }
  }

  public anyOpen(): boolean {
    return this._modals.some((m) => m.isOpen());
  }

  /** The open panels' ids, in Escape order. */
  public open(): string[] {
    return this._modals.filter((m) => m.isOpen()).map((m) => m.id);
  }

  /** Whether the panel `id` is open. */
  public isOpen(id: string): boolean {
    return this._get(id).isOpen();
  }

  /** Close the panel `id` (if open) by its own close path. */
  public close(id: string): void {
    const m = this._get(id);
    if (m.isOpen()) m.close();
  }

  private _get(id: string): Modal {
    const m = this._modals.find((x) => x.id === id);
    if (!m) throw new Error(`no modal '${id}'`);
    return m;
  }

  /** Escape: close the first open panel; false when none was open. */
  public closeTop(): boolean {
    const top = this._modals.find((m) => m.isOpen());
    if (!top) return false;
    top.close();
    return true;
  }

  /** Close every open panel (e.g. on pause). */
  public closeAll(): void {
    for (const m of this._modals) if (m.isOpen()) m.close();
  }
}
