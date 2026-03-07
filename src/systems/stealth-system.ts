import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC, AIState } from "../entities/npc";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";

export type MovementMode = "crouching" | "walking" | "running";

export interface StealthSnapshot {
  isCrouching: boolean;
}

/** Detection field-of-view half-angle: 36° → 72° total cone. */
const DETECTION_CONE_HALF_ANGLE = Math.PI / 5;
/** Base sight range in full daylight while standing. */
const BASE_SIGHT_RANGE = 20;
/** Hearing radius when running. */
const HEAR_RANGE_RUNNING = 15;
/** Hearing radius when walking normally. */
const HEAR_RANGE_WALKING = 7;
/** Hearing radius when crouching (sneaking). */
const HEAR_RANGE_CROUCHING = 3;
/** How fast detection builds (units per second) when player is visible. */
const SIGHT_DETECTION_RATE = 60;
/** How fast detection builds (units per second) when player is audible only. */
const HEAR_DETECTION_RATE = 40;
/** How fast detection decays (units per second) when undetectable. */
const DETECTION_DECAY_RATE = 30;

/**
 * Manages player stealth, NPC detection cones/hearing, and sneaking feedback.
 *
 * Detection model:
 *   - Each living NPC has a vision cone (72°) and a hearing radius.
 *   - Night / low ambient light reduces sight range proportionally.
 *   - Crouching halves visual detection range and uses the smaller hearing radius.
 *   - Running enlarges the hearing radius.
 *   - `detectionLevel` [0-100] per NPC builds when the player is in detection zone.
 *   - When detectionLevel reaches 100 the NPC transitions to ALERT.
 *   - Levels decay once the player leaves the detection zone.
 *
 * Integration:
 *   1. Call `update(deltaTime, ambientIntensity)` every game frame.
 *   2. Call `toggleCrouch()` when the player presses the crouch key.
 *   3. Set `movementMode` to "running" while the player is sprinting.
 *   4. Read `overallDetection` and `stealthLabel` to drive the HUD eye icon.
 */
export class StealthSystem {
  private _player: Player;
  private _npcs: NPC[];
  private _ui: UIManager;

  public isCrouching: boolean = false;
  public movementMode: MovementMode = "walking";

  private _detectionLevels: Map<NPC, number> = new Map();

  /** Fired once when an NPC's detection level first reaches 100. */
  public onDetected: ((npc: NPC) => void) | null = null;

  constructor(player: Player, npcs: NPC[], ui: UIManager) {
    this._player = player;
    this._npcs = npcs;
    this._ui = ui;
  }

  // ── NPC list hot-swap ─────────────────────────────────────────────────────

  public get npcs(): NPC[] {
    return this._npcs;
  }

  public set npcs(value: NPC[]) {
    this._npcs = value;
  }

  // ── Crouch toggle ─────────────────────────────────────────────────────────

  /**
   * Toggle crouch state.  Updates `player.baseSpeed` which Player.update()
   * then applies (together with any encumbrance modifier) each frame.
   * Also directly sets `camera.speed` for immediate feedback in frames where
   * Player.update() has not yet run (e.g. in test environments).
   * Returns the new isCrouching value.
   */
  public toggleCrouch(): boolean {
    this.isCrouching = !this.isCrouching;
    if (this.isCrouching) {
      this.movementMode = "crouching";
      this._player.baseSpeed = 0.25;
      this._player.camera.speed = 0.25;
    } else {
      this.movementMode = "walking";
      this._player.baseSpeed = 0.5;
      this._player.camera.speed = 0.5;
    }
    return this.isCrouching;
  }

  // ── Detection aggregates ──────────────────────────────────────────────────

  /** Highest detection level across all nearby NPCs, 0-100. */
  public get overallDetection(): number {
    let max = 0;
    for (const level of this._detectionLevels.values()) {
      if (level > max) max = level;
    }
    return max;
  }

  /** Text label for the stealth HUD eye icon. */
  public get stealthLabel(): "Hidden" | "Caution" | "Detected" {
    const d = this.overallDetection;
    if (d <= 0)  return "Hidden";
    if (d < 80)  return "Caution";
    return "Detected";
  }

  // ── Main update ───────────────────────────────────────────────────────────

  /**
   * Update detection levels for all NPCs.
   * @param deltaTime       Frame time in seconds.
   * @param ambientIntensity World ambient intensity [0-1] from TimeSystem.
   */
  public update(deltaTime: number, ambientIntensity: number = 1.0): void {
    for (const npc of this._npcs) {
      // Skip NPCs already in full combat — they're aware of the player
      if (npc.isDead || npc.aiState === AIState.ATTACK || npc.aiState === AIState.CHASE) {
        this._detectionLevels.delete(npc);
        continue;
      }

      const canSee  = this._canNPCSee(npc, ambientIntensity);
      const canHear = this._canNPCHear(npc);
      const wasFullyDetected = (this._detectionLevels.get(npc) ?? 0) >= 100;

      if (canSee || canHear) {
        const rate = canSee ? SIGHT_DETECTION_RATE : HEAR_DETECTION_RATE;
        const prev = this._detectionLevels.get(npc) ?? 0;
        const next = Math.min(100, prev + rate * deltaTime);
        this._detectionLevels.set(npc, next);

        if (!wasFullyDetected && next >= 100) {
          npc.aiState = AIState.ALERT;
          npc.isAggressive = true;
          this.onDetected?.(npc);
        }
      } else {
        // Decay while undetectable
        const prev = this._detectionLevels.get(npc) ?? 0;
        const next = Math.max(0, prev - DETECTION_DECAY_RATE * deltaTime);
        this._detectionLevels.set(npc, next);
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _canNPCSee(npc: NPC, ambientIntensity: number): boolean {
    if (npc.isDead) return false;

    const playerPos = this._player.camera.position;
    const npcPos    = npc.mesh.position;
    const toPlayer  = playerPos.subtract(npcPos);
    const dist      = toPlayer.length();

    // Scale detection range by ambient light; crouching halves it
    let sightRange = BASE_SIGHT_RANGE * Math.max(0.1, ambientIntensity);
    if (this.isCrouching) sightRange *= 0.5;

    if (dist > sightRange) return false;

    // Check NPC forward-facing cone
    const npcForward = npc.mesh.getDirection
      ? npc.mesh.getDirection(new Vector3(0, 0, 1))
      : new Vector3(0, 0, 1);

    const dot   = Vector3.Dot(npcForward, toPlayer.normalize());
    const angle = Math.acos(Math.min(1, Math.max(-1, dot)));

    return angle <= DETECTION_CONE_HALF_ANGLE;
  }

  private _canNPCHear(npc: NPC): boolean {
    if (npc.isDead) return false;

    const dist = Vector3.Distance(this._player.camera.position, npc.mesh.position);

    const hearRange =
      this.movementMode === "running"   ? HEAR_RANGE_RUNNING :
      this.movementMode === "crouching" ? HEAR_RANGE_CROUCHING :
      HEAR_RANGE_WALKING;

    return dist <= hearRange;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /** Current detection level for a specific NPC, 0-100. */
  public getDetectionLevel(npc: NPC): number {
    return this._detectionLevels.get(npc) ?? 0;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): StealthSnapshot {
    return { isCrouching: this.isCrouching };
  }

  public restoreFromSave(snapshot: StealthSnapshot): void {
    if (snapshot?.isCrouching && !this.isCrouching) {
      this.toggleCrouch();
    } else if (!snapshot?.isCrouching && this.isCrouching) {
      this.toggleCrouch();
    }
  }
}
