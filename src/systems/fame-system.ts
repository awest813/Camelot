/**
 * FameSystem — Oblivion-style player fame and infamy tracking.
 *
 * Fame rises when the player completes quests or performs heroic deeds.
 * Infamy rises when the player commits crimes.  The difference between the two
 * drives an NPC disposition modifier that other systems can query:
 *
 *   net > 0  → NPCs are more friendly (up to +20 disposition)
 *   net < 0  → NPCs are more hostile  (down to −20 disposition)
 *   net ≈ 0  → neutral
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.fameSystem = new FameSystem();
 * // On quest complete:
 * this.fameSystem.addFame(10);
 * // On crime committed:
 * this.fameSystem.addInfamy(5);
 * // Query disposition modifier for barter/persuasion:
 * const mod = this.fameSystem.dispositionModifier;
 * ```
 *
 * Oblivion reference: Fame and Infamy each cap at 255 in the original game
 * (stored as bytes).  We use a generous 1000 cap to give the progression more
 * room over a long playthrough.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/** Hard cap for either fame or infamy. */
export const FAME_MAX = 1000;

/**
 * Maximum absolute disposition modifier driven by net fame/infamy.
 * Net +FAME_NET_CAP or above → +DISPOSITION_MAX.
 * Net −FAME_NET_CAP or below → −DISPOSITION_MAX.
 */
const FAME_NET_CAP       = 200;
const DISPOSITION_MAX    = 20;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FameSaveState {
  fame: number;
  infamy: number;
}

// ── System ─────────────────────────────────────────────────────────────────────

export class FameSystem {
  private _fame:   number = 0;
  private _infamy: number = 0;

  /**
   * Fired whenever fame or infamy changes.
   * @param fame   New fame total.
   * @param infamy New infamy total.
   */
  public onFameChange: ((fame: number, infamy: number) => void) | null = null;

  // ── Accessors ──────────────────────────────────────────────────────────────

  public get fame():   number { return this._fame;   }
  public get infamy(): number { return this._infamy; }

  /**
   * Net fame: `fame − infamy`.
   * Positive = heroic reputation; negative = criminal notoriety.
   */
  public get netFame(): number { return this._fame - this._infamy; }

  /**
   * NPC disposition modifier in [−DISPOSITION_MAX, +DISPOSITION_MAX].
   * Positive: NPCs start friendlier (better barter prices, easier persuasion).
   * Negative: NPCs start more hostile.
   */
  public get dispositionModifier(): number {
    const net = Math.max(-FAME_NET_CAP, Math.min(FAME_NET_CAP, this.netFame));
    return Math.round((net / FAME_NET_CAP) * DISPOSITION_MAX);
  }

  /**
   * Human-readable fame tier label.
   * Mirrors Oblivion's lore-appropriate rank names.
   */
  public get fameLabel(): string {
    if (this._fame >= 800) return "Legendary Hero";
    if (this._fame >= 500) return "Champion";
    if (this._fame >= 300) return "Hero";
    if (this._fame >= 150) return "Respected";
    if (this._fame >= 50)  return "Known";
    if (this._fame >= 10)  return "Emerging";
    return "Unknown";
  }

  /**
   * Human-readable infamy tier label.
   */
  public get infamyLabel(): string {
    if (this._infamy >= 800) return "Most Wanted";
    if (this._infamy >= 500) return "Notorious";
    if (this._infamy >= 300) return "Outlaw";
    if (this._infamy >= 150) return "Criminal";
    if (this._infamy >= 50)  return "Suspect";
    if (this._infamy >= 10)  return "Shady";
    return "Clean";
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Increase the player's fame.
   * @param amount Positive amount to add (clamped to 0 minimum).
   */
  public addFame(amount: number): void {
    if (amount <= 0) return;
    this._fame = Math.min(FAME_MAX, this._fame + Math.round(amount));
    this.onFameChange?.(this._fame, this._infamy);
  }

  /**
   * Increase the player's infamy.
   * @param amount Positive amount to add (clamped to 0 minimum).
   */
  public addInfamy(amount: number): void {
    if (amount <= 0) return;
    this._infamy = Math.min(FAME_MAX, this._infamy + Math.round(amount));
    this.onFameChange?.(this._fame, this._infamy);
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  public getSaveState(): FameSaveState {
    return { fame: this._fame, infamy: this._infamy };
  }

  public restoreFromSave(state: FameSaveState): void {
    if (!state || typeof state !== "object") return;
    if (typeof state.fame   === "number" && Number.isFinite(state.fame))
      this._fame   = Math.max(0, Math.min(FAME_MAX, Math.round(state.fame)));
    if (typeof state.infamy === "number" && Number.isFinite(state.infamy))
      this._infamy = Math.max(0, Math.min(FAME_MAX, Math.round(state.infamy)));
  }
}
