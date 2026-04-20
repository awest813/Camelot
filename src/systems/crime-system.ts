import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
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
  private _scene: any;

  private _bounties: Map<string, number> = new Map();
  private _crimes: CrimeEvent[] = [];
  private _guardChallengeCooldown: number = 0;

  /**
   * Fired when a guard NPC challenges the player about an active bounty.
   * The game should open a dialogue/arrest UI in response.
   */
  public onGuardChallenge: ((guard: NPC, factionId: string, bounty: number) => void) | null = null;

  constructor(player: Player, npcs: NPC[], ui: UIManager, scene: any) {
    this._player = player;
    this._npcs   = npcs;
    this._ui     = ui;
    this._scene  = scene;
  }

  // ── NPC list ───────────────────────────────────────────────────────────────

  public get npcs(): NPC[] {
    return this._npcs;
  }

  public set npcs(value: NPC[]) {
    this._npcs = value;
  }

  public removeNPC(npc: NPC): void {
    const idx = this._npcs.indexOf(npc);
    if (idx !== -1) {
      this._npcs.splice(idx, 1);
    }
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

  /** Force-set a faction bounty (clamped to 0+). Returns the new value. */
  public setBounty(factionId: string, value: number): number {
    const next = Math.max(0, Math.round(value));
    this._bounties.set(factionId, next);
    return next;
  }

  /** Adjust a faction bounty by a delta. Returns the new value. */
  public adjustBounty(factionId: string, delta: number): number {
    return this.setBounty(factionId, this.getBounty(factionId) + delta);
  }

  /** Clears a single faction bounty and returns the amount removed. */
  public clearBounty(factionId: string): number {
    const removed = this.getBounty(factionId);
    this._bounties.set(factionId, 0);
    return removed;
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
   *
   * Priority: prefer NPCs that are flagged as guards (`npc.isGuard === true`)
   * and belong to the faction with the active bounty (`npc.factionId`).
   * Fallback: if no faction-matched guard is nearby, any non-hostile living NPC
   * within range can act as an impromptu witness (backward-compatible behaviour).
   */
  public update(deltaTime: number): void {
    this._guardChallengeCooldown = Math.max(0, this._guardChallengeCooldown - deltaTime);

    if (this._guardChallengeCooldown > 0 || this.getTotalBounty() <= 0) return;

    // Determine highest-bounty faction
    let maxBounty  = 0;
    let maxFaction = "";
    for (const [faction, bounty] of this._bounties) {
      if (bounty > maxBounty) { maxBounty = bounty; maxFaction = faction; }
    }
    if (!maxFaction || maxBounty <= 0) return;

    // First pass: find a proper faction guard
    let challenger: typeof this._npcs[0] | null = null;
    for (const npc of this._npcs) {
      if (npc.isDead) continue;
      if (npc.aiState === AIState.ATTACK || npc.aiState === AIState.CHASE) continue;
      const dist = Vector3.Distance(this._player.camera.position, npc.mesh.position);
      if (dist > GUARD_ALERT_RADIUS) continue;
      if (npc.isGuard && npc.factionId === maxFaction) {
        challenger = npc;
        break;
      }
    }

    // Second pass: fall back to any nearby living NPC (guards with no factionId set)
    if (!challenger) {
      for (const npc of this._npcs) {
        if (npc.isDead) continue;
        if (npc.aiState === AIState.ATTACK || npc.aiState === AIState.CHASE) continue;
        const dist = Vector3.Distance(this._player.camera.position, npc.mesh.position);
        if (dist > GUARD_ALERT_RADIUS) continue;
        if (npc.isGuard) {
          challenger = npc;
          break;
        }
      }
    }

    if (challenger) {
      this._guardChallengeCooldown = GUARD_CHALLENGE_COOLDOWN;
      this.onGuardChallenge?.(challenger, maxFaction, maxBounty);
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
      const playerPos = this._player.camera.position;
      const npcPos    = npc.mesh.position;
      const toPlayer  = playerPos.subtract(npcPos);
      const dist      = toPlayer.length();

      if (dist > WITNESS_RADIUS) return false;

      // NPCs only witness crimes if they are roughly facing the player (+/- 90 degrees)
      const npcForward = npc.mesh.getDirection ? npc.mesh.getDirection(new Vector3(0, 0, 1)) : new Vector3(0, 0, 1);
      const dot = Vector3.Dot(npcForward, toPlayer.normalize());
      if (dot < 0) return false; // NPC is facing away

      // Raycast LoS check to ensure they aren't looking through a wall
      const ray = new Ray(
        npcPos.add(new Vector3(0, 1.3, 0)),
        toPlayer.normalize(),
        dist
      );
      const hit = this._scene.pickWithRay(ray, (mesh: any) => {
        return mesh !== npc.mesh && mesh.name !== "player_camera_helper" && mesh.checkCollisions;
      });

      return !hit || !hit.hit;
    });
  }
}
