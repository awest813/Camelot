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

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages recruitment, dismissal, commands, and combat state for the player's
 * active follower companion.
 */
export class FollowerSystem {
  private _templates:     Map<string, FollowerTemplate>  = new Map();
  private _activeFollower: ActiveFollowerState | null    = null;
  private _deceasedIds:   Set<string>                    = new Set();

  constructor() {
    for (const def of BUILTIN_FOLLOWERS) {
      this.registerFollowerTemplate(def);
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

  // ── Save / restore ────────────────────────────────────────────────────────────

  /** Returns a serialisable save snapshot. */
  public getSaveState(): FollowerSaveState {
    return {
      activeFollower: this._activeFollower ? { ...this._activeFollower } : null,
      deceasedFollowerIds: Array.from(this._deceasedIds),
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
  }
}
