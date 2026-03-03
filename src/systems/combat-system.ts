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

export type MeleeArchetype = "duelist" | "soldier" | "bruiser";
export type MagicArchetype = "spark" | "bolt" | "surge";

interface MeleeProfile {
  staminaCost: number;
  cooldown: number;
  damageMultiplier: number;
  label: string;
}

interface MagicProfile {
  magickaCost: number;
  cooldown: number;
  damageMultiplier: number;
  projectileImpulse: number;
  label: string;
}

const MELEE_PROFILES: Record<MeleeArchetype, MeleeProfile> = {
  duelist: {
    staminaCost: 9,
    cooldown: 0.32,
    damageMultiplier: 0.82,
    label: "Duelist stance",
  },
  soldier: {
    staminaCost: 15,
    cooldown: 0.45,
    damageMultiplier: 1,
    label: "Soldier stance",
  },
  bruiser: {
    staminaCost: 24,
    cooldown: 0.72,
    damageMultiplier: 1.4,
    label: "Bruiser stance",
  },
};

const MAGIC_PROFILES: Record<MagicArchetype, MagicProfile> = {
  spark: {
    magickaCost: 12,
    cooldown: 0.45,
    damageMultiplier: 0.78,
    projectileImpulse: 17,
    label: "Spark cantrip",
  },
  bolt: {
    magickaCost: 20,
    cooldown: 0.7,
    damageMultiplier: 1,
    projectileImpulse: 20,
    label: "Bolt cast",
  },
  surge: {
    magickaCost: 30,
    cooldown: 1.05,
    damageMultiplier: 1.38,
    projectileImpulse: 23,
    label: "Surge cast",
  },
};

// State colour palette
const COLOR_IDLE        = Color3.Yellow();
const COLOR_ALERT       = new Color3(1.0, 0.55, 0.0);  // orange
const COLOR_CHASE       = Color3.Red();
const COLOR_TELEGRAPH   = new Color3(1.0, 0.15, 0.15);
const COLOR_RETURN      = new Color3(1.0, 0.85, 0.0);  // warm yellow — calming down
const COLOR_INVESTIGATE = new Color3(0.8, 0.65, 0.0);  // amber — cautious search
const MAX_CONCURRENT_ATTACKERS = 1;

export class CombatSystem {
  public scene: Scene;
  public player: Player;
  public npcs: NPC[];
  private _ui: UIManager;
  private _nav: NavigationSystem | null;

  // Scratch vectors — reused every frame to avoid GC pressure
  private _currentVel: Vector3 = new Vector3();
  private _dir: Vector3 = new Vector3();
  private _lateralDir: Vector3 = new Vector3();
  private _newVel: Vector3 = new Vector3();
  private _desiredVel: Vector3 = new Vector3();
  private _blendedVel: Vector3 = new Vector3();
  private _lookAtTarget: Vector3 = new Vector3();
  private _hitPos: Vector3 = new Vector3();
  private _attackReservations: Set<NPC> = new Set();
  private _meleeCooldownRemaining: number = 0;
  private _magicCooldownRemaining: number = 0;
  private _meleeArchetype: MeleeArchetype = "soldier";
  private _magicArchetype: MagicArchetype = "bolt";

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

  public setMeleeArchetype(archetype: MeleeArchetype): void {
    this._meleeArchetype = archetype;
    this._ui.showNotification(`${MELEE_PROFILES[archetype].label} selected`, 1400);
  }

  public setMagicArchetype(archetype: MagicArchetype): void {
    this._magicArchetype = archetype;
    this._ui.showNotification(`${MAGIC_PROFILES[archetype].label} selected`, 1400);
  }

  public get activeMeleeArchetype(): MeleeArchetype {
    return this._meleeArchetype;
  }

  public get activeMagicArchetype(): MagicArchetype {
    return this._magicArchetype;
  }

  // ─── Player actions ────────────────────────────────────────────────────────

  public meleeAttack(): boolean {
    const meleeProfile = MELEE_PROFILES[this._meleeArchetype];
    if (this._meleeCooldownRemaining > 0) {
      return false;
    }

    if (this.player.stamina < meleeProfile.staminaCost) {
      this._ui.showNotification("Not enough stamina!");
      return false;
    }
    this.player.stamina -= meleeProfile.staminaCost;
    this._meleeCooldownRemaining = meleeProfile.cooldown;
    (this.player as unknown as { notifyResourceSpent?: (resource: "magicka" | "stamina") => void })
      .notifyResourceSpent?.("stamina");

    const hit = this.player.raycastForward(3);
    if (hit && hit.pickedMesh) {
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc && !npc.isDead) {
        const meleeDmg = Math.max(
          1,
          Math.round((MELEE_DAMAGE + this.player.bonusDamage) * meleeProfile.damageMultiplier)
        );
        npc.takeDamage(meleeDmg);

        const numberPos = hit.pickedPoint
          ? hit.pickedPoint.addToRef(CombatSystem._OFFSET_Y1, this._hitPos)
          : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos);
        this._ui.showDamageNumber(numberPos, meleeDmg, this.scene);
        this._ui.showHitFlash("rgba(255, 200, 0, 0.25)");

        if (npc.physicsAggregate?.body) {
          const forward = this.player.getForwardDirection(1);
          const impulsePoint = hit.pickedPoint
            ? hit.pickedPoint
            : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y1, this._hitPos);
          npc.physicsAggregate.body.applyImpulse(forward.scale(10), impulsePoint);
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
    return true;
  }

  public magicAttack(): boolean {
    const magicProfile = MAGIC_PROFILES[this._magicArchetype];
    if (this._magicCooldownRemaining > 0) {
      return false;
    }

    if (this.player.magicka < magicProfile.magickaCost) {
      this._ui.showNotification("Not enough magicka!");
      return false;
    }
    this.player.magicka -= magicProfile.magickaCost;
    this._magicCooldownRemaining = magicProfile.cooldown;
    (this.player as unknown as { notifyResourceSpent?: (resource: "magicka" | "stamina") => void })
      .notifyResourceSpent?.("magicka");

    const forward = this.player.getForwardDirection(1);
    const origin = this.player.camera.position.add(forward);
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

    agg.body.applyImpulse(forward.scale(magicProfile.projectileImpulse), origin);

    let alive = true;
    let elapsedMs = 0;
    let _fbFrame = 0;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      if (!alive || this.scene.isDisposed) return;
      if (++_fbFrame % 2 !== 0) return;

      elapsedMs += this.scene.getEngine().getDeltaTime() * 2;
      if (elapsedMs >= 5000) {
        alive = false;
        if (!this.scene.isDisposed) {
          this.scene.onBeforeRenderObservable.remove(obs);
        }
        if (!projectile.isDisposed()) projectile.dispose();
        if (agg.body && !agg.body.isDisposed) agg.dispose();
        return;
      }

      const projPos = projectile.position;
      for (const npc of this.npcs) {
        if (npc.isDead) continue;
        if (Vector3.DistanceSquared(projPos, npc.mesh.position) <= 1.44) {
          const magicDmg = Math.max(
            1,
            Math.round((MAGIC_DAMAGE + this.player.bonusMagicDamage) * magicProfile.damageMultiplier)
          );
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
          if (!this.scene.isDisposed) {
            this.scene.onBeforeRenderObservable.remove(obs);
          }
          if (!projectile.isDisposed()) projectile.dispose();
          if (agg.body && !agg.body.isDisposed) agg.dispose();
          return;
        }
      }
    });
    return true;
  }

  // ─── NPC AI update (state machine) ────────────────────────────────────────

  /**
   * Drive every NPC's AI state machine. Call once per frame with deltaTime in seconds.
   *
   * State machine overview
   * ──────────────────────
   *  IDLE/PATROL → ALERT       : player enters aggroRange  (brief hesitation)
   *  ALERT       → CHASE       : alertDuration elapsed, player still nearby
   *  ALERT       → INVESTIGATE : player escaped during alert window — search last known position
   *  INVESTIGATE → PATROL      : reached last known pos, or investigateDuration elapsed
   *  INVESTIGATE → ALERT       : player re-enters aggroRange while searching
   *  CHASE       → ATTACK      : player within attackRange
   *  CHASE       → RETURN      : player exceeded 2×aggroRange
   *  ATTACK      → CHASE       : player stepped back out of attackRange
   *  ATTACK      → RETURN      : player exceeded 2×aggroRange
   *  RETURN      → ALERT       : player re-enters aggroRange during return trip
   *  RETURN      → PATROL      : NPC reached spawnPosition
   */
  public updateNPCAI(deltaTime: number): void {
    this._tickPlayerAttackCooldowns(deltaTime);

    const playerPos = this.player.camera.position;
    this._refreshAttackReservations(playerPos);

    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      this._tickNPC(npc, playerPos, deltaTime);
    }
  }

  /**
   * Select which hostile NPCs are allowed to occupy ATTACK state this frame.
   * Current attackers get priority to avoid constant handoff churn.
   */
  private _refreshAttackReservations(playerPos: Vector3): void {
    this._attackReservations.clear();

    const candidates = this.npcs
      .filter((npc) => !npc.isDead && (
        npc.aiState === AIState.CHASE || npc.aiState === AIState.ATTACK
      ))
      .sort((a, b) => {
        if (a.aiState === AIState.ATTACK && b.aiState !== AIState.ATTACK) return -1;
        if (b.aiState === AIState.ATTACK && a.aiState !== AIState.ATTACK) return 1;
        const aDist = Vector3.DistanceSquared(a.mesh.position, playerPos);
        const bDist = Vector3.DistanceSquared(b.mesh.position, playerPos);
        return aDist - bDist;
      });

    for (const npc of candidates) {
      if (this._attackReservations.size >= MAX_CONCURRENT_ATTACKERS) break;
      this._attackReservations.add(npc);
    }
  }

  private _tickPlayerAttackCooldowns(deltaTime: number): void {
    this._meleeCooldownRemaining = Math.max(0, this._meleeCooldownRemaining - deltaTime);
    this._magicCooldownRemaining = Math.max(0, this._magicCooldownRemaining - deltaTime);
  }

  // ─── State machine implementation ──────────────────────────────────────────

  private _tickNPC(npc: NPC, playerPos: Vector3, deltaTime: number): void {
    const distSq      = Vector3.DistanceSquared(npc.mesh.position, playerPos);
    const aggroRangeSq  = npc.aggroRange * npc.aggroRange;
    const attackEngageRange = this._getAttackEngageRange(npc);
    const attackDisengageRange = this._getAttackDisengageRange(npc);
    const attackEngageRangeSq = attackEngageRange * attackEngageRange;
    const attackDisengageRangeSq = attackDisengageRange * attackDisengageRange;
    const deaggroRangeSq = 4 * aggroRangeSq; // (2 × aggroRange)²

    // Cooldown discipline: keep ticking while hostile, even when repositioning.
    if (npc.isAggressive) {
      npc.attackTimer = Math.max(0, npc.attackTimer - deltaTime);
    }

    // Track the player's last known world position any time they are within aggro range.
    if (distSq <= aggroRangeSq) {
      npc.lastKnownPlayerPos = playerPos.clone();
    }

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
          // Player escaped while we were still hesitating — investigate last known position.
          if (npc.lastKnownPlayerPos !== null) {
            this._transitionTo(npc, AIState.INVESTIGATE);
          } else {
            this._transitionTo(npc, npc.patrolPoints.length > 0 ? AIState.PATROL : AIState.IDLE);
          }
        } else if (npc.alertTimer >= npc.alertDuration) {
          this._transitionTo(npc, AIState.CHASE);
        }
        break;

      // ── INVESTIGATE ───────────────────────────────────────────────────────
      case AIState.INVESTIGATE:
        // Re-aggro if the player returns while we're searching.
        if (distSq <= aggroRangeSq) {
          this._transitionTo(npc, AIState.ALERT);
          break;
        }
        npc.investigateTimer += deltaTime;
        if (npc.lastKnownPlayerPos !== null) {
          this._moveRelativeToTarget(npc, npc.lastKnownPlayerPos, npc.moveSpeed * 0.7, deltaTime);
          const distToLastKnownSq = Vector3.DistanceSquared(npc.mesh.position, npc.lastKnownPlayerPos);
          const reachedLastKnown  = distToLastKnownSq < 4.0;
          if (reachedLastKnown || npc.investigateTimer >= npc.investigateDuration) {
            this._transitionTo(npc, npc.patrolPoints.length > 0 ? AIState.RETURN : AIState.IDLE);
          }
        } else if (npc.investigateTimer >= npc.investigateDuration) {
          this._transitionTo(npc, npc.patrolPoints.length > 0 ? AIState.RETURN : AIState.IDLE);
        }
        break;

      // ── CHASE ─────────────────────────────────────────────────────────────
      case AIState.CHASE:
        if (distSq > deaggroRangeSq) {
          this._transitionTo(npc, AIState.RETURN);
          break;
        }
        if (distSq <= attackEngageRangeSq && this._attackReservations.has(npc)) {
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
        if (!this._attackReservations.has(npc)) {
          this._transitionTo(npc, AIState.CHASE);
          break;
        }
        if (distSq > attackDisengageRangeSq) {
          this._transitionTo(npc, AIState.CHASE);
          break;
        }

        this._faceTarget(npc, playerPos);

        if (npc.isAttackTelegraphing) {
          this._tickAttackTelegraph(npc, distSq, deltaTime);
          break;
        }

        // Distance bands and cooldown discipline
        if (npc.attackTimer > npc.attackWindup) {
          this._updateAttackReposition(npc, playerPos, distSq, deltaTime);
        } else {
          // Ready to attack or winding up: close the distance aggressively if needed
          const strikeRangeSq = (npc.attackRange * 0.5) * (npc.attackRange * 0.5);
          if (distSq > strikeRangeSq) {
             this._moveRelativeToTarget(npc, playerPos, npc.moveSpeed, deltaTime);
          } else {
             this._stopMovement(npc);
          }
        }

        if (npc.attackTimer <= 0) {
          this._beginAttackTelegraph(npc);
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
      newState === AIState.ALERT       ||
      newState === AIState.CHASE       ||
      newState === AIState.ATTACK      ||
      newState === AIState.RETURN      ||
      newState === AIState.INVESTIGATE
    );

    switch (newState) {
      case AIState.ALERT:
        npc.alertTimer = 0;
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;
        npc.setStateColor(COLOR_ALERT);
        this._stopMovement(npc);
        break;

      case AIState.INVESTIGATE:
        npc.investigateTimer = 0;
        npc.currentPath = [];
        npc.pathIndex = 0;
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;
        npc.strafeDirection = 0;
        npc.strafeTimer = 0;
        npc.setStateColor(COLOR_INVESTIGATE);
        break;

      case AIState.CHASE:
        // Invalidate any stale path so _chasePlayer computes a fresh one
        npc.currentPath = [];
        npc.pathIndex = 0;
        npc.pathRefreshTimer = 0;
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;
        npc.strafeDirection = 0;
        npc.strafeTimer = 0;
        npc.setStateColor(COLOR_CHASE);
        break;

      case AIState.ATTACK:
        // enforce a minimum windup before first swing
        npc.attackTimer = Math.max(npc.attackTimer, npc.attackWindup);
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;
        npc.strafeDirection = 0;
        npc.strafeTimer = 0;
        this._stopMovement(npc);
        npc.setStateColor(COLOR_CHASE); // stay red while attacking
        break;

      case AIState.RETURN:
        npc.currentPath = [];
        npc.pathIndex = 0;
        npc.pathRefreshTimer = 0;
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;
        npc.strafeDirection = 0;
        npc.strafeTimer = 0;
        npc.setStateColor(COLOR_RETURN);
        break;

      case AIState.PATROL:
      case AIState.IDLE:
        npc.currentPath = [];
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;
        npc.strafeDirection = 0;
        npc.strafeTimer = 0;
        npc.lastKnownPlayerPos = null;
        npc.setStateColor(COLOR_IDLE);
        this._stopMovement(npc);
        break;
    }
  }

  private _getAttackEngageRange(npc: NPC): number {
    const engage = npc.attackRange * npc.attackEngageRangeMultiplier;
    return Math.max(0.1, Math.min(engage, npc.attackRange));
  }

  private _getAttackDisengageRange(npc: NPC): number {
    const engage = this._getAttackEngageRange(npc);
    const disengage = npc.attackRange * npc.attackDisengageRangeMultiplier;
    return Math.max(engage, disengage);
  }

  private _beginAttackTelegraph(npc: NPC): void {
    npc.isAttackTelegraphing = true;
    npc.attackTelegraphTimer = Math.max(0.12, npc.attackWindup);
    this._stopMovement(npc);
    npc.setStateColor(COLOR_TELEGRAPH);
  }

  private _tickAttackTelegraph(npc: NPC, distSq: number, deltaTime: number): void {
    npc.attackTelegraphTimer -= deltaTime;
    this._stopMovement(npc);
    if (npc.attackTelegraphTimer > 0) return;

    npc.isAttackTelegraphing = false;
    npc.attackTelegraphTimer = 0;
    npc.attackTimer = npc.attackCooldown;
    npc.setStateColor(COLOR_CHASE);

    const strikeRange = npc.attackRange * npc.dodgeWindowRangeMultiplier;
    if (distSq > strikeRange * strikeRange) {
      this._ui.showNotification(`You dodge ${npc.mesh.name}'s strike!`, 1200);
      return;
    }

    const dmg = Math.max(1, npc.attackDamage - this.player.bonusArmor);
    this.player.health = Math.max(0, this.player.health - dmg);
    (this.player as unknown as { notifyDamageTaken?: () => void }).notifyDamageTaken?.();
    this._ui.showHitFlash("rgba(200, 0, 0, 0.4)");
    if (this.onPlayerHit) this.onPlayerHit();
    this._ui.showNotification(`${npc.mesh.name} attacks you for ${dmg} damage!`, 2000);
  }

  private _updateAttackReposition(npc: NPC, playerPos: Vector3, distSq: number, deltaTime: number): void {
    const standoff = npc.attackRange * 0.82;
    const dist = Math.sqrt(distSq);
    let radialSpeed = 0;
    if (dist < standoff - 0.45) {
      radialSpeed = -npc.moveSpeed * 0.55;
    } else if (dist > standoff + 0.55) {
      radialSpeed = npc.moveSpeed * 0.45;
    }

    npc.strafeTimer = Math.max(0, npc.strafeTimer - deltaTime);
    if (npc.strafeTimer <= 0) {
      npc.strafeTimer = 0.3 + Math.random() * 0.55;
      const roll = Math.random();
      if (roll < 0.38) {
        npc.strafeDirection = -1;
      } else if (roll < 0.76) {
        npc.strafeDirection = 1;
      } else {
        npc.strafeDirection = 0;
      }
    }

    playerPos.subtractToRef(npc.mesh.position, this._dir);
    this._dir.y = 0;
    if (this._dir.lengthSquared() <= 0.001) {
      this._stopMovement(npc);
      return;
    }

    this._dir.normalize();
    this._lateralDir.set(-this._dir.z, 0, this._dir.x);
    this._dir.scaleToRef(radialSpeed, this._desiredVel);
    this._lateralDir.scaleInPlace(npc.moveSpeed * npc.strafeSpeedMultiplier * npc.strafeDirection);
    this._desiredVel.addInPlace(this._lateralDir);

    this._setSmoothedHorizontalVelocity(npc, this._desiredVel, deltaTime);
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

    this._followPath(npc, npc.moveSpeed, deltaTime);
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

    this._followPath(npc, npc.moveSpeed * 0.8, deltaTime); // slightly slower on the walk home

    // Arrived at home?
    if (Vector3.DistanceSquared(npc.mesh.position, npc.spawnPosition) < 4.0) {
      this._transitionTo(npc, npc.patrolPoints.length > 0 ? AIState.PATROL : AIState.IDLE);
    }
  }

  /**
   * Advance the NPC along its currentPath[] using physics velocity.
   * Waypoints within 0.5 m are skipped to prevent oscillation.
   */
  private _followPath(npc: NPC, speed: number, deltaTime: number): void {
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
    this._dir.scaleToRef(speed, this._desiredVel);
    this._setSmoothedHorizontalVelocity(npc, this._desiredVel, deltaTime);

    this._lookAtTarget.set(waypoint.x, npc.mesh.position.y, waypoint.z);
    npc.mesh.lookAt(this._lookAtTarget);
  }

  /** Moves an NPC straight towards or away from a target position without pathfinding. */
  private _moveRelativeToTarget(npc: NPC, targetPos: Vector3, speed: number, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;
    targetPos.subtractToRef(npc.mesh.position, this._dir);
    this._dir.y = 0;

    // Avoid normalization of zero vector
    if (this._dir.lengthSquared() > 0.001) {
       this._dir.normalize();
       this._dir.scaleToRef(speed, this._desiredVel);
       this._setSmoothedHorizontalVelocity(npc, this._desiredVel, deltaTime);
    } else {
       this._stopMovement(npc);
    }
  }

  private _setSmoothedHorizontalVelocity(npc: NPC, desiredVelocity: Vector3, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;
    npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);

    const blend = Math.min(1, Math.max(0.02, npc.movementResponsiveness) * Math.max(0.001, deltaTime));
    this._blendedVel.x = this._currentVel.x + (desiredVelocity.x - this._currentVel.x) * blend;
    this._blendedVel.z = this._currentVel.z + (desiredVelocity.z - this._currentVel.z) * blend;
    this._blendedVel.y = this._currentVel.y;
    npc.physicsAggregate.body.setLinearVelocity(this._blendedVel);
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
