/**
 * NPC steering: how an NPC's body carries out its goal (see npc-goals.ts).
 * Chasing and walking home follow navmesh paths (a straight line without
 * one); fleeing, kiting and strafing steer directly.  Velocities blend
 * toward the target speed through the physics body, so turns are smooth.
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { NPC } from "../../entities/npc";
import type { NavigationSystem } from "../navigation-system";

/** Fleeing NPCs run at this multiple of their normal moveSpeed. */
export const FLEE_SPEED_MULTIPLIER = 1.5;

export class NpcSteering {
  // Scratch vectors, reused every tick.
  private _currentVel = new Vector3();
  private _dir = new Vector3();
  private _lateralDir = new Vector3();
  private _newVel = new Vector3();
  private _desiredVel = new Vector3();
  private _blendedVel = new Vector3();
  private _lookAtTarget = new Vector3();

  constructor(private readonly _nav: () => NavigationSystem | null, private readonly _random: () => number) {}

  /** Attack footwork: hold the standoff distance and side-step at random. */
  public strafe(npc: NPC, playerPos: Vector3, distSq: number, deltaTime: number): void {
    const standoff = npc.attackRange * 0.82;
    let radialSpeed = 0;

    // Use squared comparisons to avoid Math.sqrt() where possible
    if (distSq < (standoff - 0.45) * (standoff - 0.45)) {
      radialSpeed = -npc.moveSpeed * 0.55;
    } else if (distSq > (standoff + 0.55) * (standoff + 0.55)) {
      radialSpeed = npc.moveSpeed * 0.45;
    }

    npc.strafeTimer = Math.max(0, npc.strafeTimer - deltaTime);
    if (npc.strafeTimer <= 0) {
      npc.strafeTimer = 0.3 + this._random() * 0.55;
      const roll = this._random();
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
      this.stop(npc);
      return;
    }

    this._dir.normalize();
    this._lateralDir.set(-this._dir.z, 0, this._dir.x);
    this._dir.scaleToRef(radialSpeed, this._desiredVel);
    this._lateralDir.scaleInPlace(npc.moveSpeed * npc.strafeSpeedMultiplier * npc.strafeDirection);
    this._desiredVel.addInPlace(this._lateralDir);

    this._setVelocity(npc, this._desiredVel, deltaTime);
  }

  /**
   * Move an NPC toward the player along a path using physics velocity.
   * If the navmesh is ready a computed path is used; otherwise the NPC heads
   * directly toward the player (straight-line fallback).
   * The path is refreshed every pathRefreshInterval seconds or when exhausted.
   */
  public chase(npc: NPC, playerPos: Vector3, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;

    npc.pathRefreshTimer -= deltaTime;
    const exhausted   = npc.pathIndex >= npc.currentPath.length;
    const timedOut    = npc.pathRefreshTimer <= 0;

    if (exhausted || timedOut) {
      npc.pathRefreshTimer = npc.pathRefreshInterval;
      if (this._nav()?.isReady) {
        npc.currentPath = this._nav()!.findPath(npc.mesh.position, playerPos);
      } else {
        // Fallback: single direct-line waypoint
        npc.currentPath = [playerPos.clone()];
      }
      npc.pathIndex = 0;
    }

    this._followPath(npc, npc.moveSpeed, deltaTime);
  }

  /** Move an NPC back to its spawn position using pathfinding (or direct line). */
  public returnHome(npc: NPC, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;

    npc.pathRefreshTimer -= deltaTime;
    const exhausted = npc.pathIndex >= npc.currentPath.length;
    const timedOut  = npc.pathRefreshTimer <= 0;

    if (exhausted || timedOut) {
      npc.pathRefreshTimer = npc.pathRefreshInterval;
      const target = npc.spawnPosition;
      if (this._nav()?.isReady) {
        npc.currentPath = this._nav()!.findPath(npc.mesh.position, target);
      } else {
        npc.currentPath = [target.clone()];
      }
      npc.pathIndex = 0;
    }

    this._followPath(npc, npc.moveSpeed * 0.8, deltaTime); // slightly slower on the walk home
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
    this._setVelocity(npc, this._desiredVel, deltaTime);

    this._lookAtTarget.set(waypoint.x, npc.mesh.position.y, waypoint.z);
    npc.mesh.lookAt(this._lookAtTarget);
  }

  /** Moves an NPC straight towards or away from a target position without pathfinding. */
  public moveToward(npc: NPC, targetPos: Vector3, speed: number, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;
    targetPos.subtractToRef(npc.mesh.position, this._dir);
    this._dir.y = 0;

    // Avoid normalization of zero vector
    if (this._dir.lengthSquared() > 0.001) {
       this._dir.normalize();
       this._dir.scaleToRef(speed, this._desiredVel);
       this._setVelocity(npc, this._desiredVel, deltaTime);
    } else {
       this.stop(npc);
    }
  }

  private _setVelocity(npc: NPC, desiredVelocity: Vector3, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;
    npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);

    const blend = Math.min(1, Math.max(0.02, npc.movementResponsiveness) * Math.max(0.001, deltaTime));
    this._blendedVel.x = this._currentVel.x + (desiredVelocity.x - this._currentVel.x) * blend;
    this._blendedVel.z = this._currentVel.z + (desiredVelocity.z - this._currentVel.z) * blend;
    this._blendedVel.y = this._currentVel.y;
    npc.physicsAggregate.body.setLinearVelocity(this._blendedVel);
  }

  /**
   * Move an NPC directly away from the player at FLEE_SPEED_MULTIPLIER × moveSpeed.
   * The NPC faces away from the player so it "runs" correctly.
   */
  public flee(npc: NPC, playerPos: Vector3, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;

    playerPos.subtractToRef(npc.mesh.position, this._dir);
    this._dir.y = 0;
    if (this._dir.lengthSquared() <= 0.001) {
      // If exactly on top of the player, flee in a random lateral direction.
      this._dir.set(1, 0, 0);
    }
    // Reverse direction — run away.
    this._dir.normalize().scaleInPlace(-1);
    this._dir.scaleToRef(npc.moveSpeed * FLEE_SPEED_MULTIPLIER, this._desiredVel);
    this._setVelocity(npc, this._desiredVel, deltaTime);

    // Face away from player.
    const lookAway = npc.mesh.position.add(this._dir);
    this._lookAtTarget.set(lookAway.x, npc.mesh.position.y, lookAway.z);
    npc.mesh.lookAt(this._lookAtTarget);
  }

  /**
   * Kiting step: move directly away from the player at reduced speed while
   * keeping eyes on them (unlike fleeing, which faces away to run).
   */
  public retreat(npc: NPC, targetPos: Vector3, deltaTime: number): void {
    if (!npc.physicsAggregate?.body) return;
    npc.mesh.position.subtractToRef(targetPos, this._dir);
    this._dir.y = 0;
    if (this._dir.lengthSquared() > 0.001) {
      this._dir.normalize();
      this._dir.scaleToRef(npc.moveSpeed * 0.55, this._desiredVel);
      this._setVelocity(npc, this._desiredVel, deltaTime);
    } else {
      this.stop(npc);
    }
    this.face(npc, targetPos);
  }

  /** Zero the NPC's horizontal velocity while preserving vertical (gravity). */
  public stop(npc: NPC): void {
    if (!npc.physicsAggregate?.body) return;
    npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
    this._newVel.set(0, this._currentVel.y, 0);
    npc.physicsAggregate.body.setLinearVelocity(this._newVel);
  }

  /** Rotate the NPC's mesh to face a target position (ignoring Y difference). */
  public face(npc: NPC, target: Vector3): void {
    this._lookAtTarget.set(target.x, npc.mesh.position.y, target.z);
    npc.mesh.lookAt(this._lookAtTarget);
  }
}
