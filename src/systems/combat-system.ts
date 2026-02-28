import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { NPC, AIState } from "../entities/npc";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { NavigationSystem } from "./navigation-system";

const MELEE_DAMAGE = 10;
const MAGIC_DAMAGE = 20;

// State colour palette
const COLOR_IDLE    = Color3.Yellow();
const COLOR_ALERT   = new Color3(1.0, 0.55, 0.0);  // orange
const COLOR_CHASE   = Color3.Red();
const COLOR_RETURN  = new Color3(1.0, 0.85, 0.0);  // warm yellow — calming down

export class CombatSystem {
  public scene: Scene;
  public player: Player;
  public npcs: NPC[];
  private _ui: UIManager;
  private _nav: NavigationSystem | null;

  // Scratch vectors — reused every frame to avoid GC pressure
  private _currentVel: Vector3 = new Vector3();
  private _dir: Vector3 = new Vector3();
  private _newVel: Vector3 = new Vector3();
  private _lookAtTarget: Vector3 = new Vector3();
  private _hitPos: Vector3 = new Vector3();

  private static readonly _OFFSET_Y1 = new Vector3(0, 1, 0);
  private static readonly _OFFSET_Y2 = new Vector3(0, 2, 0);

  /** Fired with the NPC's mesh name and XP reward whenever an NPC dies. */
  public onNPCDeath: ((npcName: string, xpReward: number) => void) | null = null;

  /** Fired whenever the player takes damage from an NPC. */
  public onPlayerHit: (() => void) | null = null;

  constructor(
    scene: Scene,
    player: Player,
    npcs: NPC[],
    ui: UIManager,
    nav?: NavigationSystem
  ) {
    this.scene = scene;
    this.player = player;
    this.npcs = npcs;
    this._ui = ui;
    this._nav = nav ?? null;
  }

  // ─── Player actions ────────────────────────────────────────────────────────

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
        const meleeDmg = MELEE_DAMAGE + this.player.bonusDamage;
        npc.takeDamage(meleeDmg);

        const numberPos = hit.pickedPoint
          ? hit.pickedPoint.addToRef(CombatSystem._OFFSET_Y1, this._hitPos)
          : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos);
        this._ui.showDamageNumber(numberPos, meleeDmg, this.scene);
        this._ui.showHitFlash("rgba(255, 200, 0, 0.25)");

        if (npc.physicsAggregate?.body) {
          const forward = this.player.camera.getForwardRay(1).direction;
          npc.physicsAggregate.body.applyImpulse(forward.scale(10), hit.pickedPoint!);
        }

        if (npc.isDead) {
          this._ui.showNotification(`${npc.mesh.name} defeated!`);
          if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward);
        } else {
          // A direct hit skips the ALERT window — immediately give chase.
          // Don't re-transition if already chasing/attacking (would reset path).
          if (npc.aiState !== AIState.CHASE && npc.aiState !== AIState.ATTACK) {
            this._transitionTo(npc, AIState.CHASE);
          }
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

    const agg = new PhysicsAggregate(
      projectile, PhysicsShapeType.SPHERE, { mass: 0.5, restitution: 0.1 }, this.scene
    );
    agg.body.setMotionType(PhysicsMotionType.DYNAMIC);

    const forward = this.player.camera.getForwardRay(1).direction;
    agg.body.applyImpulse(forward.scale(20), origin);

    let alive = true;
    let elapsedMs = 0;
    let _fbFrame = 0;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      if (!alive) return;
      if (++_fbFrame % 2 !== 0) return;

      elapsedMs += this.scene.getEngine().getDeltaTime() * 2;
      if (elapsedMs >= 5000) {
        alive = false;
        this.scene.onBeforeRenderObservable.remove(obs);
        if (!projectile.isDisposed()) projectile.dispose();
        if (agg.body && !agg.body.isDisposed) agg.dispose();
        return;
      }

      const projPos = projectile.position;
      for (const npc of this.npcs) {
        if (npc.isDead) continue;
        if (Vector3.DistanceSquared(projPos, npc.mesh.position) <= 1.44) {
          const magicDmg = MAGIC_DAMAGE + this.player.bonusMagicDamage;
          npc.takeDamage(magicDmg);
          this._ui.showDamageNumber(
            npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos),
            magicDmg,
            this.scene
          );
          this._ui.showHitFlash("rgba(255, 100, 0, 0.3)");

          if (npc.isDead) {
            this._ui.showNotification(`${npc.mesh.name} defeated!`);
            if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward);
          } else if (npc.aiState !== AIState.CHASE && npc.aiState !== AIState.ATTACK) {
            this._transitionTo(npc, AIState.CHASE);
          }

          alive = false;
          this.scene.onBeforeRenderObservable.remove(obs);
          if (!projectile.isDisposed()) projectile.dispose();
          if (agg.body && !agg.body.isDisposed) agg.dispose();
          return;
        }
      }
    });
  }

  // ─── NPC AI update (state machine) ────────────────────────────────────────

  /**
   * Drive every NPC's AI state machine. Call once per frame with deltaTime in seconds.
   *
   * State machine overview
   * ──────────────────────
   *  IDLE/PATROL → ALERT   : player enters aggroRange  (brief hesitation)
   *  ALERT       → CHASE   : alertDuration elapsed, player still nearby
   *  ALERT       → PATROL  : player escaped during alert window
   *  CHASE       → ATTACK  : player within attackRange
   *  CHASE       → RETURN  : player exceeded 2×aggroRange
   *  ATTACK      → CHASE   : player stepped back out of attackRange
   *  ATTACK      → RETURN  : player exceeded 2×aggroRange
   *  RETURN      → ALERT   : player re-enters aggroRange during return trip
   *  RETURN      → PATROL  : NPC reached spawnPosition
   */
  public updateNPCAI(deltaTime: number): void {
    const playerPos = this.player.camera.position;

    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      this._tickNPC(npc, playerPos, deltaTime);
    }
  }

  // ─── State machine implementation ──────────────────────────────────────────

  private _tickNPC(npc: NPC, playerPos: Vector3, deltaTime: number): void {
    const distSq      = Vector3.DistanceSquared(npc.mesh.position, playerPos);
    const aggroRangeSq  = npc.aggroRange * npc.aggroRange;
    const attackRangeSq = npc.attackRange * npc.attackRange;
    const deaggroRangeSq = 4 * aggroRangeSq; // (2 × aggroRange)²

    switch (npc.aiState) {

      // ── IDLE ──────────────────────────────────────────────────────────────
      case AIState.IDLE:
        // Auto-promote to PATROL if patrol points have been assigned
        if (npc.patrolPoints.length > 0) {
          npc.aiState = AIState.PATROL; // quiet upgrade, no colour/flag change
        }
        if (distSq <= aggroRangeSq) {
          this._transitionTo(npc, AIState.ALERT);
        }
        break;

      // ── PATROL ────────────────────────────────────────────────────────────
      case AIState.PATROL:
        // ScheduleSystem owns movement in this state.
        if (distSq <= aggroRangeSq) {
          this._transitionTo(npc, AIState.ALERT);
        }
        break;

      // ── ALERT ─────────────────────────────────────────────────────────────
      case AIState.ALERT:
        npc.alertTimer += deltaTime;
        if (distSq > deaggroRangeSq) {
          // Player escaped while we were still hesitating
          this._transitionTo(npc, npc.patrolPoints.length > 0 ? AIState.PATROL : AIState.IDLE);
        } else if (npc.alertTimer >= npc.alertDuration) {
          this._transitionTo(npc, AIState.CHASE);
        }
        break;

      // ── CHASE ─────────────────────────────────────────────────────────────
      case AIState.CHASE:
        if (distSq > deaggroRangeSq) {
          this._transitionTo(npc, AIState.RETURN);
          break;
        }
        if (distSq <= attackRangeSq) {
          this._transitionTo(npc, AIState.ATTACK);
          break;
        }
        this._chasePlayer(npc, playerPos, deltaTime);
        break;

      // ── ATTACK ────────────────────────────────────────────────────────────
      case AIState.ATTACK:
        if (distSq > deaggroRangeSq) {
          this._transitionTo(npc, AIState.RETURN);
          break;
        }
        if (distSq > attackRangeSq) {
          this._transitionTo(npc, AIState.CHASE);
          break;
        }
        // Stop horizontal movement, face the player
        this._stopMovement(npc);
        this._faceTarget(npc, playerPos);

        // Melee attack on cooldown
        npc.attackTimer -= deltaTime;
        if (npc.attackTimer <= 0) {
          npc.attackTimer = npc.attackCooldown;
          const dmg = Math.max(1, npc.attackDamage - this.player.bonusArmor);
          this.player.health = Math.max(0, this.player.health - dmg);
          this._ui.showHitFlash("rgba(200, 0, 0, 0.4)");
          if (this.onPlayerHit) this.onPlayerHit();
          this._ui.showNotification(`${npc.mesh.name} attacks you for ${dmg} damage!`, 2000);
        }
        break;

      // ── RETURN ────────────────────────────────────────────────────────────
      case AIState.RETURN:
        // Re-aggro if player wanders close again
        if (distSq <= aggroRangeSq) {
          this._transitionTo(npc, AIState.ALERT);
          break;
        }
        this._returnToSpawn(npc, deltaTime);
        break;
    }
  }

  // ─── State transition ──────────────────────────────────────────────────────

  /**
   * Apply a state transition: update aiState, sync the legacy isAggressive flag,
   * reset per-state timers, update NPC colour, and clear path state as needed.
   */
  private _transitionTo(npc: NPC, newState: AIState): void {
    npc.aiState = newState;

    // Keep legacy flag in sync for ScheduleSystem / DialogueSystem
    npc.isAggressive = (
      newState === AIState.ALERT  ||
      newState === AIState.CHASE  ||
      newState === AIState.ATTACK ||
      newState === AIState.RETURN
    );

    switch (newState) {
      case AIState.ALERT:
        npc.alertTimer = 0;
        npc.setStateColor(COLOR_ALERT);
        this._stopMovement(npc);
        break;

      case AIState.CHASE:
        // Invalidate any stale path so _chasePlayer computes a fresh one
        npc.currentPath = [];
        npc.pathIndex = 0;
        npc.pathRefreshTimer = 0;
        npc.setStateColor(COLOR_CHASE);
        break;

      case AIState.ATTACK:
        this._stopMovement(npc);
        npc.setStateColor(COLOR_CHASE); // stay red while attacking
        break;

      case AIState.RETURN:
        npc.currentPath = [];
        npc.pathIndex = 0;
        npc.pathRefreshTimer = 0;
        npc.setStateColor(COLOR_RETURN);
        break;

      case AIState.PATROL:
      case AIState.IDLE:
        npc.currentPath = [];
        npc.setStateColor(COLOR_IDLE);
        this._stopMovement(npc);
        break;
    }
  }

  // ─── Movement helpers ──────────────────────────────────────────────────────

  /**
   * Move an NPC toward its next path waypoint using physics velocity.
   * If the navmesh is ready a computed path is used; otherwise the NPC heads
   * directly toward the player (straight-line fallback).
   * The path is refreshed every pathRefreshInterval seconds or when exhausted.
   */
  private _chasePlayer(npc: NPC, playerPos: Vector3, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;

    npc.pathRefreshTimer -= deltaTime;
    const exhausted   = npc.pathIndex >= npc.currentPath.length;
    const timedOut    = npc.pathRefreshTimer <= 0;

    if (exhausted || timedOut) {
      npc.pathRefreshTimer = npc.pathRefreshInterval;
      if (this._nav?.isReady) {
        npc.currentPath = this._nav.findPath(npc.mesh.position, playerPos);
      } else {
        // Fallback: single direct-line waypoint
        npc.currentPath = [playerPos.clone()];
      }
      npc.pathIndex = 0;
    }

    this._followPath(npc, npc.moveSpeed);
  }

  /**
   * Move an NPC back to its spawn position using pathfinding (or direct line).
   * Transitions to PATROL/IDLE once close enough to the spawn point.
   */
  private _returnToSpawn(npc: NPC, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;

    npc.pathRefreshTimer -= deltaTime;
    const exhausted = npc.pathIndex >= npc.currentPath.length;
    const timedOut  = npc.pathRefreshTimer <= 0;

    if (exhausted || timedOut) {
      npc.pathRefreshTimer = npc.pathRefreshInterval;
      const target = npc.spawnPosition;
      if (this._nav?.isReady) {
        npc.currentPath = this._nav.findPath(npc.mesh.position, target);
      } else {
        npc.currentPath = [target.clone()];
      }
      npc.pathIndex = 0;
    }

    this._followPath(npc, npc.moveSpeed * 0.8); // slightly slower on the walk home

    // Arrived at home?
    if (Vector3.DistanceSquared(npc.mesh.position, npc.spawnPosition) < 4.0) {
      this._transitionTo(npc, npc.patrolPoints.length > 0 ? AIState.PATROL : AIState.IDLE);
    }
  }

  /**
   * Advance the NPC along its currentPath[] using physics velocity.
   * Waypoints within 0.5 m are skipped to prevent oscillation.
   */
  private _followPath(npc: NPC, speed: number): void {
    if (npc.currentPath.length === 0 || npc.pathIndex >= npc.currentPath.length) return;

    const waypoint = npc.currentPath[npc.pathIndex];
    waypoint.subtractToRef(npc.mesh.position, this._dir);
    this._dir.y = 0;
    const distXZ = this._dir.length();

    if (distXZ < 0.5) {
      // Close enough — advance to next waypoint
      npc.pathIndex++;
      return;
    }

    this._dir.normalize();
    this._dir.scaleToRef(speed, this._newVel);
    npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
    this._newVel.y = this._currentVel.y; // preserve gravity
    npc.physicsAggregate.body.setLinearVelocity(this._newVel);

    this._lookAtTarget.set(waypoint.x, npc.mesh.position.y, waypoint.z);
    npc.mesh.lookAt(this._lookAtTarget);
  }

  /** Zero the NPC's horizontal velocity while preserving vertical (gravity). */
  private _stopMovement(npc: NPC): void {
    if (!npc.physicsAggregate?.body) return;
    npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
    this._newVel.set(0, this._currentVel.y, 0);
    npc.physicsAggregate.body.setLinearVelocity(this._newVel);
  }

  /** Rotate the NPC's mesh to face a target position (ignoring Y difference). */
  private _faceTarget(npc: NPC, target: Vector3): void {
    this._lookAtTarget.set(target.x, npc.mesh.position.y, target.z);
    npc.mesh.lookAt(this._lookAtTarget);
  }
}
