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

const ARROW_SPEED          = 40;
const BASE_ARROW_DAMAGE    = 15;
const ARROW_LIFETIME       = 5.0;   // seconds
const ARROW_STAMINA_COST   = 8;
const BOW_COOLDOWN         = 0.8;   // seconds between shots
const MAX_ACTIVE_ARROWS    = 10;    // pool cap
const ARROW_HIT_RADIUS     = 1.2;   // distance for NPC hit detection

interface ActiveArrow {
  mesh: any;
  aggregate: any;
  lifetime: number;
  damage: number;
  /** Skip the first N frames after spawn to avoid self-collision. */
  skipFrames: number;
}

/**
 * Manages bow-and-arrow ranged combat.
 *
 * Usage:
 *   - Call `fireArrow()` when the player presses the bow-fire key (R / Tab).
 *   - Call `update(deltaTime)` every game frame to advance arrow flight and
 *     perform hit detection.
 *   - `archerySkill` (1-100) scales arrow damage and reduces spread.
 *   - `arrowCount` tracks quiver ammo; set to -1 for infinite arrows.
 *
 * Accuracy model:
 *   Spread decreases linearly with archery skill.
 *   At skill 1   → ±0.099 rad spread.
 *   At skill 50  → ±0.05 rad spread.
 *   At skill 100 → zero spread (perfect accuracy).
 */
export class ProjectileSystem {
  private _scene: Scene;
  private _player: Player;
  private _npcs: NPC[];
  private _ui: UIManager;

  private _activeArrows: ActiveArrow[] = [];
  private _cooldownRemaining: number = 0;

  /** True while the player is holding aim (e.g. right-click hold). */
  public isAiming: boolean = false;

  /** Archery skill level 1-100.  Affects damage and spread. */
  public archerySkill: number = 20;

  /** Remaining arrows in quiver.  -1 = infinite. */
  public arrowCount: number = 20;

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

  // ── Fire ──────────────────────────────────────────────────────────────────

  /**
   * Fire one arrow in the player's look direction.
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

    // Pool cap: remove oldest arrow first
    while (this._activeArrows.length >= MAX_ACTIVE_ARROWS) {
      this._disposeArrow(this._activeArrows.shift()!);
    }

    const origin  = this._player.camera.position.clone();
    origin.y -= 0.1; // slight below eye-level
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
    mesh.position = origin.add(forward.scale(0.8));
    mesh.lookAt(mesh.position.add(direction));

    const mat = new StandardMaterial(`arrowMat_${Date.now()}`, this._scene);
    mat.diffuseColor = new Color3(0.6, 0.45, 0.2);
    mesh.material = mat;

    const aggregate = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.SPHERE,
      { mass: 0.1, restitution: 0.0 },
      this._scene,
    );
    aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    aggregate.body.applyImpulse(direction.scale(ARROW_SPEED * 0.1), mesh.position);

    const skillBonus = this.archerySkill * 0.2;
    const damage = Math.round(BASE_ARROW_DAMAGE + skillBonus + this._player.bonusDamage);

    this._activeArrows.push({
      mesh,
      aggregate,
      lifetime:   ARROW_LIFETIME,
      damage,
      skipFrames: 1,
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
          npc.takeDamage(arrow.damage);
          this._ui.showNotification(`Arrow hit ${npc.mesh.name}! -${arrow.damage}hp`, 1500);
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
