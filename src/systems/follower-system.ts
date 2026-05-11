/**
 * FollowerSystem — Skyrim-style human companion system.
 *
 * Allows the player to recruit one NPC follower at a time.  Followers travel
 * with the player, assist in combat, and can be given commands (follow, wait,
 * trade).  Dismissing a follower returns them to their home location.
 *
 * Integration points:
 *   - `registerFollowerTemplate(def)` — register a potential companion.
 *   - `canRecruit(templateId)` — eligibility check (already have one, etc.).
 *   - `recruitFollower(templateId)` — hire an NPC; fires `onFollowerRecruited`.
 *   - `dismissFollower()` — send the current follower home.
 *   - `commandFollower(command)` — issue a "follow" / "wait" / "trade" order.
 *   - `followerTakeDamage(amount)` — apply damage in combat; fires `onFollowerDied`
 *     when health reaches zero.
 *   - `followerHeal(amount)` — restore follower health.
 *   - `getActiveFollower()` — returns the live follower state, or `null`.
 *   - `onFollowerRecruited / onFollowerDismissed / onFollowerDied` callbacks.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.followerSystem = new FollowerSystem();
 * this.followerSystem.onFollowerRecruited = (id, name) => {
 *   this._ui.showNotification(`${name} has joined you.`);
 * };
 * // When talking to a potential follower NPC:
 * this.followerSystem.recruitFollower("lydia");
 * // E to command:
 * this.followerSystem.commandFollower("wait");
 * ```
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 26
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/** Maximum number of concurrent followers (Skyrim default: 1). */
export const MAX_FOLLOWERS = 1;
/** Default follower base health. */
export const DEFAULT_FOLLOWER_HEALTH = 150;
/** Health scaling per follower level. */
export const HEALTH_PER_LEVEL = 10;
/** Default base attack damage. */
export const DEFAULT_FOLLOWER_DAMAGE = 20;
/** Damage scaling per level. */
export const DAMAGE_PER_LEVEL = 2;
/** Gold cost multiplier for paid followers. */
export const GOLD_COST_PER_LEVEL = 50;

// ── Types ──────────────────────────────────────────────────────────────────────

/** Combat role that determines a follower's preferred tactics. */
export type FollowerCombatRole = "warrior" | "archer" | "mage" | "rogue";

/** Standing order the player can issue. */
export type FollowerCommand = "follow" | "wait" | "trade";

/**
 * Tactical stance the follower adopts in combat (Avowed-style companion stance).
 *   aggressive — charges enemies and uses abilities offensively.
 *   defensive   — stays near the player and prioritises protection.
 *   stealth     — moves quietly and holds attacks until the player strikes.
 */
export type FollowerStance = "aggressive" | "defensive" | "stealth";

/** A player combat action that can trigger companion synergy combos. */
export type PlayerCombatAction =
  | "power_attack"   // heavy melee swing
  | "cast_spell"     // cast a magical spell
  | "sneak_attack"   // land a sneak/backstab hit
  | "arrow_shot";    // fire an arrow

/** Definition of a follower role's signature ability. */
export interface FollowerAbilityDefinition {
  /** Stable unique ability id. */
  id: string;
  /** Display name shown in the HUD. */
  name: string;
  /** Short description of the ability's effect. */
  description: string;
  /** Cooldown in in-game hours before the ability can be used again. */
  cooldownHours: number;
}

/** Data delivered to `onAbilityUsed` when a follower ability triggers. */
export interface FollowerAbilityResult {
  /** The ability that fired. */
  ability: FollowerAbilityDefinition;
  /** Template id of the follower that used the ability. */
  templateId: string;
  /** Follower name. */
  name: string;
}

/**
 * Definition of a player + follower action combo that creates a synergy burst.
 *
 * Avowed-style: landing a particular player action while the follower's role
 * matches triggers a bonus effect (e.g. player power-attack + warrior follower
 * → Momentum Surge that boosts the next hit).
 */
export interface ComboTrigger {
  /** Stable unique combo id. */
  comboId: string;
  /** Display name of the synergy effect. */
  comboName: string;
  /** Short description of the bonus effect. */
  description: string;
  /** Player action required to trigger this combo. */
  playerAction: PlayerCombatAction;
  /** Follower combat role required for the combo. */
  followerRole: FollowerCombatRole;
  /** Cooldown in in-game hours before this combo can fire again. */
  cooldownHours: number;
}

/** Data delivered to `onComboTriggered` when a synergy combo fires. */
export interface ComboResult {
  comboId:     string;
  comboName:   string;
  description: string;
  templateId:  string;
  followerName: string;
}

/** Template definition for a potential follower. */
export interface FollowerTemplate {
  /** Unique identifier (e.g. "lydia"). */
  id: string;
  /** Display name. */
  name: string;
  /** Short bio or background description. */
  description: string;
  /** Level of this follower (scales stats). */
  level: number;
  /** Preferred combat role. */
  combatRole: FollowerCombatRole;
  /**
   * Additional carry weight the follower contributes to the player's total
   * while active.  Default 0.
   */
  carryWeightBonus: number;
  /**
   * Gold required to hire (0 = free). Paid followers are re-hireable after
   * dismissal.
   */
  hireCost: number;
  /**
   * Home location identifier.  Returned here on dismiss.
   * May be a cell id or location name; interpretation is game-layer concern.
   */
  homeLocationId: string;
}

/** Reasons a recruit attempt can fail. */
export type FollowerRecruitFailReason =
  | "unknown_template"      // templateId not registered
  | "already_have_follower" // player already has an active follower
  | "insufficient_gold"     // player cannot afford the hire cost
  | "follower_deceased";    // the follower has died and cannot be rehired

/** Non-mutating eligibility check result. */
export interface FollowerRecruitCheck {
  canRecruit: boolean;
  reason?: FollowerRecruitFailReason;
  /** Gold cost for this follower (0 = free). */
  hireCost: number;
}

/** Live state of the active follower. */
export interface ActiveFollowerState {
  /** Template id. */
  templateId: string;
  /** Display name (copied from template). */
  name: string;
  /** Current health. */
  health: number;
  /** Maximum health (level-scaled). */
  maxHealth: number;
  /** Current attack damage (level-scaled). */
  attackDamage: number;
  /** Follower level. */
  level: number;
  /** Current standing order. */
  command: FollowerCommand;
  /** Whether the follower is alive. */
  isAlive: boolean;
}

// ── Save state ─────────────────────────────────────────────────────────────────

export interface FollowerSaveState {
  activeFollower: {
    templateId:   string;
    name:         string;
    health:       number;
    maxHealth:    number;
    attackDamage: number;
    level:        number;
    command:      FollowerCommand;
    isAlive:      boolean;
  } | null;
  /** Set of template ids whose followers have died (cannot be rehired). */
  deceasedFollowerIds: string[];
  /** Current tactical stance (added in v28; defaults to "aggressive" on old saves). */
  stance?: FollowerStance;
  /** In-game hours when the follower's ability was last used. */
  abilityLastUsedAtHours?: number | null;
  /** Per-combo last-used timestamps (in-game hours). */
  comboLastUsedAtHours?: Record<string, number>;
}

// ── Built-in follower templates ────────────────────────────────────────────────

/**
 * Eight iconic potential followers modelled on Skyrim companions.
 */
export const BUILTIN_FOLLOWERS: ReadonlyArray<FollowerTemplate> = [
  {
    id: "lydia",
    name: "Lydia",
    description:
      "A fierce and loyal housecarl, sworn to your service.  Favours heavy armour and one-handed weapons.",
    level: 6,
    combatRole: "warrior",
    carryWeightBonus: 50,
    hireCost: 0,
    homeLocationId: "whiterun_dragonsreach",
  },
  {
    id: "aela",
    name: "Aela the Huntress",
    description:
      "A skilled ranger and Companion.  Expert with the bow and light on her feet.",
    level: 12,
    combatRole: "archer",
    carryWeightBonus: 35,
    hireCost: 0,
    homeLocationId: "whiterun_companions_hall",
  },
  {
    id: "jenassa",
    name: "Jenassa",
    description:
      "A deadly mercenary for hire.  She prefers the shadows and dual blades.",
    level: 10,
    combatRole: "rogue",
    carryWeightBonus: 30,
    hireCost: 500,
    homeLocationId: "whiterun_drunken_huntsman",
  },
  {
    id: "j_zargo",
    name: "J'zargo",
    description:
      "A Khajiit mage of great ambition.  His destructive spells are unmatched, though his ego rivals them.",
    level: 15,
    combatRole: "mage",
    carryWeightBonus: 20,
    hireCost: 0,
    homeLocationId: "winterhold_college",
  },
  {
    id: "farkas",
    name: "Farkas",
    description:
      "A hulking Nord warrior and Companion.  Unshakeable in battle.",
    level: 10,
    combatRole: "warrior",
    carryWeightBonus: 60,
    hireCost: 0,
    homeLocationId: "whiterun_companions_hall",
  },
  {
    id: "borgakh",
    name: "Borgakh the Steel Heart",
    description:
      "An Orcish warrior of formidable strength.  She may join you in exchange for her freedom.",
    level: 14,
    combatRole: "warrior",
    carryWeightBonus: 55,
    hireCost: 0,
    homeLocationId: "mor_khazgur",
  },
  {
    id: "marcurio",
    name: "Marcurio",
    description:
      "An Imperial mage-for-hire who specialises in Destruction magic.",
    level: 12,
    combatRole: "mage",
    carryWeightBonus: 25,
    hireCost: 500,
    homeLocationId: "riften_bee_and_barb",
  },
  {
    id: "uthgerd",
    name: "Uthgerd the Unbroken",
    description:
      "A brawling Nord who respects strength.  Win her in a fist-fight and she will follow you anywhere.",
    level: 8,
    combatRole: "warrior",
    carryWeightBonus: 45,
    hireCost: 0,
    homeLocationId: "whiterun_bannered_mare",
  },
] as const;

// ── Built-in follower ability definitions ──────────────────────────────────────

/**
 * One signature combat ability per follower role.
 * Triggered via `FollowerSystem.triggerFollowerAbility(gameTimeHours)`.
 */
export const ROLE_ABILITIES: Readonly<Record<FollowerCombatRole, FollowerAbilityDefinition>> = {
  warrior: {
    id: "shield_bash",
    name: "Shield Bash",
    description: "Slams an enemy with a shield, stunning them briefly.",
    cooldownHours: 2,
  },
  archer: {
    id: "arrow_volley",
    name: "Arrow Volley",
    description: "Unleashes a rapid burst of arrows across a wide arc.",
    cooldownHours: 1,
  },
  mage: {
    id: "arcane_surge",
    name: "Arcane Surge",
    description: "Releases a focused blast of raw magical energy.",
    cooldownHours: 3,
  },
  rogue: {
    id: "smoke_bomb",
    name: "Smoke Bomb",
    description: "Throws a smoke bomb that blinds nearby enemies and boosts stealth.",
    cooldownHours: 2,
  },
} as const;

/**
 * Default synergy combos registered automatically at construction.
 * Additional combos can be added via `registerComboTrigger()`.
 */
export const BUILTIN_COMBOS: ReadonlyArray<ComboTrigger> = [
  {
    comboId:      "momentum_surge",
    comboName:    "Momentum Surge",
    description:  "Warrior's charge amplifies the player's power attack for bonus damage.",
    playerAction: "power_attack",
    followerRole: "warrior",
    cooldownHours: 4,
  },
  {
    comboId:      "arcane_resonance",
    comboName:    "Arcane Resonance",
    description:  "Mage's energy field resonates with the spell cast, amplifying its effect.",
    playerAction: "cast_spell",
    followerRole: "mage",
    cooldownHours: 5,
  },
  {
    comboId:      "shadow_strike",
    comboName:    "Shadow Strike",
    description:  "Rogue and player strike simultaneously from the shadows for doubled damage.",
    playerAction: "sneak_attack",
    followerRole: "rogue",
    cooldownHours: 3,
  },
  {
    comboId:      "rain_of_arrows",
    comboName:    "Rain of Arrows",
    description:  "Both archer and player fire at once, saturating the target area.",
    playerAction: "arrow_shot",
    followerRole: "archer",
    cooldownHours: 3,
  },
] as const;

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages recruitment, dismissal, commands, and combat state for the player's
 * active follower companion.
 */
export class FollowerSystem {
  private _templates:     Map<string, FollowerTemplate>  = new Map();
  private _activeFollower: ActiveFollowerState | null    = null;
  private _deceasedIds:   Set<string>                    = new Set();

  // ── v28 additions — stance, abilities, combos ─────────────────────────────
  private _stance: FollowerStance = "aggressive";
  private _abilityLastUsedAtHours: number | null = null;
  private _combos: Map<string, ComboTrigger> = new Map();
  private _comboLastUsedAtHours: Map<string, number> = new Map();

  constructor() {
    for (const def of BUILTIN_FOLLOWERS) {
      this.registerFollowerTemplate(def);
    }
    for (const combo of BUILTIN_COMBOS) {
      this._combos.set(combo.comboId, combo);
    }
  }

  // ── Callbacks ───────────────────────────────────────────────────────────────

  /**
   * Fired when a follower is successfully recruited.
   * @param templateId Template id.
   * @param name       Display name.
   */
  public onFollowerRecruited:
    | ((templateId: string, name: string) => void)
    | null = null;

  /**
   * Fired when the active follower is dismissed.
   * @param templateId   Template id.
   * @param name         Display name.
   * @param homeLocation Where the follower is returning to.
   */
  public onFollowerDismissed:
    | ((templateId: string, name: string, homeLocation: string) => void)
    | null = null;

  /**
   * Fired when the follower's health reaches zero in combat.
   * @param templateId Template id.
   * @param name       Display name.
   */
  public onFollowerDied:
    | ((templateId: string, name: string) => void)
    | null = null;

  /**
   * Fired when the player issues a command.
   * @param command The issued command.
   */
  public onCommandIssued: ((command: FollowerCommand) => void) | null = null;

  /**
   * Fired when the follower takes damage.
   * @param amount Amount of damage dealt.
   * @param remaining Health remaining.
   */
  public onFollowerDamaged:
    | ((amount: number, remaining: number) => void)
    | null = null;

  /**
   * Fired when the follower's tactical stance changes.
   * @param stance The new stance.
   */
  public onStanceChanged: ((stance: FollowerStance) => void) | null = null;

  /**
   * Fired when the follower's role ability is triggered.
   * @param result Data about the ability that fired.
   */
  public onAbilityUsed: ((result: FollowerAbilityResult) => void) | null = null;

  /**
   * Fired when a player combat action triggers a synergy combo.
   * @param result Data about the combo that activated.
   */
  public onComboTriggered: ((result: ComboResult) => void) | null = null;

  // ── Template registration ────────────────────────────────────────────────────

  /**
   * Register a follower template.
   * Built-in templates are registered automatically.
   * Registering a duplicate id replaces the template definition.
   */
  public registerFollowerTemplate(def: FollowerTemplate): void {
    this._templates.set(def.id, { ...def });
  }

  /**
   * Remove a follower template.  If this follower is currently active, it is
   * NOT automatically dismissed (the active state remains).
   * @returns `true` if the template existed and was removed.
   */
  public removeFollowerTemplate(id: string): boolean {
    return this._templates.delete(id);
  }

  /**
   * Returns the template definition for the given id, or `undefined`.
   */
  public getFollowerTemplate(id: string): Readonly<FollowerTemplate> | undefined {
    const t = this._templates.get(id);
    return t ? { ...t } : undefined;
  }

  /** Returns all registered template ids. */
  public get registeredTemplateIds(): ReadonlyArray<string> {
    return Array.from(this._templates.keys());
  }

  // ── Eligibility check ────────────────────────────────────────────────────────

  /**
   * Non-mutating check for whether the player can recruit the given follower.
   *
   * @param templateId  The follower to check.
   * @param playerGold  Player's current gold (used to gate paid followers).
   */
  public canRecruit(templateId: string, playerGold = Infinity): FollowerRecruitCheck {
    const tmpl = this._templates.get(templateId);
    if (!tmpl) {
      return { canRecruit: false, reason: "unknown_template", hireCost: 0 };
    }
    if (this._deceasedIds.has(templateId)) {
      return { canRecruit: false, reason: "follower_deceased", hireCost: tmpl.hireCost };
    }
    if (this._activeFollower !== null) {
      return { canRecruit: false, reason: "already_have_follower", hireCost: tmpl.hireCost };
    }
    if (playerGold < tmpl.hireCost) {
      return { canRecruit: false, reason: "insufficient_gold", hireCost: tmpl.hireCost };
    }
    return { canRecruit: true, hireCost: tmpl.hireCost };
  }

  // ── Recruitment ─────────────────────────────────────────────────────────────

  /**
   * Recruit a follower.  Spawns the follower with level-scaled stats and sets
   * the standing order to "follow".
   *
   * @param templateId  The follower template to hire.
   * @param playerGold  Player's current gold.  The system deducts the hire cost
   *                    and returns the remainder; pass `Infinity` to skip the
   *                    gold check (useful when the game layer handles gold
   *                    separately).
   * @returns The new `ActiveFollowerState` on success, or `null` on failure.
   *          The caller is responsible for deducting `hireCost` from the
   *          player's gold when `playerGold !== Infinity`.
   */
  public recruitFollower(templateId: string, playerGold = Infinity): ActiveFollowerState | null {
    const check = this.canRecruit(templateId, playerGold);
    if (!check.canRecruit) return null;

    const tmpl = this._templates.get(templateId)!;

    const maxHealth    = DEFAULT_FOLLOWER_HEALTH + tmpl.level * HEALTH_PER_LEVEL;
    const attackDamage = DEFAULT_FOLLOWER_DAMAGE  + tmpl.level * DAMAGE_PER_LEVEL;

    const follower: ActiveFollowerState = {
      templateId,
      name:         tmpl.name,
      health:       maxHealth,
      maxHealth,
      attackDamage,
      level:        tmpl.level,
      command:      "follow",
      isAlive:      true,
    };

    this._activeFollower = follower;
    this.onFollowerRecruited?.(templateId, tmpl.name);
    return { ...follower };
  }

  // ── Dismissal ───────────────────────────────────────────────────────────────

  /**
   * Dismiss the active follower, returning them to their home location.
   * @returns `false` if there is no active follower.
   */
  public dismissFollower(): boolean {
    if (!this._activeFollower) return false;

    const { templateId, name } = this._activeFollower;
    const tmpl = this._templates.get(templateId);
    const home = tmpl?.homeLocationId ?? "unknown";

    this._activeFollower = null;
    this.onFollowerDismissed?.(templateId, name, home);
    return true;
  }

  // ── Commands ─────────────────────────────────────────────────────────────────

  /**
   * Issue a standing order to the active follower.
   * @returns `false` if there is no active (alive) follower.
   */
  public commandFollower(command: FollowerCommand): boolean {
    if (!this._activeFollower || !this._activeFollower.isAlive) return false;
    this._activeFollower.command = command;
    this.onCommandIssued?.(command);
    return true;
  }

  // ── Combat ───────────────────────────────────────────────────────────────────

  /**
   * Apply damage to the active follower.
   * Fires `onFollowerDamaged`; if health reaches zero, fires `onFollowerDied`
   * and adds the follower to the deceased list.
   *
   * @returns `false` if there is no active (alive) follower.
   */
  public followerTakeDamage(amount: number): boolean {
    if (!this._activeFollower || !this._activeFollower.isAlive) return false;

    const actual  = Math.max(0, amount);
    this._activeFollower.health = Math.max(0, this._activeFollower.health - actual);
    this.onFollowerDamaged?.(actual, this._activeFollower.health);

    if (this._activeFollower.health <= 0) {
      this._activeFollower.isAlive = false;
      const { templateId, name } = this._activeFollower;
      this._deceasedIds.add(templateId);
      this.onFollowerDied?.(templateId, name);
      this._activeFollower = null;
    }

    return true;
  }

  /**
   * Restore health to the active follower.
   * Clamps to `maxHealth`.
   * @returns `false` if there is no active (alive) follower.
   */
  public followerHeal(amount: number): boolean {
    if (!this._activeFollower || !this._activeFollower.isAlive) return false;
    const actual = Math.max(0, amount);
    this._activeFollower.health = Math.min(
      this._activeFollower.maxHealth,
      this._activeFollower.health + actual,
    );
    return true;
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive copy of the active follower state, or `null` if no
   * follower is active.
   */
  public getActiveFollower(): Readonly<ActiveFollowerState> | null {
    return this._activeFollower ? { ...this._activeFollower } : null;
  }

  /** Returns `true` if the player currently has an active follower. */
  public get hasFollower(): boolean {
    return this._activeFollower !== null;
  }

  /**
   * Returns `true` if the given follower has died and cannot be rehired.
   */
  public isFollowerDeceased(templateId: string): boolean {
    return this._deceasedIds.has(templateId);
  }

  /** Returns the carry-weight bonus contributed by the active follower. */
  public get activeCarryWeightBonus(): number {
    if (!this._activeFollower) return 0;
    const tmpl = this._templates.get(this._activeFollower.templateId);
    return tmpl?.carryWeightBonus ?? 0;
  }

  /** Current tactical stance of the active follower. */
  public get followerStance(): FollowerStance {
    return this._stance;
  }

  // ── Stance ───────────────────────────────────────────────────────────────────

  /**
   * Set the active follower's tactical combat stance.
   *
   * Fires `onStanceChanged` when the stance changes.
   * @returns `false` if there is no active (alive) follower.
   */
  public setFollowerStance(stance: FollowerStance): boolean {
    if (!this._activeFollower || !this._activeFollower.isAlive) return false;
    if (this._stance === stance) return true;
    this._stance = stance;
    this.onStanceChanged?.(stance);
    return true;
  }

  // ── Abilities ─────────────────────────────────────────────────────────────────

  /**
   * Trigger the active follower's role-specific combat ability.
   *
   * The ability is determined by the follower's `combatRole`; each role has one
   * built-in signature ability (see {@link ROLE_ABILITIES}).  The call is
   * gated by the ability's `cooldownHours`.
   *
   * @param gameTimeHours Current in-game time in fractional hours [0, 24).
   * @returns A `FollowerAbilityResult` on success, or `null` if there is no
   *          active follower or the ability is on cooldown.
   */
  public triggerFollowerAbility(gameTimeHours: number): FollowerAbilityResult | null {
    if (!this._activeFollower || !this._activeFollower.isAlive) return null;

    const tmpl = this._templates.get(this._activeFollower.templateId);
    const role = tmpl?.combatRole ?? "warrior";
    const ability = ROLE_ABILITIES[role];

    // Cooldown gate
    if (this._abilityLastUsedAtHours !== null) {
      const elapsed = this._hoursDelta(this._abilityLastUsedAtHours, gameTimeHours);
      if (elapsed < ability.cooldownHours) return null;
    }

    this._abilityLastUsedAtHours = gameTimeHours;

    const result: FollowerAbilityResult = {
      ability,
      templateId: this._activeFollower.templateId,
      name:       this._activeFollower.name,
    };
    this.onAbilityUsed?.(result);
    return result;
  }

  /**
   * Returns the remaining cooldown in in-game hours for the follower's ability,
   * or 0 if the ability is ready.
   */
  public abilityCooldownRemaining(gameTimeHours: number): number {
    if (this._abilityLastUsedAtHours === null || !this._activeFollower) return 0;
    const tmpl   = this._templates.get(this._activeFollower.templateId);
    const role   = tmpl?.combatRole ?? "warrior";
    const cd     = ROLE_ABILITIES[role].cooldownHours;
    const elapsed = this._hoursDelta(this._abilityLastUsedAtHours, gameTimeHours);
    return Math.max(0, cd - elapsed);
  }

  // ── Combo synergy ─────────────────────────────────────────────────────────────

  /**
   * Register a synergy combo trigger.
   * Built-in combos are registered automatically; this allows mod-defined combos.
   * Registering a duplicate `comboId` replaces the existing entry.
   */
  public registerComboTrigger(combo: ComboTrigger): void {
    this._combos.set(combo.comboId, combo);
  }

  /**
   * Remove a combo trigger by id.
   * @returns `true` if the combo existed and was removed.
   */
  public removeComboTrigger(comboId: string): boolean {
    return this._combos.delete(comboId);
  }

  /** Returns the combo definition for the given id, or `undefined`. */
  public getComboTrigger(comboId: string): ComboTrigger | undefined {
    return this._combos.get(comboId);
  }

  /** All registered combo trigger ids. */
  public get registeredComboIds(): ReadonlyArray<string> {
    return Array.from(this._combos.keys());
  }

  /**
   * Notify the follower system of a player combat action.
   *
   * If the active follower's role has a matching synergy combo that is off
   * cooldown, `onComboTriggered` fires and the combo result is returned.
   *
   * @param action        Player combat action performed.
   * @param gameTimeHours Current in-game time in fractional hours [0, 24).
   * @returns A `ComboResult` if a synergy triggered, otherwise `null`.
   */
  public notifyPlayerAction(
    action: PlayerCombatAction,
    gameTimeHours: number,
  ): ComboResult | null {
    if (!this._activeFollower || !this._activeFollower.isAlive) return null;

    const tmpl = this._templates.get(this._activeFollower.templateId);
    const role = tmpl?.combatRole ?? "warrior";

    for (const combo of this._combos.values()) {
      if (combo.playerAction !== action)   continue;
      if (combo.followerRole  !== role)    continue;

      // Cooldown gate
      const last = this._comboLastUsedAtHours.get(combo.comboId) ?? null;
      if (last !== null) {
        const elapsed = this._hoursDelta(last, gameTimeHours);
        if (elapsed < combo.cooldownHours) continue;
      }

      this._comboLastUsedAtHours.set(combo.comboId, gameTimeHours);

      const result: ComboResult = {
        comboId:      combo.comboId,
        comboName:    combo.comboName,
        description:  combo.description,
        templateId:   this._activeFollower.templateId,
        followerName: this._activeFollower.name,
      };
      this.onComboTriggered?.(result);
      return result;
    }

    return null;
  }

  // ── Save / restore ────────────────────────────────────────────────────────────

  /** Returns a serialisable save snapshot. */
  public getSaveState(): FollowerSaveState {
    return {
      activeFollower: this._activeFollower ? { ...this._activeFollower } : null,
      deceasedFollowerIds: Array.from(this._deceasedIds),
      stance: this._stance,
      abilityLastUsedAtHours: this._abilityLastUsedAtHours,
      comboLastUsedAtHours: Object.fromEntries(this._comboLastUsedAtHours),
    };
  }

  /**
   * Restore system state from a previously saved snapshot.
   * Callbacks are NOT fired during restore.
   * Unknown template ids in activeFollower are accepted as-is (mod followers).
   */
  public restoreFromSave(saved: FollowerSaveState): void {
    this._deceasedIds = new Set(
      Array.isArray(saved.deceasedFollowerIds) ? saved.deceasedFollowerIds : [],
    );

    if (saved.activeFollower && typeof saved.activeFollower === "object") {
      const a = saved.activeFollower;
      this._activeFollower = {
        templateId:   String(a.templateId   ?? ""),
        name:         String(a.name         ?? ""),
        health:       typeof a.health       === "number" ? a.health       : 0,
        maxHealth:    typeof a.maxHealth    === "number" ? a.maxHealth    : 0,
        attackDamage: typeof a.attackDamage === "number" ? a.attackDamage : 0,
        level:        typeof a.level        === "number" ? a.level        : 1,
        command:      (["follow","wait","trade"] as const).includes(a.command as FollowerCommand)
          ? a.command as FollowerCommand
          : "follow",
        isAlive: typeof a.isAlive === "boolean" ? a.isAlive : true,
      };
    } else {
      this._activeFollower = null;
    }

    // Stance (defaults to "aggressive" for old saves without this field)
    this._stance = (["aggressive","defensive","stealth"] as const).includes(
      saved.stance as FollowerStance,
    )
      ? (saved.stance as FollowerStance)
      : "aggressive";

    // Ability cooldown
    this._abilityLastUsedAtHours =
      typeof saved.abilityLastUsedAtHours === "number"
        ? saved.abilityLastUsedAtHours
        : null;

    // Combo cooldowns
    this._comboLastUsedAtHours.clear();
    if (saved.comboLastUsedAtHours && typeof saved.comboLastUsedAtHours === "object") {
      for (const [id, hours] of Object.entries(saved.comboLastUsedAtHours)) {
        if (typeof hours === "number") this._comboLastUsedAtHours.set(id, hours);
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  /**
   * Compute elapsed in-game hours from `from` to `to`, wrapping correctly
   * across midnight (24-hour boundary).
   */
  private _hoursDelta(from: number, to: number): number {
    if (to >= from) return to - from;
    return 24 - from + to; // wrapped past midnight
  }
}
