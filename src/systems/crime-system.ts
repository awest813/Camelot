import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC, AIState } from "../entities/npc";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";

export type CrimeType = "trespass" | "theft" | "assault" | "murder";

export interface CrimeEvent {
  type: CrimeType;
  factionId: string;
  /** Gold added to bounty for this crime. */
  value: number;
  witnessName: string;
  /** In-game minutes when the crime occurred. */
  timestamp: number;
}

export interface CrimeSaveState {
  bounties: Record<string, number>;
  crimes: CrimeEvent[];
}

/** Base bounty values per crime type (gold). */
const CRIME_VALUES: Record<CrimeType, number> = {
  trespass: 5,
  theft:    25,
  assault:  40,
  murder:   1000,
};

const WITNESS_RADIUS     = 15;  // Max range at which NPCs witness crimes
const GUARD_ALERT_RADIUS = 12;  // Range at which a guard challenges the player
const GUARD_CHALLENGE_COOLDOWN = 15; // Seconds before re-challenge after dismissal

/**
 * Tracks player crimes, per-faction bounties, and guard/NPC reactions.
 *
 * Crime flow:
 *   1. `commitCrime(type, factionId, gameTime)` — called by game logic when the
 *      player steals, attacks, etc.
 *   2. Nearby living NPCs become witnesses; bounty is added to the faction.
 *   3. Guards belonging to that faction challenge the player when nearby.
 *   4. `onGuardChallenge` fires so the game can open a dialogue / arrest UI.
 *   5. `payBounty(factionId, gold)` clears the bounty and costs the player gold.
 *   6. `clearAllBounties()` represents jailing / full pardon.
 */
export class CrimeSystem {
  private _player: Player;
  private _npcs: NPC[];
  private _ui: UIManager;

  private _bounties: Map<string, number> = new Map();
  private _crimes: CrimeEvent[] = [];
  private _guardChallengeCooldown: number = 0;

  /**
   * Fired when a guard NPC challenges the player about an active bounty.
   * The game should open a dialogue/arrest UI in response.
   */
  public onGuardChallenge: ((guard: NPC, factionId: string, bounty: number) => void) | null = null;

  constructor(player: Player, npcs: NPC[], ui: UIManager) {
    this._player = player;
    this._npcs   = npcs;
    this._ui     = ui;
  }

  // ── NPC list ───────────────────────────────────────────────────────────────

  public get npcs(): NPC[] {
    return this._npcs;
  }

  public set npcs(value: NPC[]) {
    this._npcs = value;
  }

  // ── Crime reporting ────────────────────────────────────────────────────────

  /**
   * Record a crime committed by the player.
   *
   * Automatically identifies nearby witnesses.  If no NPCs are in range the
   * crime goes unobserved and no bounty is added.
   *
   * @param type      Category of crime.
   * @param factionId Faction whose guards will react (e.g. "town_guard").
   * @param gameTime  Current in-game time (minutes) for the audit log.
   * @param witnesses Optional override list; skips automatic witness scan.
   * @returns New total bounty for the faction (0 if unseen).
   */
  public commitCrime(
    type: CrimeType,
    factionId: string,
    gameTime: number,
    witnesses?: NPC[]
  ): number {
    const actualWitnesses = witnesses ?? this._findNearbyWitnesses();

    if (actualWitnesses.length === 0) return 0; // unobserved

    const value = CRIME_VALUES[type];
    for (const w of actualWitnesses) {
      this._crimes.push({
        type,
        factionId,
        value,
        witnessName: w.mesh.name ?? "Unknown",
        timestamp: gameTime,
      });
    }

    const prev = this._bounties.get(factionId) ?? 0;
    const next = prev + value;
    this._bounties.set(factionId, next);

    this._ui.showNotification(`Crime witnessed! Bounty +${value}g (${factionId})`, 3000);
    return next;
  }

  // ── Bounty accessors ───────────────────────────────────────────────────────

  public getBounty(factionId: string): number {
    return this._bounties.get(factionId) ?? 0;
  }

  public getTotalBounty(): number {
    let total = 0;
    for (const v of this._bounties.values()) total += v;
    return total;
  }

  /**
   * Pay off a faction's bounty with gold.
   * @returns Amount paid, or 0 if the player can't afford it or bounty is 0.
   */
  public payBounty(factionId: string, playerGold: number): number {
    const bounty = this._bounties.get(factionId) ?? 0;
    if (bounty <= 0 || playerGold < bounty) return 0;

    this._bounties.set(factionId, 0);
    this._guardChallengeCooldown = 0;
    this._ui.showNotification(`Bounty paid: ${bounty}g`, 2000);
    return bounty;
  }

  /** Remove all bounties and crime history (jail sentence served / full pardon). */
  public clearAllBounties(): void {
    this._bounties.clear();
    this._crimes = [];
    this._guardChallengeCooldown = 0;
  }

  // ── Guard reactions ────────────────────────────────────────────────────────

  /**
   * Check for nearby guards and fire `onGuardChallenge` when appropriate.
   * Call every game frame.
   */
  public update(deltaTime: number): void {
    this._guardChallengeCooldown = Math.max(0, this._guardChallengeCooldown - deltaTime);

    if (this._guardChallengeCooldown > 0 || this.getTotalBounty() <= 0) return;

    for (const npc of this._npcs) {
      if (npc.isDead) continue;
      if (npc.aiState === AIState.ATTACK || npc.aiState === AIState.CHASE) continue;

      const dist = Vector3.Distance(this._player.camera.position, npc.mesh.position);
      if (dist > GUARD_ALERT_RADIUS) continue;

      // Find the faction with the highest bounty
      let maxBounty  = 0;
      let maxFaction = "";
      for (const [faction, bounty] of this._bounties) {
        if (bounty > maxBounty) { maxBounty = bounty; maxFaction = faction; }
      }

      if (maxFaction && maxBounty > 0) {
        this._guardChallengeCooldown = GUARD_CHALLENGE_COOLDOWN;
        this.onGuardChallenge?.(npc, maxFaction, maxBounty);
      }
      break; // Only one guard challenges at a time
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): CrimeSaveState {
    return {
      bounties: Object.fromEntries(this._bounties.entries()),
      crimes:   [...this._crimes],
    };
  }

  public restoreFromSave(state: CrimeSaveState): void {
    this._bounties.clear();
    for (const [faction, value] of Object.entries(state?.bounties ?? {})) {
      this._bounties.set(faction, value);
    }
    this._crimes = Array.isArray(state?.crimes) ? [...state.crimes] : [];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _findNearbyWitnesses(): NPC[] {
    return this._npcs.filter((npc) => {
      if (npc.isDead) return false;
      return Vector3.Distance(this._player.camera.position, npc.mesh.position) <= WITNESS_RADIUS;
    });
  }
}
