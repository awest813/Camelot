import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { AIState, NPC } from "../entities/npc";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";
import { StealthSystem } from "./stealth-system";
import { applyDamageWithResistance, WEAPON_PROFILES } from "./combat-shared";
import type { SkillProgressionSystem } from "./skill-progression-system";
import type { AttributeSystem } from "./attribute-system";
import { ObjectPool } from "./object-pool";

const ARROW_SPEED          = 40;
const BASE_ARROW_DAMAGE    = 15;
const ARROW_LIFETIME       = 5.0;   // seconds
const ARROW_STAMINA_COST   = 8;
const BOW_COOLDOWN         = 0.8;   // seconds between shots
const MAX_ACTIVE_ARROWS    = 10;    // pool cap
const ARROW_HIT_RADIUS     = 1.2;   // distance for NPC hit detection
/** XP granted to marksman when an arrow damages an NPC (mirrors melee hit XP cadence). */
const SKILL_XP_MARKSMAN_HIT = 6;
/** Critical damage multiplier — matches melee {@link CRIT_DAMAGE_MULTIPLIER} in combat-system. */
const ARROW_CRIT_DAMAGE_MULTIPLIER = 2.0;
/** Physical damage number colour (matches combat-system). */
const DMG_COLOR_ARROW_PHYSICAL = "#FF6030";
const DMG_COLOR_ARROW_CRIT = "#FFD700";
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

interface PooledArrow {
  mesh: any;
  aggregate: any;
}

interface ActiveArrow {
  poolIndex: number;
  mesh: any;
  aggregate: any;
  lifetime: number;
  baseDamage: number;
  skipFrames: number;
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
  private _skillSystem: SkillProgressionSystem | null = null;
  private _attributeSystem: AttributeSystem | null = null;
  private _hitPos: Vector3 = new Vector3();

  private _activeArrows: ActiveArrow[] = [];
  private _cooldownRemaining: number = 0;

  private static readonly _POOL_SIZE = 12;

  private readonly _arrowPool: ObjectPool<PooledArrow>;

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

  /** Same contract as {@link CombatSystem.onNPCDeath} — fired when an arrow kill lands. */
  public onNPCDeath: ((npcName: string, xpReward: number, npc: NPC) => void) | null = null;

  private static readonly _DMG_OFFSET_Y2 = new Vector3(0, 2, 0);

  constructor(
    scene: Scene,
    player: Player,
    npcs: NPC[],
    ui: UIManager,
    opts?: {
      skillSystem?: SkillProgressionSystem | null;
      attributeSystem?: AttributeSystem | null;
    }
  ) {
    this._scene  = scene;
    this._player = player;
    this._npcs   = npcs;
    this._ui     = ui;
    this._skillSystem = opts?.skillSystem ?? null;
    this._attributeSystem = opts?.attributeSystem ?? null;

    this._arrowPool = new ObjectPool<PooledArrow>(
      () => this._createArrowMesh(),
      (a) => this._resetArrowMesh(a),
      ProjectileSystem._POOL_SIZE,
      ProjectileSystem._POOL_SIZE,
      (a) => this._disposePooledArrow(a),
    );
  }

  private _createArrowMesh(): PooledArrow {
    const mesh = MeshBuilder.CreateCylinder(
      `arrow_pooled_${Date.now()}_${Math.random()}`,
      { diameter: 0.05, height: 0.6, tessellation: 4 },
      this._scene,
    );
    const mat = new StandardMaterial(`arrowMat_pooled_${Date.now()}`, this._scene);
    mat.diffuseColor = new Color3(0.6, 0.45, 0.2);
    mesh.material = mat;
    const aggregate = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.SPHERE,
      { mass: 0.1, restitution: 0.0 },
      this._scene,
    );
    aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    mesh.setEnabled(false);
    mesh.isVisible = false;
    return { mesh, aggregate };
  }

  private _resetArrowMesh(item: PooledArrow): void {
    item.mesh.setEnabled(false);
    item.mesh.isVisible = false;
    item.aggregate.body.disablePreStep = false;
  }

  private _disposePooledArrow(item: PooledArrow): void {
    if (!item.mesh.isDisposed()) {
      try { item.aggregate.dispose(); } catch { }
      item.mesh.dispose();
    }
  }

  // ── NPC list hot-swap ─────────────────────────────────────────────────────

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

  public setScalingSystems(opts: {
    skillSystem?: SkillProgressionSystem | null;
    attributeSystem?: AttributeSystem | null;
  }): void {
    if (opts.skillSystem !== undefined) {
      this._skillSystem = opts.skillSystem;
    }
    if (opts.attributeSystem !== undefined) {
      this._attributeSystem = opts.attributeSystem;
    }
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
    if (this._player.stamina < this._arrowStaminaCost()) {
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

    if (this._player.stamina < this._arrowStaminaCost()) {
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
    while (this._activeArrows.length >= MAX_ACTIVE_ARROWS) {
      this._disposeArrow(this._activeArrows.shift()!);
    }

    const arrowProfile = ARROW_PROFILES[this.equippedArrowType];

    const origin  = this._player.camera.position.clone();
    origin.y += ARROW_SPAWN_Y_OFFSET;
    const forward = this._player.getForwardDirection(1).normalize();

    const bowProf = WEAPON_PROFILES.bow;
    const marksLevel = this._marksmanLevel();
    const skillBonus = marksLevel * 0.2;

    const spread = Math.max(0, (100 - marksLevel) / 1000);
    const direction = new Vector3(
      forward.x + (Math.random() - 0.5) * spread,
      forward.y + (Math.random() - 0.5) * spread,
      forward.z,
    ).normalize();

    const pooled = this._arrowPool.acquire();
    const mesh = pooled.mesh;
    const aggregate = pooled.aggregate;

    mesh.position = origin.add(forward.scale(ARROW_SPAWN_FORWARD));
    mesh.lookAt(mesh.position.add(direction));
    mesh.setEnabled(true);
    mesh.isVisible = true;



    const launchSpeed = ARROW_SPEED * arrowProfile.speedMultiplier;
    aggregate.body.applyImpulse(direction.scale(launchSpeed * 0.1), mesh.position);

    const baseDamage = Math.max(1, Math.round(
      (BASE_ARROW_DAMAGE + skillBonus + this._player.bonusDamage + this._agilityRangedBonus())
      * arrowProfile.damageMultiplier
      * drawFraction
      * bowProf.damageMultiplier
      * this._fatigueFactor()
      * this._marksmanMultiplier(),
    ));

    const isSneakShot = this.stealthSystem?.isCrouching === true;

    this._activeArrows.push({
      poolIndex: 0,
      mesh,
      aggregate,
      lifetime:   ARROW_LIFETIME,
      baseDamage,
      skipFrames: 1,
      isSneakShot,
    });

    const staminaCost = this._arrowStaminaCost();
    this._player.stamina = Math.max(0, this._player.stamina - staminaCost);
    this._player.notifyResourceSpent("stamina");
    this._cooldownRemaining = this._scaledBowCooldown(BOW_COOLDOWN);
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
          const bowProf = WEAPON_PROFILES.bow;

          let raw = arrow.baseDamage;
          let isSneakAttack = false;
          if (
            arrow.isSneakShot &&
            this.stealthSystem &&
            this.stealthSystem.getDetectionLevel(npc) < SNEAK_ATTACK_DETECTION_THRESHOLD
          ) {
            raw = Math.round(raw * BOW_SNEAK_ATTACK_MULTIPLIER);
            isSneakAttack = true;
          }

          const baseCrit =
            (this._player as unknown as { critChance?: number }).critChance ?? 0;
          const effectiveCritChance = baseCrit + bowProf.critChanceBonus;
          const isCrit = effectiveCritChance > 0 && Math.random() < effectiveCritChance;
          if (isCrit) {
            raw = Math.round(raw * ARROW_CRIT_DAMAGE_MULTIPLIER);
          }

          const finalDamage = applyDamageWithResistance(
            raw,
            npc,
            "physical",
            bowProf.armorPenFraction,
          );

          npc.takeDamage(finalDamage);
          this._skillSystem?.gainXP("marksman", SKILL_XP_MARKSMAN_HIT);

          const numPos = npc.mesh.position.addToRef(ProjectileSystem._DMG_OFFSET_Y2, this._hitPos);
          this._ui.showDamageNumber(
            numPos,
            finalDamage,
            this._scene,
            isCrit ? DMG_COLOR_ARROW_CRIT : DMG_COLOR_ARROW_PHYSICAL,
          );
          this._ui.applyHitStop(isCrit ? 85 : 45);
          this._ui.shakeCamera(isCrit ? 0.38 : 0.2);
          this._ui.showHitFlash(
            isCrit ? "rgba(255, 215, 0, 0.32)" : "rgba(255, 120, 60, 0.22)",
          );

          if (isSneakAttack) {
            this._ui.showNotification(
              `Sneak shot! ${npc.mesh.name} — ${finalDamage}`,
              1600,
            );
          } else if (isCrit) {
            this._ui.showNotification("Critical shot!", 900);
          }

          npc.isAggressive = true;
          if (!npc.isDead && npc.aiState !== AIState.CHASE && npc.aiState !== AIState.ATTACK) {
            npc.aiState = AIState.CHASE;
          }

          if (npc.isDead) {
            this._ui.showNotification(`${npc.mesh.name} defeated!`);
            if (this.onNPCDeath) {
              this.onNPCDeath(npc.mesh.name, npc.xpReward, npc);
            }
          }

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

  private _marksmanMultiplier(): number {
    return this._skillSystem?.multiplier("marksman") ?? 1;
  }

  /** Mirrors melee cadence scaling from CombatSystem — higher marksman → cheaper shots. */
  private _marksmanCadenceMultiplier(): number {
    const m = this._marksmanMultiplier();
    return 1 + (m - 1) * 0.6;
  }

  private _fatigueFactor(): number {
    const maxStamina = (this._player as unknown as { maxStamina?: number }).maxStamina ?? 100;
    if (maxStamina <= 0) return 1.0;
    return Math.max(0.5, this._player.stamina / maxStamina);
  }

  /** Small agility-derived bonus — bows reward dexterity without duplicating strength melee scaling. */
  private _agilityRangedBonus(): number {
    if (!this._attributeSystem) return 0;
    return (this._attributeSystem.get("agility") - 40) * 0.15;
  }

  private _marksmanLevel(): number {
    return this._skillSystem?.getSkill("marksman")?.level ?? this.archerySkill;
  }

  private _scaledArrowStaminaCost(base: number): number {
    const scaled = base / this._marksmanCadenceMultiplier();
    return Math.max(1, Math.round(scaled));
  }

  private _scaledBowCooldown(base: number): number {
    const scaled = base / this._marksmanCadenceMultiplier();
    return Math.max(base * 0.5, scaled);
  }

  private _arrowStaminaCost(): number {
    const bow = WEAPON_PROFILES.bow;
    const base = Math.max(1, Math.round(ARROW_STAMINA_COST * bow.staminaCostMultiplier));
    return this._scaledArrowStaminaCost(base);
  }

  private _disposeArrow(arrow: ActiveArrow): void {
    if (arrow.mesh.isDisposed()) return;
    this._arrowPool.release({ mesh: arrow.mesh, aggregate: arrow.aggregate });
  }
}
