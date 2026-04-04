import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

/**
 * AI state machine states for NPC behaviour.
 *
 * Transition graph:
 *   IDLE        → PATROL      (if patrolPoints assigned)
 *   IDLE        → ALERT       (player enters aggroRange)
 *   PATROL      → ALERT       (player enters aggroRange)
 *   ALERT       → CHASE       (alertDuration elapsed, player still close)
 *   ALERT       → INVESTIGATE (player escaped during alert window — move to last seen pos)
 *   INVESTIGATE → PATROL      (reached lastKnownPlayerPos or investigateDuration elapsed)
 *   INVESTIGATE → ALERT       (player re-enters aggroRange while investigating)
 *   CHASE       → ATTACK      (player within attackRange)
 *   CHASE       → RETURN      (player > 2×aggroRange away)
 *   ATTACK      → CHASE       (player stepped out of attackRange)
 *   ATTACK      → RETURN      (player > 2×aggroRange away)
 *   RETURN      → ALERT       (player re-enters aggroRange during return)
 *   RETURN      → PATROL      (reached spawnPosition)
 *   CHASE/ATTACK → FLEE       (health drops below fleesBelowHealthPct threshold)
 *   FLEE        → RETURN      (player out of aggro range or NPC escapes)
 */
export enum AIState {
  IDLE        = "IDLE",
  PATROL      = "PATROL",
  ALERT       = "ALERT",
  CHASE       = "CHASE",
  ATTACK      = "ATTACK",
  RETURN      = "RETURN",
  INVESTIGATE = "INVESTIGATE",
  /** NPC is running away from the player (triggered when health drops below fleesBelowHealthPct). */
  FLEE        = "FLEE",
}

/**
 * Damage categories used for resistance and weakness calculations.
 * - physical: melee and unarmed strikes
 * - fire: flame spells and burning effects
 * - frost: ice spells and cold effects
 * - shock: lightning spells and electrical effects
 */
export type DamageType = "physical" | "fire" | "frost" | "shock";

/**
 * A time-limited damage-over-time (DoT) or debuff applied to an NPC.
 *
 * The effect ticks every `tickInterval` seconds for the remainder of
 * `remainingDuration`, dealing `damagePerTick` of `type` each tick.
 * Multiple effects of the same type stack independently.
 */
export interface StatusEffect {
  /** Visual/mechanic category of the effect. */
  type: "burn" | "poison" | "freeze" | "shock";
  /** Damage applied per tick.  Use 0 for pure debuffs (e.g. freeze slow). */
  damagePerTick: number;
  /** Seconds between ticks. */
  tickInterval: number;
  /** Seconds until the next tick. */
  tickTimer: number;
  /** Remaining total duration in seconds. */
  remainingDuration: number;
}

/**
 * Behavior block used by the NPC daily-schedule system.
 * An NPC cycles through these blocks based on the in-game hour.
 */
export type ScheduleBehaviorType = "sleep" | "work" | "wander" | "patrol";

export interface ScheduleBlock {
  /** Hour (0-23) at which this block begins. */
  startHour: number;
  /** Hour (0-23) at which this block ends (exclusive). */
  endHour: number;
  /** What the NPC should be doing during this window. */
  behavior: ScheduleBehaviorType;
  /** Fixed position for "work" or "sleep" behaviors.  Ignored for "patrol"/"wander". */
  anchorPosition?: Vector3;
}

export class NPC {
  public mesh: Mesh;
  public physicsAggregate: PhysicsAggregate;
  public scene: Scene;

  // Schedule/AI properties
  public targetPosition: Vector3 | null = null;
  public moveSpeed: number = 2;
  public patrolPoints: Vector3[] = [];
  public currentPatrolIndex: number = 0;
  public waitTime: number = 0;
  /** Randomized patrol pause duration range (seconds). */
  public patrolWaitMin: number = 1.25;
  public patrolWaitMax: number = 3.5;
  /** While waiting, occasionally rotate to this offset heading (radians). */
  public patrolLookAroundAngle: number = Math.PI / 5;

  // Health
  public health: number = 100;
  public maxHealth: number = 100;
  public isDead: boolean = false;

  // ─── AI State Machine ───────────────────────────────────────────────────────

  /** Current AI state. Managed by CombatSystem. */
  public aiState: AIState = AIState.IDLE;

  /**
   * Legacy backward-compatible flag. Kept in sync with aiState so that
   * ScheduleSystem and DialogueSystem continue to work without modification.
   * true  → ALERT | CHASE | ATTACK | RETURN
   * false → IDLE  | PATROL
   */
  public isAggressive: boolean = false;

  /** World position where this NPC was initially spawned; used for RETURN state. */
  public spawnPosition: Vector3;

  // ─── Alert state ────────────────────────────────────────────────────────────

  /** Seconds spent in the ALERT state so far. */
  public alertTimer: number = 0;

  /** How long (seconds) the NPC pauses in ALERT before transitioning to CHASE. */
  public readonly alertDuration: number = 1.5;

  // ─── Investigate state ───────────────────────────────────────────────────────

  /** Last recorded player world position — updated each frame the player is in aggroRange. */
  public lastKnownPlayerPos: Vector3 | null = null;

  /** Seconds spent in INVESTIGATE state. */
  public investigateTimer: number = 0;

  /** Max seconds the NPC searches before giving up and returning to patrol. */
  public readonly investigateDuration: number = 5.0;

  // ─── Pathfinding ────────────────────────────────────────────────────────────

  /** Waypoints of the current nav path (empty = no path). */
  public currentPath: Vector3[] = [];

  /** Index of the next waypoint to walk toward in currentPath. */
  public pathIndex: number = 0;

  /** Counts down from pathRefreshInterval; path is recomputed when ≤ 0. */
  public pathRefreshTimer: number = 0;

  /** Seconds between automatic path recomputes while chasing/returning. */
  public readonly pathRefreshInterval: number = 0.5;

  // ─── Combat AI ──────────────────────────────────────────────────────────────

  public aggroRange: number = 12;
  public attackRange: number = 2.5;
  /**
   * Inner threshold used when entering ATTACK from CHASE.
   * Lower than attackRange to avoid edge jitter.
   */
  public attackEngageRangeMultiplier: number = 0.9;
  /**
   * Outer threshold used when leaving ATTACK back to CHASE.
   * Higher than attackRange to avoid edge jitter.
   */
  public attackDisengageRangeMultiplier: number = 1.15;
  /** Minimum delay before first swing after entering ATTACK state. */
  public attackWindup: number = 0.35;
  public attackDamage: number = 5;
  public attackTimer: number = 0;
  public attackCooldown: number = 2; // seconds between attacks
  /** True while the NPC is in a visible pre-strike telegraph animation window. */
  public isAttackTelegraphing: boolean = false;
  /** Remaining seconds before a telegraphed strike resolves. */
  public attackTelegraphTimer: number = 0;
  /** Strike reach factor used when resolving telegraphed attacks. */
  public dodgeWindowRangeMultiplier: number = 0.7;
  /** Lateral movement choice during ATTACK cooldown windows (-1 left, +1 right). */
  public strafeDirection: -1 | 0 | 1 = 0;
  /** Seconds remaining until strafeDirection is rerolled. */
  public strafeTimer: number = 0;
  /** Side-step speed as a multiple of moveSpeed. */
  public strafeSpeedMultiplier: number = 0.65;
  /** How quickly horizontal velocity blends toward desired movement. */
  public movementResponsiveness: number = 8;
  public xpReward: number = 25;

  // ─── Stagger (power-attack interrupt) ───────────────────────────────────────

  /** True while the NPC is briefly staggered after a player power attack. */
  public isStaggered: boolean = false;
  /** Remaining seconds of the current stagger. */
  public staggerTimer: number = 0;

  /**
   * Set to true when the NPC takes damage (non-lethal). Consumed by the game loop
   * to trigger a one-frame hit-reaction animation request.
   */
  public justTakenDamageVisual: boolean = false;

  // ─── Faction & role ─────────────────────────────────────────────────────────

  /** Faction this NPC belongs to (matches IDs used by CrimeSystem bounties). */
  public factionId: string | null = null;

  /**
   * True for NPCs that enforce laws and challenge the player when there is an
   * active bounty in their faction.  Only guards challenge; witnesses do not.
   */
  public isGuard: boolean = false;

  /**
   * Loot table ID resolved by LootTableSystem on death.
   * null = no loot drop.
   */
  public lootTableId: string | null = null;

  // ─── Status effects (DoT / debuffs) ─────────────────────────────────────────

  /** Currently active status effects on this NPC. */
  public statusEffects: StatusEffect[] = [];

  // ─── Daily schedule ──────────────────────────────────────────────────────────

  /**
   * Optional time-of-day schedule.  ScheduleSystem consults this to decide
   * the NPC's current behavior when not in combat.
   * Blocks should collectively cover all 24 hours (gaps default to "wander").
   */
  public scheduleBlocks: ScheduleBlock[] = [];

  /** Home position used for "sleep" schedule behavior. */
  public homePosition: Vector3 | null = null;

  /** Work position used for "work" schedule behavior. */
  public workPosition: Vector3 | null = null;

  // ─── Resistances and Weaknesses ─────────────────────────────────────────────

  /**
   * Damage resistances per type (0–1 range, where 1 = fully immune).
   * Values > 1 are clamped to 1. Negative values increase damage taken.
   * Example: `{ fire: 0.5 }` means 50% less fire damage.
   */
  public damageResistances: Partial<Record<DamageType, number>> = {};

  /**
   * Damage weaknesses per type (positive multiplier added on top of base).
   * Example: `{ frost: 0.25 }` means 25% extra frost damage (1.25× total).
   */
  public damageWeaknesses: Partial<Record<DamageType, number>> = {};

  /**
   * Oblivion-style armor rating. Reduces incoming physical damage multiplicatively.
   * Formula: `damage × 100 / (100 + armorRating)`
   * - AR 0   → no reduction (default)
   * - AR 100 → 50 % reduction
   * - AR 200 → 33 % reduction
   * Does not affect magical damage types (fire, frost, shock).
   */
  public armorRating: number = 0;

  // ─── Extended Overhaul Fields ──────────────────────────────────────────────

  /** Voice profile identifier (set from archetype on spawn). */
  public voiceType: string = "neutral";

  /** Behavioral personality tags (set from archetype on spawn). */
  public personalityTraits: string[] = [];

  /**
   * Health fraction [0–1] below which the NPC transitions to flee behavior.
   * 0 means the NPC never flees; applied by CombatSystem during CHASE/ATTACK.
   */
  public fleesBelowHealthPct: number = 0;

  /** Item IDs the NPC was spawned carrying (used by inventory integration). */
  public startingEquipmentIds: string[] = [];

  // ─── Visuals ────────────────────────────────────────────────────────────────

  /** Current "resting" diffuse colour — restored after a hit-flash. */
  private _baseColor: Color3 = new Color3(0.82, 0.64, 0.38);

  // ───────────────────────────────────────────────────────────────────────────

  constructor(scene: Scene, position: Vector3, name: string) {
    this.scene = scene;
    this.spawnPosition = position.clone();
    this._createMesh(position, name);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Apply or refresh a status effect.  If an effect of the same type already
   * exists its duration is refreshed to whichever is longer.
   */
  public applyStatusEffect(effect: StatusEffect): void {
    const existing = this.statusEffects.find((e) => e.type === effect.type);
    if (existing) {
      existing.remainingDuration = Math.max(existing.remainingDuration, effect.remainingDuration);
      existing.damagePerTick = Math.max(existing.damagePerTick, effect.damagePerTick);
    } else {
      this.statusEffects.push({ ...effect });
    }
  }

  /**
   * Advance all active status effects by deltaTime seconds.
   * Deals tick damage, removes expired effects, and returns total damage dealt
   * this call.
   */
  public tickStatusEffects(deltaTime: number): number {
    if (this.isDead || this.statusEffects.length === 0) return 0;

    let totalDamage = 0;
    const remaining: StatusEffect[] = [];

    for (const effect of this.statusEffects) {
      effect.remainingDuration -= deltaTime;
      effect.tickTimer -= deltaTime;

      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.tickInterval;
        if (effect.damagePerTick > 0) {
          totalDamage += effect.damagePerTick;
        }
      }

      if (effect.remainingDuration > 0) {
        remaining.push(effect);
      }
    }

    this.statusEffects = remaining;

    if (totalDamage > 0) {
      this.takeDamage(totalDamage);
    }

    return totalDamage;
  }

  /**
   * Change the NPC's base colour (shown at rest and after hit-flashes).
   * Call this whenever the AI state transitions to a new visual category.
   */
  public setStateColor(color: Color3): void {
    this._baseColor = color.clone();
    if (!this.mesh.isDisposed() && !this.isDead) {
      (this.mesh.material as StandardMaterial).diffuseColor = color.clone();
    }
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    this._flashHit();
    if (this.health > 0 && amount > 0) {
      this.justTakenDamageVisual = true;
    }
    if (this.health <= 0) {
      this._die();
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /** Brief red flash on hit, then restore the current state colour. */
  private _flashHit(): void {
    if (this.mesh.isDisposed()) return;
    const mat = this.mesh.material as StandardMaterial;
    mat.diffuseColor = Color3.Red();
    setTimeout(() => {
      if (!this.isDead && !this.mesh.isDisposed()) {
        mat.diffuseColor = this._baseColor.clone();
      }
    }, 150);
  }

  private _die(): void {
    this.isDead = true;
    this.isAggressive = false;
    this.aiState = AIState.IDLE;
    this.currentPath = [];
    this.isAttackTelegraphing = false;
    this.attackTelegraphTimer = 0;
    this.strafeDirection = 0;
    this.strafeTimer = 0;
    const mat = this.mesh.material as StandardMaterial;
    mat.diffuseColor = new Color3(0.3, 0.3, 0.3);
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.STATIC);
    // Remove interaction metadata so dead NPCs can't be targeted
    this.mesh.metadata = null;
  }

  /**
   * Derive an NPC archetype role from the mesh name for visual differentiation.
   * Guards → steel armour colours; merchants → warm leather; undead → ashen pale;
   * mages → deep purple; bosses → black/gold.  Falls back to the default tan skin.
   */
  private _archetypeFromName(name: string): "guard" | "merchant" | "mage" | "boss" | "undead" | "default" {
    const lower = name.toLowerCase();
    if (lower.includes("guard") || lower.includes("knight") || lower.includes("soldier")) return "guard";
    if (lower.includes("merchant") || lower.includes("innkeeper") || lower.includes("vendor")) return "merchant";
    if (lower.includes("mage") || lower.includes("wizard") || lower.includes("sorcerer")) return "mage";
    if (lower.includes("boss") || lower.includes("chief") || lower.includes("lord")) return "boss";
    if (lower.includes("undead") || lower.includes("skeleton") || lower.includes("draugr") || lower.includes("zombie")) return "undead";
    return "default";
  }

  private _createMesh(position: Vector3, name: string): void {
    this.mesh = MeshBuilder.CreateCapsule(name, { radius: 0.5, height: 2 }, this.scene);
    this.mesh.position = position;

    // ── Role-based visual palette ──────────────────────────────────────────
    const archetype = this._archetypeFromName(name);
    const material  = new StandardMaterial(`${name}_mat`, this.scene);

    switch (archetype) {
      case "guard":
        // Imperial steel — cold blue-grey metallic
        material.diffuseColor  = new Color3(0.46, 0.52, 0.60);
        material.specularColor = new Color3(0.55, 0.60, 0.70);
        material.specularPower = 80;
        this._baseColor = new Color3(0.46, 0.52, 0.60);
        break;
      case "merchant":
        // Warm leather-clad merchant — deep amber/ochre
        material.diffuseColor  = new Color3(0.68, 0.42, 0.18);
        material.specularColor = new Color3(0.18, 0.12, 0.05);
        material.specularPower = 20;
        this._baseColor = new Color3(0.68, 0.42, 0.18);
        break;
      case "mage":
        // Mage's robe — deep purple with arcane shimmer
        material.diffuseColor  = new Color3(0.32, 0.14, 0.60);
        material.specularColor = new Color3(0.40, 0.20, 0.80);
        material.specularPower = 64;
        this._baseColor = new Color3(0.32, 0.14, 0.60);
        break;
      case "boss":
        // Boss / chieftain — obsidian black with gold trim
        material.diffuseColor  = new Color3(0.10, 0.08, 0.06);
        material.specularColor = new Color3(0.72, 0.56, 0.12);
        material.specularPower = 96;
        this._baseColor = new Color3(0.10, 0.08, 0.06);
        break;
      case "undead":
        // Draugr / undead — ashen bone grey
        material.diffuseColor  = new Color3(0.62, 0.58, 0.52);
        material.specularColor = new Color3(0.08, 0.08, 0.07);
        material.specularPower = 12;
        this._baseColor = new Color3(0.62, 0.58, 0.52);
        break;
      default:
        // Villager — warm tan skin
        material.diffuseColor  = new Color3(0.82, 0.64, 0.38);
        material.specularColor = new Color3(0.12, 0.09, 0.05);
        material.specularPower = 24;
        this._baseColor = new Color3(0.82, 0.64, 0.38);
    }

    this.mesh.material = material;
    this.mesh.receiveShadows = true;

    // ── Visual accessories ─────────────────────────────────────────────────
    // Small indicator pieces parented to the capsule so they move with it.
    // Physics is only on the capsule — accessories are purely decorative.
    if (archetype === "guard") {
      this._addHelmet(name);
    } else if (archetype === "mage") {
      this._addStaff(name);
    } else if (archetype === "boss") {
      this._addCrown(name);
    }

    this.physicsAggregate = new PhysicsAggregate(
      this.mesh, PhysicsShapeType.CAPSULE, { mass: 1, restitution: 0 }, this.scene
    );
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    // Lock rotation axes so the capsule stays upright
    this.physicsAggregate.body.setMassProperties({ inertia: new Vector3(0, 0, 0) });

    this.mesh.metadata = { type: "npc", npc: this };
  }

  /** Add a helmet-like flattened box on top of the capsule for guards. */
  private _addHelmet(name: string): void {
    const helmet = MeshBuilder.CreateBox(`${name}_helmet`, { width: 0.65, height: 0.28, depth: 0.65 }, this.scene);
    helmet.position = new Vector3(0, 1.02, 0); // relative to capsule centre
    helmet.parent   = this.mesh;

    const mat = new StandardMaterial(`${name}_helmetMat`, this.scene);
    mat.diffuseColor  = new Color3(0.38, 0.42, 0.50);
    mat.specularColor = new Color3(0.60, 0.65, 0.75);
    mat.specularPower = 96;
    helmet.material   = mat;
    helmet.receiveShadows = true;
  }

  /** Add a floating staff orb above mages. */
  private _addStaff(name: string): void {
    // Staff handle
    const staff = MeshBuilder.CreateCylinder(
      `${name}_staff`,
      { height: 1.6, diameterTop: 0.04, diameterBottom: 0.06, tessellation: 8 },
      this.scene,
    );
    staff.position = new Vector3(0.45, -0.2, 0);
    staff.parent   = this.mesh;

    const staffMat = new StandardMaterial(`${name}_staffMat`, this.scene);
    staffMat.diffuseColor  = new Color3(0.28, 0.16, 0.06);
    staffMat.specularColor = new Color3(0.10, 0.06, 0.02);
    staffMat.specularPower = 18;
    staff.material = staffMat;

    // Arcane orb on top
    const orb = MeshBuilder.CreateSphere(`${name}_orb`, { diameter: 0.18, segments: 6 }, this.scene);
    orb.position = new Vector3(0.45, 0.62, 0);
    orb.parent   = this.mesh;

    const orbMat = new StandardMaterial(`${name}_orbMat`, this.scene);
    orbMat.diffuseColor  = new Color3(0.20, 0.05, 0.80);
    orbMat.emissiveColor = new Color3(0.15, 0.02, 0.60);
    orbMat.specularColor = new Color3(0.60, 0.30, 1.00);
    orbMat.specularPower = 128;
    orb.material = orbMat;
  }

  /** Add a small gold crown above boss NPCs. */
  private _addCrown(name: string): void {
    const crown = MeshBuilder.CreateTorus(
      `${name}_crown`,
      { diameter: 0.55, thickness: 0.08, tessellation: 16 },
      this.scene,
    );
    crown.position = new Vector3(0, 1.08, 0);
    crown.parent   = this.mesh;

    const mat = new StandardMaterial(`${name}_crownMat`, this.scene);
    mat.diffuseColor  = new Color3(0.85, 0.65, 0.05);
    mat.specularColor = new Color3(1.00, 0.88, 0.20);
    mat.specularPower = 128;
    mat.emissiveColor = new Color3(0.10, 0.08, 0.00);
    crown.material   = mat;
  }
}
