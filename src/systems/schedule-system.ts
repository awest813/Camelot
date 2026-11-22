import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC, AIState, ScheduleBehaviorType } from "../entities/npc";

/** How far a "wander" destination is picked from the NPC's home position. */
const WANDER_RADIUS = 8;
/** An NPC that covers less than this (m) in {@link STUCK_SECONDS} is stuck. */
const STUCK_PROGRESS = 0.35;
const STUCK_SECONDS = 1.5;
/** How long a sidestep lasts once stuck. */
const DETOUR_SECONDS = 1.1;
/** How far ahead (m) a sidestep checks for open ground. */
const SIDESTEP_PROBE = 0.9;
/** Give up on a target after this many sidesteps that didn't help. */
const MAX_DETOURS = 4;

/** Per-NPC progress tracking for the stuck check. */
interface StuckTracker {
  x: number;
  z: number;
  /** Seconds since the last real progress. */
  idle: number;
  /** Seconds of sidestep left (0 = heading straight for the target). */
  detour: number;
  /** +1 / −1: which side to sidestep to. */
  side: number;
  detours: number;
  /** Target this tracker belongs to (reset when it changes). */
  tx: number;
  tz: number;
}

export class ScheduleSystem {
  public npcs: NPC[] = [];

  /**
   * Optional: current in-game hour (0–23).  When set, the schedule system
   * uses NPC.scheduleBlocks to choose the active behavior.  If not set,
   * NPCs fall back to their normal patrol logic.
   */
  public currentHour: number = -1;

  /**
   * Optional: whether a point on the ground is open (not inside a building).
   * Used to keep wander destinations, and the straight walk to them, out of
   * walls.  Unset means everywhere is walkable.
   */
  public walkable: ((x: number, z: number) => boolean) | null = null;

  /** Fired each update while a sleeping NPC stands at its bed spot (home). */
  public onSleepArrive: ((npc: NPC) => void) | null = null;

  // Scratch vectors for performance optimization
  private _direction: Vector3 = new Vector3();
  private _velocity: Vector3 = new Vector3();
  private _currentVel: Vector3 = new Vector3();
  private _newVel: Vector3 = new Vector3();
  private _lookAtTarget: Vector3 = new Vector3();
  private _toTarget: Vector3 = new Vector3();
  private _patrolPauseHeading: WeakMap<NPC, Vector3> = new WeakMap();

  /** Per-NPC wander destination (refreshed when reached or expired). */
  private _wanderTargets: WeakMap<NPC, Vector3> = new WeakMap();
  private _stuck: WeakMap<NPC, StuckTracker> = new WeakMap();

  public addNPC(npc: NPC): void {
    this.npcs.push(npc);
  }

  public removeNPC(npc: NPC): void {
    const idx = this.npcs.indexOf(npc);
    if (idx !== -1) {
      this.npcs.splice(idx, 1);
    }
  }

  public update(deltaTime: number): void {
    for (const npc of this.npcs) {
      this._updateNPC(npc, deltaTime);
    }
  }

  private _updateNPC(npc: NPC, deltaTime: number): void {
    // CombatSystem owns movement for any state other than IDLE/PATROL
    if (npc.isDead || npc.isAggressive) return;
    // Hold still while talking to the player, and while hidden indoors
    // (asleep or sheltering): a hidden body has no collisions, so moving it
    // would carry it through walls and terrain.
    if (npc.isInDialogue || (typeof npc.mesh.isEnabled === "function" && !npc.mesh.isEnabled())) {
      this._applyStopHorizontal(npc);
      return;
    }

    // Determine active schedule behavior (if any)
    const scheduledBehavior = this._getScheduledBehavior(npc);

    // "patrol" blocks use the same waypoint logic as the default path; only
    // sleep / work / wander need bespoke handling here.
    if (scheduledBehavior && scheduledBehavior !== "patrol") {
      this._applyScheduledBehavior(npc, scheduledBehavior, deltaTime);
      return;
    }

    // Default: patrol logic
    if (npc.patrolPoints.length === 0) return;

    // Ensure aiState reflects that we are patrolling
    if (npc.aiState === AIState.IDLE) {
      npc.aiState = AIState.PATROL;
    }

    if (npc.waitTime > 0) {
      npc.waitTime -= deltaTime;
      this._applyPatrolIdleLook(npc);
      this._applyStopHorizontal(npc);
      return;
    }

    const target = npc.patrolPoints[npc.currentPatrolIndex];
    target.subtractToRef(npc.mesh.position, this._direction);

    // Ignore Y component for distance check on ground
    const distSqXZ = this._direction.x * this._direction.x + this._direction.z * this._direction.z;

    if (distSqXZ < 1.0) { // 1.0 squared is 1.0
      // Reached target
      npc.currentPatrolIndex = (npc.currentPatrolIndex + 1) % npc.patrolPoints.length;
      npc.waitTime = this._getPatrolWaitSeconds(npc);
      this._setPatrolIdleHeading(npc);
    } else {
      // Move towards target
      this._direction.y = 0;
      this._direction.normalize();
      this._direction.scaleToRef(npc.moveSpeed, this._velocity);

      if (npc.physicsAggregate && npc.physicsAggregate.body) {
         npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);

         // Set X and Z velocity, keep Y (gravity)
         this._newVel.set(this._velocity.x, this._currentVel.y, this._velocity.z);
         npc.physicsAggregate.body.setLinearVelocity(this._newVel);

         // Rotate to face movement (ignore Y difference)
         this._lookAtTarget.set(target.x, npc.mesh.position.y, target.z);
         npc.mesh.lookAt(this._lookAtTarget);
      }

      this._patrolPauseHeading.delete(npc);
    }
  }

  // ── Schedule behavior helpers ──────────────────────────────────────────────

  /** The NPC's scheduled behaviour right now (null: no schedule / hour unset). */
  public behaviorOf(npc: NPC): ScheduleBehaviorType | null {
    return this._getScheduledBehavior(npc);
  }

  /**
   * Returns the current scheduled behavior for the NPC based on
   * `this.currentHour` and the NPC's schedule blocks.
   * Returns null when no blocks are defined or `currentHour` is -1.
   */
  private _getScheduledBehavior(npc: NPC): ScheduleBehaviorType | null {
    if (this.currentHour < 0 || npc.scheduleBlocks.length === 0) return null;

    const hour = this.currentHour;
    for (const block of npc.scheduleBlocks) {
      // Handle blocks that wrap midnight (e.g. 22 → 6)
      const wraps = block.startHour > block.endHour;
      const inBlock = wraps
        ? (hour >= block.startHour || hour < block.endHour)
        : (hour >= block.startHour && hour < block.endHour);
      if (inBlock) return block.behavior;
    }
    return null;
  }

  private _applyScheduledBehavior(
    npc: NPC,
    behavior: Exclude<ScheduleBehaviorType, "patrol">,
    deltaTime: number,
  ): void {
    switch (behavior) {
      case "sleep":
        this._applySleepBehavior(npc, deltaTime);
        break;
      case "work":
        this._applyWorkBehavior(npc, deltaTime);
        break;
      case "wander":
        this._applyWanderBehavior(npc, deltaTime);
        break;
    }
  }

  /**
   * Sleep: NPC moves to homePosition (if far) then stops and idles.
   */
  private _applySleepBehavior(npc: NPC, deltaTime: number): void {
    const target = npc.homePosition ?? npc.spawnPosition;
    if (this._moveTowardTarget(npc, target, deltaTime, 0.5)) this.onSleepArrive?.(npc);
    npc.aiState = AIState.IDLE;
  }

  /**
   * Work: NPC moves to workPosition and stands there.
   */
  private _applyWorkBehavior(npc: NPC, deltaTime: number): void {
    const target = npc.workPosition ?? npc.spawnPosition;
    this._moveTowardTarget(npc, target, deltaTime, 1.0);
    if (npc.aiState === AIState.IDLE) return;
    npc.aiState = AIState.IDLE;
  }

  /**
   * Wander: NPC picks random destinations near its spawn position.
   */
  private _applyWanderBehavior(npc: NPC, deltaTime: number): void {
    if (npc.waitTime > 0) {
      npc.waitTime -= deltaTime;
      this._applyStopHorizontal(npc);
      return;
    }
    let wanderTarget = this._wanderTargets.get(npc);
    const origin = npc.homePosition ?? npc.spawnPosition;

    if (!wanderTarget) {
      wanderTarget = this._pickRandomWanderPoint(origin, npc.mesh.position);
      this._wanderTargets.set(npc, wanderTarget);
    }

    const reached = this._moveTowardTarget(npc, wanderTarget, deltaTime, npc.moveSpeed);
    if (reached || this._gaveUp(npc)) {
      this._stuck.delete(npc);
      this._wanderTargets.delete(npc);
      npc.waitTime = this._getPatrolWaitSeconds(npc);
    }
  }

  /**
   * Move the NPC toward `target` at `speed`.
   * Returns true when the NPC is within arrival distance.
   */
  private _moveTowardTarget(
    npc: NPC,
    target: Vector3,
    deltaTime: number,
    speed: number,
  ): boolean {
    target.subtractToRef(npc.mesh.position, this._direction);
    this._direction.y = 0;
    const distSq = this._direction.x ** 2 + this._direction.z ** 2;

    if (distSq < 1.0) {
      this._applyStopHorizontal(npc);
      this._stuck.delete(npc);
      return true;
    }

    const st = this._trackProgress(npc, target, deltaTime);
    if (st.detours >= MAX_DETOURS) {
      // Blocked for good (e.g. the target is behind a wall): stand still
      // rather than walk into it forever.
      this._applyStopHorizontal(npc);
      return false;
    }

    this._direction.normalize();
    if (st.detour > 0) {
      // Sidestep: mostly sideways, a little forward, to slide round the
      // obstacle — but only onto open ground (never through a doorway into a
      // building): try this side, then the other, else hold still.
      const fx = this._direction.x, fz = this._direction.z;
      const p = npc.mesh.position;
      const open = (side: number) => {
        const dx = fz * side + fx * 0.3, dz = -fx * side + fz * 0.3;
        const l = Math.hypot(dx, dz) || 1;
        return !this.walkable || this.walkable(p.x + (dx / l) * SIDESTEP_PROBE, p.z + (dz / l) * SIDESTEP_PROBE);
      };
      if (!open(st.side)) st.side = -st.side;
      if (!open(st.side)) {
        st.detour = 0;
        this._applyStopHorizontal(npc);
        return false;
      }
      this._direction.set(fz * st.side + fx * 0.3, 0, -fx * st.side + fz * 0.3).normalize();
    }
    this._direction.scaleToRef(speed, this._velocity);

    if (npc.physicsAggregate?.body) {
      npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
      this._newVel.set(this._velocity.x, this._currentVel.y, this._velocity.z);
      npc.physicsAggregate.body.setLinearVelocity(this._newVel);

      this._lookAtTarget.set(
        npc.mesh.position.x + this._direction.x, npc.mesh.position.y, npc.mesh.position.z + this._direction.z,
      );
      npc.mesh.lookAt(this._lookAtTarget);
    }

    return false;
  }

  /**
   * Update the NPC's progress toward `target`: after {@link STUCK_SECONDS}
   * without real progress start a sidestep (alternating sides).
   */
  private _trackProgress(npc: NPC, target: Vector3, deltaTime: number): StuckTracker {
    const p = npc.mesh.position;
    let st = this._stuck.get(npc);
    if (!st || st.tx !== target.x || st.tz !== target.z) {
      st = { x: p.x, z: p.z, idle: 0, detour: 0, side: 1, detours: 0, tx: target.x, tz: target.z };
      this._stuck.set(npc, st);
      return st;
    }
    if (st.detour > 0) {
      st.detour = Math.max(0, st.detour - deltaTime);
      if (st.detour === 0) { st.x = p.x; st.z = p.z; st.idle = 0; }
      return st;
    }
    if (Math.hypot(p.x - st.x, p.z - st.z) >= STUCK_PROGRESS) {
      st.x = p.x; st.z = p.z; st.idle = 0;
      return st;
    }
    st.idle += deltaTime;
    if (st.idle >= STUCK_SECONDS) {
      st.detours += 1;
      st.detour = DETOUR_SECONDS;
      st.side = st.detours % 2 === 1 ? 1 : -1;
      st.idle = 0;
    }
    return st;
  }

  /** Whether the NPC has given up on its current movement target. */
  private _gaveUp(npc: NPC): boolean {
    const st = this._stuck.get(npc);
    return !!st && st.detours >= MAX_DETOURS;
  }

  /**
   * A random point within WANDER_RADIUS of origin.  With {@link walkable}
   * set, tries for one that is open and reachable in a straight line from
   * `from`; falls back to the origin itself.
   */
  private _pickRandomWanderPoint(origin: Vector3, from?: Vector3): Vector3 {
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * WANDER_RADIUS;
      const x = origin.x + Math.cos(angle) * radius;
      const z = origin.z + Math.sin(angle) * radius;
      if (!this.walkable || this._clearLine(from ?? origin, x, z)) return new Vector3(x, origin.y, z);
    }
    return origin.clone();
  }

  /** Every point on the segment (from → x,z), sampled each 0.5 m, is walkable. */
  private _clearLine(from: Vector3, x: number, z: number): boolean {
    const walkable = this.walkable!;
    const len = Math.hypot(x - from.x, z - from.z);
    const steps = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!walkable(from.x + (x - from.x) * t, from.z + (z - from.z) * t)) return false;
    }
    return true;
  }

  // ── Patrol helpers (unchanged) ────────────────────────────────────────────

  private _getPatrolWaitSeconds(npc: NPC): number {
    const min = Math.max(0, Math.min(npc.patrolWaitMin, npc.patrolWaitMax));
    const max = Math.max(min, Math.max(npc.patrolWaitMin, npc.patrolWaitMax));
    return min + (max - min) * Math.random();
  }

  private _setPatrolIdleHeading(npc: NPC): void {
    npc.patrolPoints[npc.currentPatrolIndex].subtractToRef(npc.mesh.position, this._toTarget);
    const baseAngle = Math.atan2(this._toTarget.x, this._toTarget.z);
    const randomOffset = (Math.random() * 2 - 1) * npc.patrolLookAroundAngle;
    const heading = baseAngle + randomOffset;

    let headingVec = this._patrolPauseHeading.get(npc);
    if (!headingVec) {
      headingVec = new Vector3();
      this._patrolPauseHeading.set(npc, headingVec);
    }
    headingVec.set(Math.sin(heading), 0, Math.cos(heading));
  }

  private _applyPatrolIdleLook(npc: NPC): void {
    const lookDir = this._patrolPauseHeading.get(npc);
    if (!lookDir) return;
    this._lookAtTarget.set(
      npc.mesh.position.x + lookDir.x,
      npc.mesh.position.y,
      npc.mesh.position.z + lookDir.z,
    );
    npc.mesh.lookAt(this._lookAtTarget);
  }

  private _applyStopHorizontal(npc: NPC): void {
    if (!npc.physicsAggregate?.body) return;
    npc.physicsAggregate.body.getLinearVelocityToRef(this._currentVel);
    this._newVel.set(0, this._currentVel.y, 0);
    npc.physicsAggregate.body.setLinearVelocity(this._newVel);
  }
}

