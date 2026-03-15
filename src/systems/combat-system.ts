import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { NPC, AIState, DamageType } from "../entities/npc";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { NavigationSystem } from "./navigation-system";
import { SkillProgressionSystem } from "./skill-progression-system";
import { AttributeSystem } from "./attribute-system";

const MELEE_DAMAGE = 10;
const MAGIC_DAMAGE = 20;

// ─── Oblivion-style combat constants ──────────────────────────────────────────

/** Fraction of incoming NPC damage absorbed when the player is blocking (no block skill). */
const BLOCK_DAMAGE_REDUCTION = 0.5;
/** Block damage reduction fraction at block skill 0 (matches BLOCK_DAMAGE_REDUCTION for backward compat). */
const BLOCK_SKILL_REDUCTION_BASE = 0.5;
/** Maximum block damage reduction fraction (at block skill 100). */
const BLOCK_SKILL_REDUCTION_MAX = 0.8;
/** Stamina cost deducted from the player per successfully blocked hit (no block skill). */
const BLOCK_STAMINA_COST_PER_HIT = 12;
/** Minimum block stamina cost per hit (at block skill 100). */
const BLOCK_STAMINA_COST_MIN = 4;
/** Damage multiplier applied on a critical hit. */
const CRIT_DAMAGE_MULTIPLIER = 2.0;
/** Stamina cost of a power attack is the normal melee cost × this factor. */
const POWER_ATTACK_STAMINA_MULTIPLIER = 2.5;
/** Raw damage multiplier for a power attack on top of normal melee scaling. */
const POWER_ATTACK_DAMAGE_MULTIPLIER = 2.2;
/** Duration in seconds that an NPC is staggered after being hit by a player power attack. */
const POWER_ATTACK_STAGGER_DURATION = 0.6;
/**
 * Minimum fatigue (stamina) multiplier applied to damage output.
 * At 0 % stamina the player still deals at least this fraction of normal damage.
 */
const FATIGUE_DAMAGE_MIN_FACTOR = 0.5;
/**
 * Base hit-chance at blade skill 0 (55 %).  Linearly increases to 100 % at skill 50,
 * capped at HIT_CHANCE_MAX above that.  Only applied when both skill and attribute
 * systems are attached (preserves backward-compatible behaviour in tests / bare combats).
 */
const HIT_CHANCE_BASE = 0.55;
/** Hard floor so that a very-low-agility, exhausted player still connects sometimes. */
const HIT_CHANCE_MIN = 0.25;

/**
 * Applies NPC-specific resistance, weakness, and armor rating to a raw damage amount.
 *
 * Resistance/weakness pass:
 *   damage = baseDamage × max(0, 1 − resistance + weakness)
 *
 * Armor rating pass (physical damage only — Oblivion-style):
 *   effectiveAR = armorRating × (1 − armorPenFraction)
 *   damage = damage × 100 / (100 + effectiveAR)
 *
 * Resistance values are clamped to [0, 1] so that full immunity is the maximum.
 * A missing entry defaults to 0 (no modification).
 *
 * **Minimum damage floor**: The result is always at least 1.
 * Even a fully resistant NPC takes 1 point of damage per hit, ensuring attacks
 * are never silently ignored and preserving gameplay feedback.
 */
function applyDamageWithResistance(
  baseDamage: number,
  npc: NPC,
  type: DamageType,
  armorPenFraction: number = 0,
): number {
  const resistance = Math.min(1, Math.max(0, npc.damageResistances?.[type] ?? 0));
  const weakness = Math.max(0, npc.damageWeaknesses?.[type] ?? 0);
  let damage = baseDamage * (1 - resistance + weakness);

  // Oblivion-style armor rating: higher AR means proportionally less physical damage.
  // armorPenFraction [0,1] reduces the effective armor rating before this calculation.
  if (type === "physical" && npc.armorRating > 0) {
    const penClamped = Math.min(1, Math.max(0, armorPenFraction));
    const effectiveAR = npc.armorRating * (1 - penClamped);
    damage *= 100 / (100 + effectiveAR);
  }

  return Math.max(1, Math.round(damage));
}

export type MeleeArchetype = "duelist" | "soldier" | "bruiser";
export type MagicArchetype = "spark" | "bolt" | "surge";

/**
 * Weapon-type archetypes used for per-weapon stat differentiation.
 *
 * These are independent of the combat stance (MeleeArchetype) — the stance
 * controls rhythm (speed vs. power), while the weapon archetype controls the
 * type of physical attack (blade, impact, ranged, etc.).
 */
export type WeaponArchetype = "sword" | "axe" | "mace" | "bow" | "staff";

interface WeaponProfile {
  /** Multiplier applied to the base melee damage value (MELEE_DAMAGE). */
  damageMultiplier: number;
  /** Flat crit-chance bonus added on top of the player's base critChance. */
  critChanceBonus: number;
  /**
   * Fraction [0,1] of the target's armor rating that is bypassed.
   * 0 = no penetration (full armor applies), 1 = complete armor bypass.
   */
  armorPenFraction: number;
  /** Forward raycast distance in metres used for melee hit detection. */
  attackRange: number;
  /** Skill ID governing proficiency scaling for this weapon type. */
  skillId: string;
  /** Human-readable display name. */
  label: string;
  /**
   * Multiplier applied to the melee archetype's base stamina cost for this weapon.
   * < 1.0 = cheaper to swing (sword), > 1.0 = more expensive (mace).
   */
  staminaCostMultiplier: number;
  /**
   * Multiplier applied to the melee archetype's base attack cooldown for this weapon.
   * < 1.0 = faster swings (sword), > 1.0 = slower swings (mace).
   */
  cooldownMultiplier: number;
  /**
   * Probability [0, 1] that a successful normal melee hit staggers the target.
   * Stagger briefly interrupts the NPC's AI (shorter than a power-attack stagger).
   */
  staggerChance: number;
  /** Duration in seconds of the stagger applied by a normal melee hit. */
  staggerDuration: number;
}

// ─── Staff charge constants ────────────────────────────────────────────────────

/** Seconds to reach a full charge with a staff. */
const STAFF_CHARGE_TIME = 1.5;
/** Magicka cost for a full-charge staff blast. Scales down with partial charge. */
const STAFF_CHARGE_MAGICKA_COST = 35;
/** Range of the charged staff blast (forward raycast). */
const STAFF_CHARGE_RANGE = 5.0;
/** Base damage of a fully charged staff blast (before skill/attribute scaling). */
const STAFF_CHARGE_DAMAGE_BASE = 40;
/** Minimum charge fraction before a staff release deals damage. */
const STAFF_MIN_CHARGE = 0.15;
/** Cooldown in seconds after releasing a staff charge. */
const STAFF_CHARGE_COOLDOWN = 1.2;

/**
 * Per-weapon-type combat profiles.
 *
 * Design intent:
 *  sword  — fast, balanced; strong crit, light armor pen, moderate stagger
 *  axe    — harder-hitting; better armor pen, slightly slower, low stagger
 *  mace   — heaviest strikes; excellent armor pen, slow, high stagger chance
 *  bow    — long-range precision; best crit chance, minimal armor pen
 *  staff  — hybrid caster tool; weak melee fallback, governed by destruction skill;
 *           Q-press triggers a charged destruction blast (see beginStaffCharge)
 */
const WEAPON_PROFILES: Record<WeaponArchetype, WeaponProfile> = {
  sword: {
    damageMultiplier: 1.0,
    critChanceBonus: 0.10,
    armorPenFraction: 0.10,
    attackRange: 3.0,
    skillId: "blade",
    label: "Sword",
    staminaCostMultiplier: 0.80,
    cooldownMultiplier:    0.85,
    staggerChance:         0.15,
    staggerDuration:       0.20,
  },
  axe: {
    damageMultiplier: 1.20,
    critChanceBonus: 0.05,
    armorPenFraction: 0.25,
    attackRange: 2.8,
    skillId: "blade",
    label: "Axe",
    staminaCostMultiplier: 1.10,
    cooldownMultiplier:    1.15,
    staggerChance:         0.10,
    staggerDuration:       0.15,
  },
  mace: {
    damageMultiplier: 1.45,
    critChanceBonus: 0.02,
    armorPenFraction: 0.50,
    attackRange: 2.5,
    skillId: "blunt",
    label: "Mace",
    staminaCostMultiplier: 1.40,
    cooldownMultiplier:    1.40,
    staggerChance:         0.40,
    staggerDuration:       0.45,
  },
  bow: {
    damageMultiplier: 0.85,
    critChanceBonus: 0.15,
    armorPenFraction: 0.05,
    attackRange: 25.0,
    skillId: "marksman",
    label: "Bow",
    staminaCostMultiplier: 1.00,
    cooldownMultiplier:    1.00,
    staggerChance:         0.00,
    staggerDuration:       0.00,
  },
  staff: {
    damageMultiplier: 0.60,
    critChanceBonus: 0.02,
    armorPenFraction: 0.00,
    attackRange: 3.0,
    skillId: "destruction",
    label: "Staff",
    staminaCostMultiplier: 1.20,
    cooldownMultiplier:    1.50,
    staggerChance:         0.05,
    staggerDuration:       0.10,
  },
};

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

/** Maps each magic archetype to its damage type for resistance calculations. */
const MAGIC_ARCHETYPE_DAMAGE_TYPE: Record<MagicArchetype, DamageType> = {
  spark: "shock",
  bolt:  "fire",
  surge: "fire",
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
  private _skillSystem: SkillProgressionSystem | null;
  private _attributeSystem: AttributeSystem | null;

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
  private _topAttackScores = new Float64Array(MAX_CONCURRENT_ATTACKERS);
  private _topAttackNpcs: (NPC | null)[] = new Array(MAX_CONCURRENT_ATTACKERS).fill(null);
  private _meleeCooldownRemaining: number = 0;
  private _magicCooldownRemaining: number = 0;
  private _meleeArchetype: MeleeArchetype = "soldier";
  private _magicArchetype: MagicArchetype = "bolt";
  /** Active weapon type; drives per-weapon damage, range, and skill multipliers. */
  private _weaponArchetype: WeaponArchetype = "sword";
  /** True while the player is actively holding block. */
  private _isBlocking: boolean = false;
  /** True while a staff charge attack is building up. */
  private _isChargingStaff: boolean = false;
  /** Seconds the staff charge has been held [0, STAFF_CHARGE_TIME]. */
  private _staffChargeTimer: number = 0;
  /** Remaining cooldown after a staff charge release (prevents instant re-charge). */
  private _staffChargeCooldown: number = 0;

  private static readonly _OFFSET_Y1 = new Vector3(0, 1, 0);
  private static readonly _OFFSET_Y2 = new Vector3(0, 2, 0);

  /** Fired with the NPC's mesh name, XP reward, and the NPC reference whenever an NPC dies. */
  public onNPCDeath: ((npcName: string, xpReward: number, npc: NPC) => void) | null = null;

  /** Fired whenever the player takes damage from an NPC. */
  public onPlayerHit: (() => void) | null = null;

  /** Fired whenever the player successfully blocks an NPC attack. */
  public onBlockSuccess: (() => void) | null = null;

  constructor(
    scene: Scene,
    player: Player,
    npcs: NPC[],
    ui: UIManager,
    nav?: NavigationSystem,
    opts?: {
      skillSystem?: SkillProgressionSystem | null;
      attributeSystem?: AttributeSystem | null;
    }
  ) {
    this.scene = scene;
    this.player = player;
    this.npcs = npcs;
    this._ui = ui;
    this._nav = nav ?? null;
    this._skillSystem = opts?.skillSystem ?? null;
    this._attributeSystem = opts?.attributeSystem ?? null;
  }

  public setScalingSystems(opts: { skillSystem?: SkillProgressionSystem | null; attributeSystem?: AttributeSystem | null }): void {
    if (opts.skillSystem !== undefined) {
      this._skillSystem = opts.skillSystem;
    }
    if (opts.attributeSystem !== undefined) {
      this._attributeSystem = opts.attributeSystem;
    }
  }

  public setMeleeArchetype(archetype: MeleeArchetype): void {
    this._meleeArchetype = archetype;
    this._ui.showNotification(`${MELEE_PROFILES[archetype].label} selected`, 1400);
  }

  public setMagicArchetype(archetype: MagicArchetype): void {
    this._magicArchetype = archetype;
    this._ui.showNotification(`${MAGIC_PROFILES[archetype].label} selected`, 1400);
  }

  /**
   * Switch the active weapon archetype.
   *
   * This affects per-attack damage scaling, armor penetration, crit chance bonus,
   * attack range, and which skill governs proficiency scaling.
   */
  public setWeaponArchetype(archetype: WeaponArchetype): void {
    this._weaponArchetype = archetype;
    this._ui.showNotification(`${WEAPON_PROFILES[archetype].label} equipped`, 1400);
  }

  public get activeMeleeArchetype(): MeleeArchetype {
    return this._meleeArchetype;
  }

  public get activeMagicArchetype(): MagicArchetype {
    return this._magicArchetype;
  }

  public get activeWeaponArchetype(): WeaponArchetype {
    return this._weaponArchetype;
  }

  // ─── Blocking ──────────────────────────────────────────────────────────────

  /** True while the player is holding block (right-click held). */
  public get isBlocking(): boolean {
    return this._isBlocking;
  }

  /**
   * Begin blocking.  Call on right-click POINTERDOWN.
   * While blocking, 50 % of incoming NPC melee damage is absorbed and each
   * absorbed hit drains stamina (matching Oblivion's block system).
   */
  public beginBlock(): void {
    this._isBlocking = true;
    this._ui.showNotification("Blocking...", 600);
  }

  /**
   * Stop blocking.  Call on right-click POINTERUP.
   */
  public endBlock(): void {
    this._isBlocking = false;
  }

  // ─── Staff charge attack ────────────────────────────────────────────────────

  /** True while the staff charge is building. */
  public get isChargingStaff(): boolean {
    return this._isChargingStaff;
  }

  /** Charge progress [0, 1]; 1.0 = fully charged. */
  public get staffChargeProgress(): number {
    return Math.min(1, this._staffChargeTimer / STAFF_CHARGE_TIME);
  }

  /**
   * Begin charging a staff attack.  Call on Q KEYDOWN when weapon archetype is "staff".
   *
   * Returns false if a charge is already in progress, the cooldown is active,
   * or the player has insufficient magicka for even a minimum charge.
   */
  public beginStaffCharge(): boolean {
    if (this._isChargingStaff) return false;
    if (this._staffChargeCooldown > 0) return false;
    const minCost = Math.round(STAFF_CHARGE_MAGICKA_COST * STAFF_MIN_CHARGE);
    if (this.player.magicka < minCost) {
      this._ui.showNotification("Not enough magicka!", 1200);
      return false;
    }
    this._isChargingStaff = true;
    this._staffChargeTimer = 0;
    this._ui.showNotification("Charging...", Math.round(STAFF_CHARGE_TIME * 1000));
    return true;
  }

  /**
   * Release the staff charge.  Call on Q KEYUP when `isChargingStaff` is true.
   *
   * Fires a forward-raycast destruction blast scaled by charge progress.
   * Below STAFF_MIN_CHARGE the shot is cancelled without cost.
   * Returns true if a shot was actually fired.
   */
  public releaseStaffCharge(): boolean {
    if (!this._isChargingStaff) return false;
    this._isChargingStaff = false;

    const chargeFraction = this.staffChargeProgress;
    this._staffChargeTimer = 0;
    this._staffChargeCooldown = STAFF_CHARGE_COOLDOWN;

    if (chargeFraction < STAFF_MIN_CHARGE) {
      this._ui.showNotification("Charge released too early.", 800);
      return false;
    }

    const magickaCost = Math.max(1, Math.round(STAFF_CHARGE_MAGICKA_COST * chargeFraction));
    if (this.player.magicka < magickaCost) {
      this._ui.showNotification("Not enough magicka!", 1200);
      return false;
    }
    this.player.magicka -= magickaCost;
    (this.player as unknown as { notifyResourceSpent?: (resource: "magicka" | "stamina") => void })
      .notifyResourceSpent?.("magicka");

    const hit = this.player.raycastForward(STAFF_CHARGE_RANGE);
    if (hit && hit.pickedMesh) {
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc && !npc.isDead) {
        const rawDmg = Math.max(
          1,
          Math.round(
            STAFF_CHARGE_DAMAGE_BASE
            * chargeFraction
            * this._destructionMultiplier()
          )
        );
        const finalDmg = applyDamageWithResistance(rawDmg, npc, "fire");
        npc.takeDamage(finalDmg);

        // Charged blast always staggers.
        npc.isStaggered = true;
        npc.staggerTimer = 0.4 + 0.4 * chargeFraction;
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;

        const numberPos = hit.pickedPoint
          ? hit.pickedPoint.addToRef(CombatSystem._OFFSET_Y1, this._hitPos)
          : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos);
        this._ui.showDamageNumber(numberPos, finalDmg, this.scene);
        this._ui.showHitFlash("rgba(255, 60, 0, 0.5)");

        const label = chargeFraction >= 0.9 ? "Staff Blast!" : "Charged Bolt!";
        this._ui.showNotification(label, 1000);

        if (npc.isDead) {
          this._ui.showNotification(`${npc.mesh.name} defeated!`);
          if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward, npc);
        } else if (npc.aiState !== AIState.CHASE && npc.aiState !== AIState.ATTACK) {
          this._transitionTo(npc, AIState.CHASE);
        }
      }
    }
    return true;
  }

  // ─── Player actions ────────────────────────────────────────────────────────

  public meleeAttack(): boolean {
    const meleeProfile = MELEE_PROFILES[this._meleeArchetype];
    const weaponProfile = WEAPON_PROFILES[this._weaponArchetype];
    if (this._meleeCooldownRemaining > 0) {
      return false;
    }

    const staminaCost = this._scaledMeleeStaminaCost(
      meleeProfile.staminaCost * weaponProfile.staminaCostMultiplier
    );
    if (this.player.stamina < staminaCost) {
      this._ui.showNotification("Not enough stamina!");
      return false;
    }

    // Sample fatigue BEFORE spending stamina so a near-empty bar doesn't
    // immediately penalise the swing that drains the last point.
    const fatigueFactor = this._fatigueFactor();

    this.player.stamina -= staminaCost;
    this._meleeCooldownRemaining = this._scaledMeleeCooldown(
      meleeProfile.cooldown * weaponProfile.cooldownMultiplier
    );
    (this.player as unknown as { notifyResourceSpent?: (resource: "magicka" | "stamina") => void })
      .notifyResourceSpent?.("stamina");

    // Oblivion-style hit chance: low weapon skill / agility / fatigue can cause a miss.
    // Only active when skill and attribute systems are wired up (backward-compatible).
    const hitChance = this._hitChance();
    if (hitChance < 1.0 && Math.random() >= hitChance) {
      this._ui.showNotification("Miss!", 600);
      return true;
    }

    const hit = this.player.raycastForward(weaponProfile.attackRange);
    if (hit && hit.pickedMesh) {
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc && !npc.isDead) {
        // Critical hit: combine base player critChance with weapon's bonus.
        const baseCritChance = (this.player as unknown as { critChance?: number }).critChance ?? 0;
        const effectiveCritChance = baseCritChance + weaponProfile.critChanceBonus;
        const isCrit = effectiveCritChance > 0 && Math.random() < effectiveCritChance;
        const critMultiplier = isCrit ? CRIT_DAMAGE_MULTIPLIER : 1.0;

        const rawMeleeDmg = Math.max(
          1,
          Math.round(
            (MELEE_DAMAGE + this.player.bonusDamage + this._strengthBonus())
            * meleeProfile.damageMultiplier
            * weaponProfile.damageMultiplier
            * fatigueFactor
            * critMultiplier
            * this._weaponSkillMultiplier()
          )
        );
        const meleeDmg = applyDamageWithResistance(rawMeleeDmg, npc, "physical", weaponProfile.armorPenFraction);
        npc.takeDamage(meleeDmg);

        // Per-weapon stagger chance on normal melee hits.
        if (
          !npc.isDead &&
          !npc.isStaggered &&
          weaponProfile.staggerChance > 0 &&
          Math.random() < weaponProfile.staggerChance
        ) {
          npc.isStaggered = true;
          npc.staggerTimer = weaponProfile.staggerDuration;
          npc.isAttackTelegraphing = false;
          npc.attackTelegraphTimer = 0;
        }

        const numberPos = hit.pickedPoint
          ? hit.pickedPoint.addToRef(CombatSystem._OFFSET_Y1, this._hitPos)
          : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos);
        this._ui.showDamageNumber(numberPos, meleeDmg, this.scene);
        this._ui.showHitFlash("rgba(255, 200, 0, 0.25)");

        if (isCrit) {
          this._ui.showNotification("Critical Hit!", 1000);
        }

        if (npc.physicsAggregate?.body) {
          const forward = this.player.getForwardDirection(1);
          const impulsePoint = hit.pickedPoint
            ? hit.pickedPoint
            : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y1, this._hitPos);
          npc.physicsAggregate.body.applyImpulse(forward.scale(10), impulsePoint);
        }

        if (npc.isDead) {
          this._ui.showNotification(`${npc.mesh.name} defeated!`);
          if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward, npc);
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

  /**
   * Oblivion-style power attack.
   *
   * Costs POWER_ATTACK_STAMINA_MULTIPLIER × the current archetype's stamina cost.
   * Deals POWER_ATTACK_DAMAGE_MULTIPLIER × normal melee damage (before fatigue/crits).
   * On hit, staggers the target NPC for POWER_ATTACK_STAGGER_DURATION seconds,
   * interrupting its AI and any ongoing telegraph animation.
   */
  public powerAttack(): boolean {
    const meleeProfile = MELEE_PROFILES[this._meleeArchetype];
    const weaponProfile = WEAPON_PROFILES[this._weaponArchetype];
    if (this._meleeCooldownRemaining > 0) {
      return false;
    }

    const staminaCost = this._scaledMeleeStaminaCost(
      meleeProfile.staminaCost * weaponProfile.staminaCostMultiplier * POWER_ATTACK_STAMINA_MULTIPLIER
    );
    if (this.player.stamina < staminaCost) {
      this._ui.showNotification("Not enough stamina for a power attack!");
      return false;
    }

    const fatigueFactor = this._fatigueFactor();

    this.player.stamina -= staminaCost;
    this._meleeCooldownRemaining = this._scaledMeleeCooldown(
      meleeProfile.cooldown * weaponProfile.cooldownMultiplier * 1.5
    ); // longer recovery after a power swing
    (this.player as unknown as { notifyResourceSpent?: (resource: "magicka" | "stamina") => void })
      .notifyResourceSpent?.("stamina");

    const hit = this.player.raycastForward(weaponProfile.attackRange);
    if (hit && hit.pickedMesh) {
      const npc = this.npcs.find(n => n.mesh === hit.pickedMesh);
      if (npc && !npc.isDead) {
        const rawDmg = Math.max(
          1,
          Math.round(
            (MELEE_DAMAGE + this.player.bonusDamage + this._strengthBonus())
            * meleeProfile.damageMultiplier
            * weaponProfile.damageMultiplier
            * POWER_ATTACK_DAMAGE_MULTIPLIER
            * fatigueFactor
            * this._weaponSkillMultiplier()
          )
        );
        const finalDmg = applyDamageWithResistance(rawDmg, npc, "physical", weaponProfile.armorPenFraction);
        npc.takeDamage(finalDmg);

        // Stagger: cancel current telegraph and freeze the NPC's AI briefly.
        npc.isStaggered = true;
        npc.staggerTimer = POWER_ATTACK_STAGGER_DURATION;
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;

        const numberPos = hit.pickedPoint
          ? hit.pickedPoint.addToRef(CombatSystem._OFFSET_Y1, this._hitPos)
          : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos);
        this._ui.showDamageNumber(numberPos, finalDmg, this.scene);
        this._ui.showHitFlash("rgba(255, 100, 0, 0.45)");
        this._ui.showNotification("Power Strike!", 1000);

        if (npc.physicsAggregate?.body) {
          const forward = this.player.getForwardDirection(1);
          const impulsePoint = hit.pickedPoint
            ? hit.pickedPoint
            : npc.mesh.position.addToRef(CombatSystem._OFFSET_Y1, this._hitPos);
          npc.physicsAggregate.body.applyImpulse(forward.scale(18), impulsePoint);
        }

        if (npc.isDead) {
          this._ui.showNotification(`${npc.mesh.name} defeated!`);
          if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward, npc);
        } else if (npc.aiState !== AIState.CHASE && npc.aiState !== AIState.ATTACK) {
          this._transitionTo(npc, AIState.CHASE);
        }
      }
    }
    return true;
  }

  public magicAttack(): boolean {
    const magicProfile = MAGIC_PROFILES[this._magicArchetype];
    const magicDamageType = MAGIC_ARCHETYPE_DAMAGE_TYPE[this._magicArchetype];
    if (this._magicCooldownRemaining > 0) {
      return false;
    }

    const magickaCost = this._scaledMagicCost(magicProfile.magickaCost);
    if (this.player.magicka < magickaCost) {
      this._ui.showNotification("Not enough magicka!");
      return false;
    }
    this.player.magicka -= magickaCost;
    this._magicCooldownRemaining = this._scaledMagicCooldown(magicProfile.cooldown);
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
          const rawMagicDmg = Math.max(
            1,
            Math.round(
              (MAGIC_DAMAGE + this.player.bonusMagicDamage + this._magicBonus())
              * magicProfile.damageMultiplier
              * this._destructionMultiplier()
            )
          );
          const magicDmg = applyDamageWithResistance(rawMagicDmg, npc, magicDamageType);
          npc.takeDamage(magicDmg);
          this._ui.showDamageNumber(
            npc.mesh.position.addToRef(CombatSystem._OFFSET_Y2, this._hitPos),
            magicDmg,
            this.scene
          );
          this._ui.showHitFlash("rgba(255, 100, 0, 0.3)");

          if (npc.isDead) {
            this._ui.showNotification(`${npc.mesh.name} defeated!`);
            if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward, npc);
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
      // Tick damage-over-time status effects (burn, poison, freeze, shock)
      npc.tickStatusEffects(deltaTime);
      // Skip further AI processing if the DoT killed the NPC this frame
      if (npc.isDead) {
        if (this.onNPCDeath) this.onNPCDeath(npc.mesh.name, npc.xpReward, npc);
        continue;
      }
      this._tickNPC(npc, playerPos, deltaTime);
    }
  }

  /**
   * Select which hostile NPCs are allowed to occupy ATTACK state this frame.
   * Current attackers get priority to avoid constant handoff churn.
   */
  private _refreshAttackReservations(playerPos: Vector3): void {
    this._attackReservations.clear();
    this._topAttackScores.fill(Infinity);
    this._topAttackNpcs.fill(null);

    let count = 0;
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc.isDead || (npc.aiState !== AIState.CHASE && npc.aiState !== AIState.ATTACK)) {
        continue;
      }

      let score = Vector3.DistanceSquared(npc.mesh.position, playerPos);
      if (npc.aiState !== AIState.ATTACK) {
        // Large penalty for not being in ATTACK state to prioritize current attackers.
        // We use an extremely large number to ensure any ATTACK state NPC always wins over a CHASE state NPC,
        // even in very large scenes where DistanceSquared might exceed 1,000,000.
        score += 1e12;
      }

      for (let j = 0; j < MAX_CONCURRENT_ATTACKERS; j++) {
        if (score < this._topAttackScores[j]) {
          for (let k = MAX_CONCURRENT_ATTACKERS - 1; k > j; k--) {
            this._topAttackScores[k] = this._topAttackScores[k - 1];
            this._topAttackNpcs[k] = this._topAttackNpcs[k - 1];
          }
          this._topAttackScores[j] = score;
          this._topAttackNpcs[j] = npc;
          if (count < MAX_CONCURRENT_ATTACKERS) count++;
          break;
        }
      }
    }

    for (let i = 0; i < count; i++) {
      const topNpc = this._topAttackNpcs[i];
      if (topNpc) {
        this._attackReservations.add(topNpc);
      }
    }
  }

  private _tickPlayerAttackCooldowns(deltaTime: number): void {
    this._meleeCooldownRemaining = Math.max(0, this._meleeCooldownRemaining - deltaTime);
    this._magicCooldownRemaining = Math.max(0, this._magicCooldownRemaining - deltaTime);
    if (this._isChargingStaff) {
      this._staffChargeTimer = Math.min(STAFF_CHARGE_TIME, this._staffChargeTimer + deltaTime);
    }
    this._staffChargeCooldown = Math.max(0, this._staffChargeCooldown - deltaTime);
  }

  // ─── State machine implementation ──────────────────────────────────────────

  private _tickNPC(npc: NPC, playerPos: Vector3, deltaTime: number): void {
    // Stagger: briefly freeze the NPC's AI after a player power attack.
    if (npc.isStaggered) {
      npc.staggerTimer -= deltaTime;
      if (npc.staggerTimer <= 0) {
        npc.isStaggered = false;
        npc.staggerTimer = 0;
      }
      this._stopMovement(npc);
      return;
    }

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

  /**
   * Returns a [FATIGUE_DAMAGE_MIN_FACTOR, 1.0] multiplier based on the player's
   * current stamina relative to their maximum.  Used by melee and power attacks
   * to penalise damage when the player is exhausted — matching Oblivion's
   * Fatigue system.
   */
  private _fatigueFactor(): number {
    const maxStamina = (this.player as unknown as { maxStamina?: number }).maxStamina ?? 100;
    if (maxStamina <= 0) return 1.0;
    return Math.max(FATIGUE_DAMAGE_MIN_FACTOR, this.player.stamina / maxStamina);
  }

  private _bladeMultiplier(): number {
    return this._skillSystem?.multiplier("blade") ?? 1;
  }

  /**
   * Returns the skill multiplier for the currently equipped weapon archetype.
   * Routes to the appropriate skill (blade, blunt, marksman, or destruction)
   * based on the active WeaponArchetype.  Falls back to 1.0 when no skill
   * system is wired (backward-compatible).
   */
  private _weaponSkillMultiplier(): number {
    const skillId = WEAPON_PROFILES[this._weaponArchetype].skillId;
    return this._skillSystem?.multiplier(skillId) ?? 1;
  }

  private _blockSkillMultiplier(): number {
    return this._skillSystem?.multiplier("block") ?? 1;
  }

  private _destructionMultiplier(): number {
    return this._skillSystem?.multiplier("destruction") ?? 1;
  }

  private _strengthBonus(): number {
    return this._attributeSystem?.meleeDamageBonus ?? 0;
  }

  private _magicBonus(): number {
    return this._attributeSystem?.magicDamageBonus ?? 0;
  }

  /**
   * Block damage reduction fraction scaled by the player's block skill.
   * When no skill system is attached the base value equals BLOCK_DAMAGE_REDUCTION (0.5),
   * preserving backward-compatible behaviour.
   *
   * At block skill 0   → BLOCK_SKILL_REDUCTION_BASE (0.5)
   * At block skill 100 → BLOCK_SKILL_REDUCTION_MAX (0.8)
   */
  private _blockDamageReduction(): number {
    const mult = this._blockSkillMultiplier(); // 1.0 at skill 0, 2.0 at skill 100
    const t = Math.min(1, mult - 1.0);
    return BLOCK_SKILL_REDUCTION_BASE + t * (BLOCK_SKILL_REDUCTION_MAX - BLOCK_SKILL_REDUCTION_BASE);
  }

  /**
   * Stamina cost per blocked hit, scaled down by block skill.
   * When no skill system is attached the cost equals BLOCK_STAMINA_COST_PER_HIT (12).
   *
   * At block skill 0   → BLOCK_STAMINA_COST_PER_HIT (12)
   * At block skill 100 → BLOCK_STAMINA_COST_MIN (4)
   */
  private _blockStaminaCost(): number {
    const mult = this._blockSkillMultiplier();
    const t = Math.min(1, mult - 1.0);
    return Math.max(BLOCK_STAMINA_COST_MIN, Math.round(BLOCK_STAMINA_COST_PER_HIT - t * (BLOCK_STAMINA_COST_PER_HIT - BLOCK_STAMINA_COST_MIN)));
  }

  /**
   * Oblivion-style hit-chance for the player's melee swing.
   *
   * Returns 1.0 (guaranteed hit) when:
   *   - No skill or attribute systems are wired (backward-compatible default), OR
   *   - Weapon skill is ≥ 50 (experienced fighters rarely miss).
   *
   * Below skill 50 the chance scales linearly from HIT_CHANCE_BASE (55 %) at
   * skill 0 up to 100 % at skill 50, further adjusted by the player's agility
   * attribute and fatigue.  The governing skill is determined by the active
   * weapon archetype (blade, blunt, marksman, or destruction).
   */
  private _hitChance(): number {
    if (!this._skillSystem || !this._attributeSystem) return 1.0;
    const weaponSkillId = WEAPON_PROFILES[this._weaponArchetype].skillId;
    const weaponLevel = this._skillSystem.getSkill(weaponSkillId)?.level ?? 0;
    if (weaponLevel >= 50) return 1.0;

    const agility = this._attributeSystem.get("agility");
    const fatigue = this._fatigueFactor();
    // Linear interpolation: HIT_CHANCE_BASE at skill 0, 1.0 at skill 50.
    const baseChance = HIT_CHANCE_BASE + (weaponLevel / 50) * (1 - HIT_CHANCE_BASE);
    const agilityMod = (agility - 40) * 0.002;
    return Math.max(HIT_CHANCE_MIN, Math.min(1.0, (baseChance + agilityMod) * fatigue));
  }

  private _meleeCadenceMultiplier(): number {
    const weaponSkillMult = this._weaponSkillMultiplier();
    return 1 + (weaponSkillMult - 1) * 0.6;
  }

  private _magicCadenceMultiplier(): number {
    const destruction = this._destructionMultiplier();
    return 1 + (destruction - 1) * 0.6;
  }

  private _scaledMeleeStaminaCost(baseCost: number): number {
    const scaled = baseCost / this._meleeCadenceMultiplier();
    return Math.max(1, Math.round(scaled));
  }

  private _scaledMeleeCooldown(baseCooldown: number): number {
    const scaled = baseCooldown / this._meleeCadenceMultiplier();
    return Math.max(baseCooldown * 0.45, scaled);
  }

  private _scaledMagicCost(baseCost: number): number {
    const scaled = baseCost / this._magicCadenceMultiplier();
    return Math.max(1, Math.round(scaled));
  }

  private _scaledMagicCooldown(baseCooldown: number): number {
    const scaled = baseCooldown / this._magicCadenceMultiplier();
    return Math.max(baseCooldown * 0.5, scaled);
  }

  private _beginAttackTelegraph(npc: NPC): void {
    npc.isAttackTelegraphing = true;
    npc.attackTelegraphTimer = Math.max(0.12, npc.attackWindup);
    this._stopMovement(npc);
    npc.setStateColor(COLOR_TELEGRAPH);
    // Alert the player with a timed warning matching the windup window.
    const windupMs = Math.round(npc.attackTelegraphTimer * 1000);
    this._ui.showNotification(`⚠ ${npc.mesh.name} attacks!`, windupMs);
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

    // Oblivion-style armor rating: player's bonusArmor acts as an armor rating value.
    // Formula: damage × 100 / (100 + armorRating) — provides diminishing-return protection.
    const playerAR = Math.max(0, this.player.bonusArmor);
    let dmg = Math.max(1, Math.round(npc.attackDamage * 100 / (100 + playerAR)));

    if (this._isBlocking) {
      // Oblivion-style block: scale damage reduction with block skill.
      const blockReduction = this._blockDamageReduction();
      const blockCost = this._blockStaminaCost();
      dmg = Math.max(1, Math.round(dmg * (1 - blockReduction)));
      this.player.stamina = Math.max(0, this.player.stamina - blockCost);
      (this.player as unknown as { notifyResourceSpent?: (resource: "magicka" | "stamina") => void })
        .notifyResourceSpent?.("stamina");
      this._ui.showNotification(`Blocked! ${dmg} damage taken.`, 1500);
      this._ui.showHitFlash("rgba(80, 120, 200, 0.35)");
      if (this.onBlockSuccess) this.onBlockSuccess();
      if (this.player.stamina <= 0) {
        this._isBlocking = false;
        this._ui.showNotification("Block broken!", 1200);
      }
    } else {
      this._ui.showHitFlash("rgba(200, 0, 0, 0.4)");
      this._ui.showNotification(`${npc.mesh.name} attacks you for ${dmg} damage!`, 2000);
    }

    this.player.health = Math.max(0, this.player.health - dmg);
    (this.player as unknown as { notifyDamageTaken?: () => void }).notifyDamageTaken?.();
    if (this.onPlayerHit) this.onPlayerHit();
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
