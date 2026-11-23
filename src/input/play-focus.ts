/**
 * Who has the player's input.  Play has it (pointer locked, mouse-look on,
 * world interaction live) unless something holds it: a menu, the pause
 * menu, the map editor, character creation, a conversation, lying fallen.  Holders are
 * named, so letting go of one (closing a tool) doesn't hand input back
 * while another (the editor around it) still holds it.
 *
 * The one place that locks and unlocks the pointer (engine overhaul,
 * Phase 2).
 */
export type FocusHolder = "menu" | "pause" | "editor" | "creation" | "dialogue" | "fallen";

export interface PlayFocusDeps {
  lockPointer(): void;
  unlockPointer(): void;
  /** Mouse-look and movement on the player camera. */
  attachCamera(): void;
  detachCamera(): void;
  /** World interaction (E prompts, picks) on or off. */
  setInteractionBlocked(blocked: boolean): void;
}

export class PlayFocus {
  private readonly _holders = new Set<FocusHolder>();

  constructor(private readonly _d: PlayFocusDeps) {}

  /** Something other than play has the input. */
  public get held(): boolean {
    return this._holders.size > 0;
  }

  public holds(holder: FocusHolder): boolean {
    return this._holders.has(holder);
  }

  /** Take input away from play. */
  public take(holder: FocusHolder): void {
    this._holders.add(holder);
    this._d.setInteractionBlocked(true);
    this._safe(() => this._d.unlockPointer());
    this._d.detachCamera();
  }

  /** Let go; play gets input back once nothing else holds it. */
  public give(holder: FocusHolder): void {
    this._holders.delete(holder);
    if (this.held) {
      this._d.setInteractionBlocked(true);
      return;
    }
    this._d.setInteractionBlocked(false);
    this._safe(() => this._d.lockPointer());
    this._d.attachCamera();
  }

  /** Pointer lock throws in headless runs and before a user gesture; that's fine. */
  private _safe(fn: () => void): void {
    try { fn(); } catch { /* no pointer lock here */ }
  }
}
