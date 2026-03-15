import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { NPC } from "../entities/npc";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";
import { StealthSystem } from "./stealth-system";

const ARROW_SPEED          = 40;
const BASE_ARROW_DAMAGE    = 15;
const ARROW_LIFETIME       = 5.0;   // seconds
const ARROW_STAMINA_COST   = 8;
const BOW_COOLDOWN         = 0.8;   // seconds between shots
const MAX_ACTIVE_ARROWS    = 10;    // pool cap
const ARROW_HIT_RADIUS     = 1.2;   // distance for NPC hit detection
/** How far forward from the camera the arrow spawns to avoid clipping. */
const ARROW_SPAWN_FORWARD  = 0.8;
/** Slight downward eye-level offset so arrows don't clip the top of the FOV. */
const ARROW_SPAWN_Y_OFFSET = -0.1;
/** Seconds to reach a full draw. */
const BOW_DRAW_TIME        = 0.8;
/** Minimum draw fraction before the arrow can be fired (prevents zero-power releases). */
const BOW_MIN_DRAW         = 0.1;
/**
 * Sneak-attack damage multiplier for bow shots.
 * Applied when the player is crouching and the target NPC's detection level < 30.
 */
const BOW_SNEAK_ATTACK_MULTIPLIER = 3.0;
/** Detection threshold below which a bow sneak attack is valid. */
const SNEAK_ATTACK_DETECTION_THRESHOLD = 30;

// ─── Arrow type profiles ──────────────────────────────────────────────────────

/** Available arrow material types ordered by increasing quality. */
export type ArrowType = "iron" | "steel" | "elven" | "daedric";

interface ArrowProfile {
  /** Multiplier applied to the final arrow damage. */
  damageMultiplier: number;
  /** Multiplier applied to arrow launch speed. */
  speedMultiplier: number;
  /**
   * Multiplier applied to BOW_DRAW_TIME for this arrow type.
   * < 1.0 = lighter arrow, draws faster (elven).
   * > 1.0 = heavier arrow, draws slower (daedric).
   */
  drawTimeMultiplier: number;
  /** Human-readable name. */
  label: string;
}

const ARROW_PROFILES: Record<ArrowType, ArrowProfile> = {
  iron:    { damageMultiplier: 1.0,  speedMultiplier: 1.0,  drawTimeMultiplier: 1.00, label: "Iron Arrow"    },
  steel:   { damageMultiplier: 1.25, speedMultiplier: 1.05, drawTimeMultiplier: 1.05, label: "Steel Arrow"   },
  elven:   { damageMultiplier: 1.55, speedMultiplier: 1.10, drawTimeMultiplier: 0.90, label: "Elven Arrow"   },
  daedric: { damageMultiplier: 2.0,  speedMultiplier: 1.15, drawTimeMultiplier: 1.25, label: "Daedric Arrow" },
};

interface ActiveArrow {
  mesh: any;
  aggregate: any;
  lifetime: number;
  /** Base damage dealt on hit — multiplied by the sneak-attack bonus at hit time if applicable. */
  damage: number;
  /** Skip the first N frames after spawn to avoid self-collision. */
  skipFrames: number;
  /**
   * True if this arrow was fired while the player was crouching.
   * The final sneak-attack multiplier is evaluated per-NPC at hit time
   * (only applied when the specific NPC hit is below the detection threshold).
   */
  isSneakShot: boolean;
}

/**
 * Manages bow-and-arrow ranged combat.
 *
 * Usage:
 *   - Call `beginDraw()` when the player presses and holds the bow-fire key.
 *   - Call `releaseArrow()` when the key is released to fire at current draw.
 *   - `fireArrow()` is a convenience wrapper (instant fire at full draw).
 *   - Call `update(deltaTime)` every game frame to advance draw, flight, and
 *     hit detection.
 *   - `archerySkill` (1-100) scales arrow damage and reduces spread.
 *   - `arrowCount` tracks quiver ammo; set to -1 for infinite arrows.
 *   - `equippedArrowType` selects which arrow profile is active.
 *   - `stealthSystem` enables sneak-attack bonuses.
 *
 * Accuracy model:
 *   Spread decreases linearly with archery skill.
 *   At skill 1   → ±0.099 rad spread.
 *   At skill 50  → ±0.05 rad spread.
 *   At skill 100 → zero spread (perfect accuracy).
 *
 * Draw time model:
 *   Draw progress [0-1] builds over BOW_DRAW_TIME seconds.
 *   Damage is multiplied by draw progress (partial draw = reduced damage).
 *   Releases below BOW_MIN_DRAW are silently cancelled.
 */
export class ProjectileSystem {
  private _scene: Scene;
  private _player: Player;
  private _npcs: NPC[];
  private _ui: UIManager;

  private _activeArrows: ActiveArrow[] = [];
  private _cooldownRemaining: number = 0;

  /** Draw progress [0-1].  Increases while `_isDrawing` until BOW_DRAW_TIME. */
  private _drawProgress: number = 0;
  /** True while the player is actively holding the bow draw key. */
  private _isDrawing: boolean = false;

  /** True while the player is holding aim (e.g. right-click hold). */
  public isAiming: boolean = false;

  /** Archery skill level 1-100.  Affects damage and spread. */
  public archerySkill: number = 20;

  /** Remaining arrows in quiver.  -1 = infinite. */
  public arrowCount: number = 20;

  /** Currently equipped arrow type.  Affects damage and speed. */
  public equippedArrowType: ArrowType = "iron";

  /**
   * Optional reference to the StealthSystem.
   * When set, arrows fired while the player is crouching and undetected deal
   * a sneak-attack bonus (BOW_SNEAK_ATTACK_MULTIPLIER).
   */
  public stealthSystem: StealthSystem | null = null;

  constructor(scene: Scene, player: Player, npcs: NPC[], ui: UIManager) {
    this._scene  = scene;
    this._player = player;
    this._npcs   = npcs;
    this._ui     = ui;
  }

  // ── NPC list hot-swap ─────────────────────────────────────────────────────

  public get npcs(): NPC[] {
    return this._npcs;
  }

  public set npcs(value: NPC[]) {
    this._npcs = value;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  public get cooldownRemaining(): number {
    return this._cooldownRemaining;
  }

  public get isReady(): boolean {
    return this._cooldownRemaining <= 0;
  }

  public get activeArrowCount(): number {
    return this._activeArrows.length;
  }

  /** True while the player is actively drawing the bow string. */
  public get isDrawing(): boolean {
    return this._isDrawing;
  }

  /**
   * Current draw progress [0-1].
   * 0 = just started drawing, 1 = fully drawn (max damage / accuracy).
   */
  public get drawProgress(): number {
    return this._drawProgress;
  }

  // ── Draw / Release ────────────────────────────────────────────────────────

  /**
   * Begin drawing the bow.  Call once when the fire key is pressed.
   * Draw progress builds in `update()` until BOW_DRAW_TIME is reached.
   * Does nothing if on cooldown, out of ammo, or lacking stamina.
   * @returns true if drawing has started.
   */
  public beginDraw(): boolean {
    if (this._cooldownRemaining > 0) return false;
    if (this.arrowCount === 0) {
      this._ui.showNotification("No arrows!", 1500);
      return false;
    }
    if (this._player.stamina < ARROW_STAMINA_COST) {
      this._ui.showNotification("Not enough stamina!", 1500);
      return false;
    }
    this._isDrawing   = true;
    this._drawProgress = 0;
    return true;
  }

  /**
   * Release the drawn arrow.  Fires with damage scaled by current draw progress.
   * Releases below BOW_MIN_DRAW are silently cancelled.
   * @returns true if an arrow was fired.
   */
  public releaseArrow(): boolean {
    if (!this._isDrawing) return false;
    this._isDrawing = false;

    if (this._drawProgress < BOW_MIN_DRAW) {
      this._drawProgress = 0;
      return false; // too little draw — cancel silently
    }

    const fired = this._spawnArrow(this._drawProgress);
    this._drawProgress = 0;
    return fired;
  }

  // ── Fire ──────────────────────────────────────────────────────────────────

  /**
   * Fire one arrow in the player's look direction at full draw.
   * Convenience wrapper around `beginDraw()` + `releaseArrow()`.
   * @returns true if the arrow was successfully fired.
   */
  public fireArrow(): boolean {
    if (this._cooldownRemaining > 0) return false;

    if (this.arrowCount === 0) {
      this._ui.showNotification("No arrows!", 1500);
      return false;
    }

    if (this._player.stamina < ARROW_STAMINA_COST) {
      this._ui.showNotification("Not enough stamina!", 1500);
      return false;
    }

    return this._spawnArrow(1.0);
  }

  // ── Shared spawn ──────────────────────────────────────────────────────────

  /**
   * Internal: spawn an arrow with damage scaled by `drawFraction` [0-1].
   * Handles pool cap, resource deduction, sneak-attack bonuses, and arrow type.
   * @param drawFraction  1.0 = full draw (max damage), lower = partial.
   */
  private _spawnArrow(drawFraction: number): boolean {
    // FIFO pool cap: evict the oldest in-flight arrow when the pool is full.
    // Keeps active-arrow count bounded to MAX_ACTIVE_ARROWS for performance and
    // visual clarity (avoids dozens of arrows cluttering the scene at once).
    while (this._activeArrows.length >= MAX_ACTIVE_ARROWS) {
      this._disposeArrow(this._activeArrows.shift()!);
    }

    const arrowProfile = ARROW_PROFILES[this.equippedArrowType];

    const origin  = this._player.camera.position.clone();
    origin.y += ARROW_SPAWN_Y_OFFSET; // slight below eye-level
    const forward = this._player.getForwardDirection(1).normalize();

    // Spread decreases with archery skill (0 spread at skill 100)
    const spread = Math.max(0, (100 - this.archerySkill) / 1000);
    const direction = new Vector3(
      forward.x + (Math.random() - 0.5) * spread,
      forward.y + (Math.random() - 0.5) * spread,
      forward.z,
    ).normalize();

    const mesh = MeshBuilder.CreateCylinder(
      `arrow_${Date.now()}`,
      { diameter: 0.05, height: 0.6, tessellation: 4 },
      this._scene,
    );
    mesh.position = origin.add(forward.scale(ARROW_SPAWN_FORWARD));
    mesh.lookAt(mesh.position.add(direction));

    const mat = new StandardMaterial(`arrowMat_${Date.now()}`, this._scene);
    mat.diffuseColor = new Color3(0.6, 0.45, 0.2);
    mesh.material = mat;

    const launchSpeed = ARROW_SPEED * arrowProfile.speedMultiplier;
    const aggregate = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.SPHERE,
      { mass: 0.1, restitution: 0.0 },
      this._scene,
    );
    aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    aggregate.body.applyImpulse(direction.scale(launchSpeed * 0.1), mesh.position);

    const skillBonus  = this.archerySkill * 0.2;
    const damage = Math.max(1, Math.round(
      (BASE_ARROW_DAMAGE + skillBonus + this._player.bonusDamage)
      * arrowProfile.damageMultiplier
      * drawFraction,
    ));

    // Mark the arrow as a potential sneak shot; the actual multiplier is applied
    // per-NPC at hit time so we only bonus hits on genuinely unaware targets.
    const isSneakShot = this.stealthSystem?.isCrouching === true;

    this._activeArrows.push({
      mesh,
      aggregate,
      lifetime:   ARROW_LIFETIME,
      damage,
      skipFrames: 1,
      isSneakShot,
    });

    // Deduct resources
    this._player.stamina = Math.max(0, this._player.stamina - ARROW_STAMINA_COST);
    this._player.notifyResourceSpent("stamina");
    this._cooldownRemaining = BOW_COOLDOWN;
    if (this.arrowCount > 0) this.arrowCount--;

    return true;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  public update(deltaTime: number): void {
    this._cooldownRemaining = Math.max(0, this._cooldownRemaining - deltaTime);

    // Advance draw progress while drawing — speed scales with arrow type draw multiplier.
    if (this._isDrawing) {
      const arrowProfile = ARROW_PROFILES[this.equippedArrowType];
      const effectiveDrawTime = BOW_DRAW_TIME * arrowProfile.drawTimeMultiplier;
      this._drawProgress = Math.min(1, this._drawProgress + deltaTime / effectiveDrawTime);
    }

    const toDispose: ActiveArrow[] = [];

    for (const arrow of this._activeArrows) {
      arrow.lifetime -= deltaTime;

      if (arrow.skipFrames > 0) {
        arrow.skipFrames--;
        continue;
      }

      if (arrow.lifetime <= 0 || arrow.mesh.isDisposed()) {
        toDispose.push(arrow);
        continue;
      }

      // Distance-based hit detection against NPCs
      let hit = false;
      for (const npc of this._npcs) {
        if (npc.isDead) continue;
        if (Vector3.Distance(arrow.mesh.position, npc.mesh.position) < ARROW_HIT_RADIUS) {
          // Apply per-NPC sneak attack multiplier: only bonus if this exact NPC
          // is below the detection threshold when hit.
          let finalDamage = arrow.damage;
          let isSneakAttack = false;
          if (
            arrow.isSneakShot &&
            this.stealthSystem &&
            this.stealthSystem.getDetectionLevel(npc) < SNEAK_ATTACK_DETECTION_THRESHOLD
          ) {
            finalDamage = Math.round(finalDamage * BOW_SNEAK_ATTACK_MULTIPLIER);
            isSneakAttack = true;
          }

          npc.takeDamage(finalDamage);
          if (isSneakAttack) {
            this._ui.showNotification(
              `Sneak Attack! ×${BOW_SNEAK_ATTACK_MULTIPLIER} — ${npc.mesh.name} -${finalDamage}hp`,
              1800,
            );
          } else {
            this._ui.showNotification(`Arrow hit ${npc.mesh.name}! -${finalDamage}hp`, 1500);
          }
          npc.isAggressive = true;
          hit = true;
          break;
        }
      }

      if (hit) toDispose.push(arrow);
    }

    for (const arrow of toDispose) {
      this._disposeArrow(arrow);
      const idx = this._activeArrows.indexOf(arrow);
      if (idx >= 0) this._activeArrows.splice(idx, 1);
    }
  }

  // ── Ammo helpers ──────────────────────────────────────────────────────────

  public addArrows(count: number): void {
    if (this.arrowCount < 0) return; // infinite quiver
    this.arrowCount += count;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _disposeArrow(arrow: ActiveArrow): void {
    if (arrow.mesh.isDisposed()) return;
    try {
      arrow.aggregate.dispose();
    } catch {
      // ignore – physics may already be gone
    }
    arrow.mesh.dispose();
  }
}
