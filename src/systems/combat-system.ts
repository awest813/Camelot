import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { NPC } from "../entities/npc";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

const MELEE_DAMAGE = 10;
const MAGIC_DAMAGE = 20;

export class CombatSystem {
  public scene: Scene;
  public player: Player;
  public npcs: NPC[];
  private _ui: UIManager;

  // Scratch vectors for performance optimization
  private _currentVel: Vector3 = new Vector3();
  private _dir: Vector3 = new Vector3();
  private _newVel: Vector3 = new Vector3();
  private _lookAtTarget: Vector3 = new Vector3();
  private _hitPos: Vector3 = new Vector3();

  // Reusable offsets to avoid per-hit Vector3 allocations
  private static readonly _OFFSET_Y1 = new Vector3(0, 1, 0);
  private static readonly _OFFSET_Y2 = new Vector3(0, 2, 0);

  /** Fired with the NPC's mesh name and XP reward whenever an NPC dies. */
  public onNPCDeath: ((npcName: string, xpReward: number) => void) | null = null;

  /** Fired whenever the player takes damage from an NPC. */
  public onPlayerHit: (() => void) | null = null;

  constructor(scene: Scene, player: Player, npcs: NPC[], ui: UIManager) {
    this.scene = scene;
    this.player = player;
    this.npcs = npcs;
    this._ui = ui;
  }

  public meleeAttack(): void {
    if (this.player.stamina < 15) {
      this._ui.showNotification("Not enough stamina!");
      return;
    }
    this.player.stamina -= 15;

    const hit = this.player.raycastForward(3);

    if (hit && hit.pickedMesh) {
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc && !npc.isDead) {
        // Apply damage (base + equipped weapon bonus)
        const meleeDmg = MELEE_DAMAGE + this.player.bonusDamage;
        npc.takeDamage(meleeDmg);

        // Show damage number above the hit point (reuse scratch vector to avoid allocation)
        const numberPos = hit.pickedPoint
          ? hit.pickedPoint.addToRef(CombatSystem._OFFSET_Y1, this._hitPos)
          : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos);
        this._ui.showDamageNumber(numberPos, meleeDmg, this.scene);

        // Yellow flash: player landed a hit
        this._ui.showHitFlash("rgba(255, 200, 0, 0.25)");

        // Knockback impulse
        if (npc.physicsAggregate?.body) {
          const forward = this.player.camera.getForwardRay(1).direction;
          npc.physicsAggregate.body.applyImpulse(forward.scale(10), hit.pickedPoint!);
        }

        if (npc.isDead) {
          this._ui.showNotification(`${npc.mesh.name} defeated!`);
          if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward);
        } else {
          // Aggro the NPC
          npc.isAggressive = true;
        }
      }
    }
  }

  public magicAttack(): void {
    if (this.player.magicka < 20) {
      this._ui.showNotification("Not enough magicka!");
      return;
    }
    this.player.magicka -= 20;

    const origin = this.player.camera.position.add(this.player.camera.getForwardRay(1).direction);
    const projectile = MeshBuilder.CreateSphere("fireball", { diameter: 0.5 }, this.scene);
    projectile.position = origin.clone();

    const material = new StandardMaterial("fireballMat", this.scene);
    material.diffuseColor = Color3.Red();
    material.emissiveColor = new Color3(1, 0.4, 0);
    projectile.material = material;

    const agg = new PhysicsAggregate(projectile, PhysicsShapeType.SPHERE, { mass: 0.5, restitution: 0.1 }, this.scene);
    agg.body.setMotionType(PhysicsMotionType.DYNAMIC);

    const forward = this.player.camera.getForwardRay(1).direction;
    agg.body.applyImpulse(forward.scale(20), origin);

    // Check for NPC collision every other frame until the fireball is gone
    let alive = true;
    let elapsedMs = 0;
    let _fbFrame = 0;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      if (!alive) return;

      // Skip odd frames — halves the per-fireball collision work each frame
      if (++_fbFrame % 2 !== 0) return;

      // Auto-clean after 5 seconds
      elapsedMs += this.scene.getEngine().getDeltaTime() * 2; // *2 because we skip half the frames
      if (elapsedMs >= 5000) {
        alive = false;
        this.scene.onBeforeRenderObservable.remove(obs);
        if (!projectile.isDisposed()) {
          projectile.dispose();
        }
        if (agg.body && !agg.body.isDisposed) {
          agg.dispose();
        }
        return;
      }

      const projPos = projectile.position;
      for (const npc of this.npcs) {
        if (npc.isDead) continue;
        if (Vector3.DistanceSquared(projPos, npc.mesh.position) <= 1.44) { // 1.2^2 = 1.44
          const magicDmg = MAGIC_DAMAGE + this.player.bonusMagicDamage;
          npc.takeDamage(magicDmg);
          this._ui.showDamageNumber(
            npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos),
            magicDmg,
            this.scene
          );
          this._ui.showHitFlash("rgba(255, 100, 0, 0.3)");
          npc.isAggressive = true;
          if (npc.isDead) {
            this._ui.showNotification(`${npc.mesh.name} defeated!`);
            if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward);
          }
          // Detonate fireball
          alive = false;
          this.scene.onBeforeRenderObservable.remove(obs);
          if (!projectile.isDisposed()) {
            projectile.dispose();
          }
          if (agg.body && !agg.body.isDisposed) {
            agg.dispose();
          }
          return;
        }
      }
    });
  }

  /**
   * Update NPC combat AI. Call once per frame with deltaTime in seconds.
   * Aggressive NPCs will attack the player when close enough.
   */
  public updateNPCAI(deltaTime: number): void {
    const playerPos = this.player.camera.position;

    for (const npc of this.npcs) {
      if (npc.isDead) continue;

      // Use squared distances to avoid sqrt overhead on every NPC every frame
      const distSq = Vector3.DistanceSquared(npc.mesh.position, playerPos);
      const aggroRangeSq = npc.aggroRange * npc.aggroRange;
      const attackRangeSq = npc.attackRange * npc.attackRange;

      // Enter aggro if player gets close
      if (!npc.isAggressive && distSq <= aggroRangeSq) {
        npc.isAggressive = true;
      }

      if (!npc.isAggressive) continue;

      // Leave aggro if player runs far away (4 * aggroRange^2 == (2*aggroRange)^2)
      if (distSq > 4 * aggroRangeSq) {
        npc.isAggressive = false;
        continue;
      }

      // Chase or stop based on distance
      if (npc.physicsAggregate?.body) {
        npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
        if (distSq > attackRangeSq) {
          // Move toward player, preserve Y for gravity
          playerPos.subtractToRef(npc.mesh.position, this._dir);
          this._dir.y = 0;
          this._dir.normalize();
          this._dir.scaleToRef(npc.moveSpeed, this._newVel);

          this._newVel.y = this._currentVel.y;
          npc.physicsAggregate.body.setLinearVelocity(this._newVel);

          this._lookAtTarget.set(playerPos.x, npc.mesh.position.y, playerPos.z);
          npc.mesh.lookAt(this._lookAtTarget);
        } else {
          // In attack range — stop horizontal movement
          this._newVel.set(0, this._currentVel.y, 0);
          npc.physicsAggregate.body.setLinearVelocity(this._newVel);
        }
      }

      // Tick attack cooldown
      npc.attackTimer -= deltaTime;
      if (npc.attackTimer > 0) continue;

      // Attack if within melee range
      if (distSq <= attackRangeSq) {
        npc.attackTimer = npc.attackCooldown;
        const rawDmg = npc.attackDamage;
        // Reduce incoming damage by player armor (minimum 1)
        const dmg = Math.max(1, rawDmg - this.player.bonusArmor);
        this.player.health = Math.max(0, this.player.health - dmg);
        // Red flash: player took damage
        this._ui.showHitFlash("rgba(200, 0, 0, 0.4)");
        if (this.onPlayerHit) this.onPlayerHit();
        this._ui.showNotification(`${npc.mesh.name} attacks you for ${dmg} damage!`, 2000);
      }
    }
  }
}
