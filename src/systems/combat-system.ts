import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
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

    // Raycast forward 3 units
    const origin = this.player.camera.position;
    const forward = this.player.camera.getForwardRay(3).direction;
    const ray = new Ray(origin, forward, 3);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      return mesh.name !== "playerBody" && !mesh.name.startsWith("chunk_");
    });

    if (hit && hit.pickedMesh) {
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc && !npc.isDead) {
        // Apply damage (base + equipped weapon bonus, minimum 1)
        const meleeDmg = Math.max(1, MELEE_DAMAGE + this.player.bonusDamage);
        npc.takeDamage(meleeDmg);

        // Show damage number above the hit point
        const hitPoint = hit.pickedPoint ?? npc.mesh.position.add(new Vector3(0, 1, 0));
        const numberPos = hitPoint.add(new Vector3(0, 1, 0));
        this._ui.showDamageNumber(numberPos, meleeDmg, this.scene);

        // Yellow flash: player landed a hit
        this._ui.showHitFlash("rgba(255, 200, 0, 0.25)");

        // Knockback impulse
        if (npc.physicsAggregate?.body) {
          npc.physicsAggregate.body.applyImpulse(forward.scale(10), hitPoint);
        }

        if (npc.isDead) {
          this._ui.showNotification(`${npc.mesh.name} defeated!`);
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

    // Check for NPC collision every frame until the fireball is gone
    let alive = true;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      if (!alive) return;
      for (const npc of this.npcs) {
        if (npc.isDead) continue;
        const dist = Vector3.Distance(projectile.position, npc.mesh.position);
        if (dist < 1.2) {
          npc.takeDamage(MAGIC_DAMAGE);
          this._ui.showDamageNumber(
            npc.mesh.position.add(new Vector3(0, 2, 0)),
            MAGIC_DAMAGE,
            this.scene
          );
          this._ui.showHitFlash("rgba(255, 100, 0, 0.3)");
          npc.isAggressive = true;
          if (npc.isDead) this._ui.showNotification(`${npc.mesh.name} defeated!`);
          // Detonate fireball
          alive = false;
          this.scene.onBeforeRenderObservable.remove(obs);
          projectile.dispose();
          agg.dispose();
          return;
        }
      }
    });

    // Auto-clean after 5 seconds
    setTimeout(() => {
      if (alive) {
        alive = false;
        this.scene.onBeforeRenderObservable.remove(obs);
        projectile.dispose();
        agg.dispose();
      }
    }, 5000);
  }

  /**
   * Update NPC combat AI. Call once per frame with deltaTime in seconds.
   * Aggressive NPCs will attack the player when close enough.
   */
  public updateNPCAI(deltaTime: number): void {
    const playerPos = this.player.camera.position;

    for (const npc of this.npcs) {
      if (npc.isDead) continue;

      const dist = Vector3.Distance(npc.mesh.position, playerPos);

      // Enter aggro if player gets close
      if (!npc.isAggressive && dist <= npc.aggroRange) {
        npc.isAggressive = true;
      }

      if (!npc.isAggressive) continue;

      // Leave aggro if player runs far away
      if (dist > npc.aggroRange * 2) {
        npc.isAggressive = false;
        continue;
      }

      // Tick attack cooldown
      npc.attackTimer -= deltaTime;
      if (npc.attackTimer > 0) continue;

      // Attack if within melee range
      if (dist <= npc.attackRange) {
        npc.attackTimer = npc.attackCooldown;
        const rawDmg = npc.attackDamage;
        // Reduce incoming damage by player armor (minimum 1)
        const dmg = Math.max(1, rawDmg - this.player.bonusArmor);
        this.player.health = Math.max(0, this.player.health - dmg);
        // Red flash: player took damage
        this._ui.showHitFlash("rgba(200, 0, 0, 0.4)");
        this._ui.showNotification(`${npc.mesh.name} attacks you for ${dmg} damage!`, 2000);
      }
    }
  }
}
