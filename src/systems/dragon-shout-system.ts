/**
 * DragonShoutSystem — Skyrim-style Thu'um / Dragon Shout engine.
 *
 * Players discover Words of Power at Word Wall locations, then spend Dragon
 * Souls to unlock (activate) each word.  Each Shout is composed of one to
 * three words; using more unlocked words produces a stronger effect and a
 * longer cooldown.  Only one Shout may be equipped at a time and it is
 * activated via an in-game hotkey (R).
 *
 * Integration points:
 *   - `gainDragonSoul(count?)` — award souls after defeating a dragon.
 *   - `learnWord(shoutId, wordIndex)` — mark a word as discovered (Word Wall).
 *   - `unlockWord(shoutId, wordIndex)` — spend one Dragon Soul to activate a
 *     word; returns false when the soul count is insufficient.
 *   - `equipShout(shoutId)` — arm the shout for use.
 *   - `useShout(gameTimeMinutes)` — activate the equipped shout; returns a
 *     `ShoutUseResult` describing what happened.
 *   - `cooldownRemaining(shoutId, gameTimeMinutes)` — seconds left before the
 *     shout can be used again.
 *   - `onShoutUsed` callback — deliver effects to the game layer.
 *   - `onWordUnlocked` callback — fire HUD notification.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.dragonShoutSystem = new DragonShoutSystem();
 * // After slaying a dragon:
 * this.dragonShoutSystem.gainDragonSoul();
 * // At a Word Wall:
 * this.dragonShoutSystem.learnWord("unrelenting_force", 0);
 * this.dragonShoutSystem.unlockWord("unrelenting_force", 0);
 * // Equip and use (R key):
 * this.dragonShoutSystem.equipShout("unrelenting_force");
 * const result = this.dragonShoutSystem.useShout(this.timeSystem.gameTime);
 * if (result.success) { /* apply result.effects *\/ }
 * ```
 *
 * Headless: no BabylonJS dependencies — integrates via callbacks.
 * SAVE_VERSION: 26
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default number of in-game minutes per game hour (used for cooldown conversion). */
export const GAME_MINUTES_PER_HOUR = 60;

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * A single Word of Power that makes up part of a Shout.
 * Each word has a dragon-script name and an English translation.
 */
export interface WordOfPower {
  /** Dragon-script word (e.g. "FUS"). */
  dragonWord: string;
  /** English translation (e.g. "Force"). */
  translation: string;
}

/**
 * Per-tier shout effect applied when the shout is used with the given number
 * of unlocked words (tier 1 = one word, tier 2 = two, tier 3 = three).
 */
export interface ShoutTierEffect {
  /** Human-readable description of what this tier does. */
  description: string;
  /**
   * Cooldown in real seconds after using this tier.
   * Skyrim uses real-time cooldowns; we store them in seconds and apply them
   * as in-game-minute offsets when saving.
   */
  cooldownSeconds: number;
  /**
   * Structured effect payload the game layer can interpret.
   * Keys are effect names (e.g. "knockback_force", "fire_damage") and values
   * are numeric magnitudes.
   */
  effects: Record<string, number>;
}

/** A complete Shout definition containing up to three Words of Power. */
export interface ShoutDefinition {
  /** Unique identifier (e.g. "unrelenting_force"). */
  id: string;
  /** Display name (e.g. "Unrelenting Force"). */
  name: string;
  /** Flavour description shown in the shouts menu. */
  description: string;
  /**
   * The one, two, or three Words of Power for this shout.
   * Index 0 = first word, 1 = second, 2 = third.
   * A shout MUST have at least one word.
   */
  words: [WordOfPower, WordOfPower?, WordOfPower?];
  /**
   * Per-tier effects.  Index maps to (word count - 1):
   * `tiers[0]` = effect when only the first word is unlocked,
   * `tiers[1]` = effect when first two words are unlocked, etc.
   * Length must equal `words.length`.
   */
  tiers: [ShoutTierEffect, ShoutTierEffect?, ShoutTierEffect?];
}

/** Per-shout runtime state. */
export interface ShoutState {
  /**
   * Which words have been discovered at a Word Wall.
   * Indexed 0–2; `true` = word is known (can be unlocked).
   */
  learned: [boolean, boolean, boolean];
  /**
   * Which words have been unlocked by spending a Dragon Soul.
   * Indexed 0–2; `true` = word is active (contributes to shout tier).
   */
  unlocked: [boolean, boolean, boolean];
  /**
   * In-game time (minutes) when this shout was last used, or null if never.
   * Used to calculate cooldown remaining.
   */
  lastUsedMinutes: number | null;
}

/** Reasons a shout use can fail. */
export type ShoutFailReason =
  | "no_shout_equipped"   // player has not equipped any shout
  | "unknown_shout"       // equipped shout id is not registered
  | "no_words_unlocked"   // player has learned but not unlocked any words
  | "on_cooldown";        // shout was used recently

/** Result of a {@link DragonShoutSystem.useShout} call. */
export type ShoutUseResult =
  | {
      success: true;
      shoutId: string;
      /** How many words were used (1–3). */
      wordCount: number;
      /** The tier effect that was applied. */
      tier: ShoutTierEffect;
    }
  | {
      success: false;
      reason: ShoutFailReason;
      /** Remaining cooldown in seconds (only set when reason is "on_cooldown"). */
      cooldownRemainingSeconds?: number;
    };

// ── Save state ─────────────────────────────────────────────────────────────────

export interface DragonShoutSaveState {
  dragonSouls: number;
  equippedShoutId: string | null;
  shoutStates: Record<string, {
    learned:  [boolean, boolean, boolean];
    unlocked: [boolean, boolean, boolean];
    lastUsedMinutes: number | null;
  }>;
}

// ── Built-in shout catalogue ───────────────────────────────────────────────────

/**
 * Eight canonical Skyrim shouts provided out of the box.
 * Games can register additional shouts via {@link DragonShoutSystem.registerShout}.
 */
export const BUILTIN_SHOUTS: ReadonlyArray<ShoutDefinition> = [
  // ── Unrelenting Force ───────────────────────────────────────────────────────
  {
    id: "unrelenting_force",
    name: "Unrelenting Force",
    description:
      "Your Voice is raw power, pushing aside anything — or anyone — that stands in your path.",
    words: [
      { dragonWord: "FUS",  translation: "Force"   },
      { dragonWord: "RO",   translation: "Balance" },
      { dragonWord: "DAH",  translation: "Push"    },
    ],
    tiers: [
      {
        description: "Sends a shockwave that staggers nearby enemies.",
        cooldownSeconds: 2,
        effects: { knockback_force: 50 },
      },
      {
        description: "Blasts enemies away with a powerful shockwave.",
        cooldownSeconds: 5,
        effects: { knockback_force: 120, stagger_duration: 1.5 },
      },
      {
        description:
          "Unleashes the full power of the Thu'um, sending enemies flying.",
        cooldownSeconds: 15,
        effects: { knockback_force: 250, stagger_duration: 3.0, knockback_damage: 10 },
      },
    ],
  },
  // ── Whirlwind Sprint ────────────────────────────────────────────────────────
  {
    id: "whirlwind_sprint",
    name: "Whirlwind Sprint",
    description:
      "The Thu'um rushes forward, carrying you in its wake with the speed of a whirlwind.",
    words: [
      { dragonWord: "WULD",  translation: "Whirlwind" },
      { dragonWord: "NAH",   translation: "Fury"      },
      { dragonWord: "KEST",  translation: "Tempest"   },
    ],
    tiers: [
      {
        description: "Sprint forward at great speed for a short distance.",
        cooldownSeconds: 20,
        effects: { dash_distance: 20, dash_duration_ms: 200 },
      },
      {
        description: "Sprint forward at great speed for a moderate distance.",
        cooldownSeconds: 25,
        effects: { dash_distance: 40, dash_duration_ms: 350 },
      },
      {
        description: "Dash forward an enormous distance in the blink of an eye.",
        cooldownSeconds: 30,
        effects: { dash_distance: 75, dash_duration_ms: 500 },
      },
    ],
  },
  // ── Become Ethereal ─────────────────────────────────────────────────────────
  {
    id: "become_ethereal",
    name: "Become Ethereal",
    description:
      "The Thu'um reaches out to the Void, changing your form to one that cannot be harmed.",
    words: [
      { dragonWord: "FEIM",  translation: "Fade"  },
      { dragonWord: "ZII",   translation: "Spirit" },
      { dragonWord: "GRON",  translation: "Bind"   },
    ],
    tiers: [
      {
        description: "Become ethereal for 8 seconds; you cannot attack or be harmed.",
        cooldownSeconds: 26,
        effects: { ethereal_duration: 8 },
      },
      {
        description: "Become ethereal for 13 seconds.",
        cooldownSeconds: 26,
        effects: { ethereal_duration: 13 },
      },
      {
        description: "Become ethereal for 18 seconds.",
        cooldownSeconds: 26,
        effects: { ethereal_duration: 18 },
      },
    ],
  },
  // ── Fire Breath ─────────────────────────────────────────────────────────────
  {
    id: "fire_breath",
    name: "Fire Breath",
    description:
      "Inhale air, exhale flame, and behold the Thu'um as a blazing inferno.",
    words: [
      { dragonWord: "YOL",   translation: "Fire"    },
      { dragonWord: "TOOR",  translation: "Inferno" },
      { dragonWord: "SHUL",  translation: "Sun"     },
    ],
    tiers: [
      {
        description: "Exhale a short burst of flame dealing 25 fire damage.",
        cooldownSeconds: 30,
        effects: { fire_damage: 25 },
      },
      {
        description: "Exhale a larger burst of flame dealing 50 fire damage.",
        cooldownSeconds: 50,
        effects: { fire_damage: 50 },
      },
      {
        description: "Breathe a torrent of fire dealing 80 fire damage.",
        cooldownSeconds: 100,
        effects: { fire_damage: 80, fire_dot_damage: 10, fire_dot_duration: 3 },
      },
    ],
  },
  // ── Ice Form ────────────────────────────────────────────────────────────────
  {
    id: "ice_form",
    name: "Ice Form",
    description:
      "Your Thu'um freezes an opponent solid.",
    words: [
      { dragonWord: "IIZ",   translation: "Ice"  },
      { dragonWord: "SLEN",  translation: "Flesh" },
      { dragonWord: "NUS",   translation: "Statue" },
    ],
    tiers: [
      {
        description: "Freeze an enemy for 5 seconds.",
        cooldownSeconds: 60,
        effects: { freeze_duration: 5 },
      },
      {
        description: "Freeze an enemy for 10 seconds.",
        cooldownSeconds: 90,
        effects: { freeze_duration: 10 },
      },
      {
        description: "Freeze an enemy solid for 15 seconds.",
        cooldownSeconds: 120,
        effects: { freeze_duration: 15, frost_damage: 20 },
      },
    ],
  },
  // ── Slow Time ───────────────────────────────────────────────────────────────
  {
    id: "slow_time",
    name: "Slow Time",
    description:
      "Shout at time itself, halting it momentarily as your Thu'um echoes through Eternity.",
    words: [
      { dragonWord: "TIID",  translation: "Time"  },
      { dragonWord: "KLO",   translation: "Sand"  },
      { dragonWord: "UL",    translation: "Eternity" },
    ],
    tiers: [
      {
        description: "Slow time to 50% speed for 8 seconds.",
        cooldownSeconds: 30,
        effects: { time_scale: 0.5, slow_duration: 8 },
      },
      {
        description: "Slow time to 25% speed for 10 seconds.",
        cooldownSeconds: 45,
        effects: { time_scale: 0.25, slow_duration: 10 },
      },
      {
        description: "Slow time to 10% speed for 15 seconds.",
        cooldownSeconds: 120,
        effects: { time_scale: 0.1, slow_duration: 15 },
      },
    ],
  },
  // ── Clear Skies ─────────────────────────────────────────────────────────────
  {
    id: "clear_skies",
    name: "Clear Skies",
    description:
      "Skyrim itself yields before the Thu'um, as you clear away fog and inclement weather.",
    words: [
      { dragonWord: "LOK",   translation: "Sky"  },
      { dragonWord: "VAH",   translation: "Spring" },
      { dragonWord: "KOOR",  translation: "Summer" },
    ],
    tiers: [
      {
        description: "Clear nearby fog for 30 seconds.",
        cooldownSeconds: 5,
        effects: { clear_fog: 30 },
      },
      {
        description: "Dispel fog and light cloud cover for 60 seconds.",
        cooldownSeconds: 5,
        effects: { clear_fog: 60, clear_overcast: 1 },
      },
      {
        description: "Banish all storms and clouds, bringing clear skies.",
        cooldownSeconds: 5,
        effects: { clear_fog: 120, clear_weather: 1 },
      },
    ],
  },
  // ── Elemental Fury ──────────────────────────────────────────────────────────
  {
    id: "elemental_fury",
    name: "Elemental Fury",
    description:
      "The Thu'um imbues your arms with the speed of wind, allowing you to attack faster.",
    words: [
      { dragonWord: "SU",    translation: "Air"    },
      { dragonWord: "GRAH",  translation: "Battle" },
      { dragonWord: "DUN",   translation: "Grace"  },
    ],
    tiers: [
      {
        description: "Attack 25% faster for 15 seconds.",
        cooldownSeconds: 30,
        effects: { attack_speed_mult: 1.25, attack_speed_duration: 15 },
      },
      {
        description: "Attack 50% faster for 15 seconds.",
        cooldownSeconds: 30,
        effects: { attack_speed_mult: 1.5, attack_speed_duration: 15 },
      },
      {
        description: "Attack 100% faster for 17 seconds.",
        cooldownSeconds: 45,
        effects: { attack_speed_mult: 2.0, attack_speed_duration: 17 },
      },
    ],
  },
] as const;

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Manages Skyrim-style Dragon Shouts: word discovery, soul unlocking,
 * equipping, use, and cooldown tracking.
 */
export class DragonShoutSystem {
  private _shouts:         Map<string, ShoutDefinition> = new Map();
  private _shoutStates:    Map<string, ShoutState>      = new Map();
  private _dragonSouls     = 0;
  private _equippedShoutId: string | null                = null;

  constructor() {
    for (const def of BUILTIN_SHOUTS) {
      this.registerShout(def);
    }
  }

  // ── Callbacks ───────────────────────────────────────────────────────────────

  /**
   * Fired when a shout is successfully activated.
   * Use this to apply the shout's effects in the game layer.
   */
  public onShoutUsed:
    | ((shoutId: string, wordCount: number, tier: ShoutTierEffect) => void)
    | null = null;

  /**
   * Fired when a Word of Power is unlocked (soul spent).
   * Use this for HUD notifications.
   */
  public onWordUnlocked:
    | ((shoutId: string, wordIndex: number, wordDef: WordOfPower) => void)
    | null = null;

  /**
   * Fired when a Word of Power is discovered at a Word Wall.
   * Use this for HUD notifications and journal entries.
   */
  public onWordLearned:
    | ((shoutId: string, wordIndex: number, wordDef: WordOfPower) => void)
    | null = null;

  /**
   * Fired when dragon souls are gained.
   * @param total Current total after the addition.
   */
  public onDragonSoulGained: ((total: number) => void) | null = null;

  // ── Shout registration ───────────────────────────────────────────────────────

  /**
   * Register a shout definition.
   * Built-in shouts are registered automatically in the constructor.
   * Call this to add mod-defined shouts.
   * Re-registering an existing id replaces the definition without affecting
   * the runtime state (learned/unlocked words) of that shout.
   */
  public registerShout(def: ShoutDefinition): void {
    this._shouts.set(def.id, def);
    if (!this._shoutStates.has(def.id)) {
      this._shoutStates.set(def.id, {
        learned:  [false, false, false],
        unlocked: [false, false, false],
        lastUsedMinutes: null,
      });
    }
  }

  /**
   * Remove a shout definition and its state.
   * If the removed shout was equipped, the equipped slot is cleared.
   * @returns `true` if the shout existed and was removed.
   */
  public removeShout(shoutId: string): boolean {
    const existed = this._shouts.delete(shoutId);
    if (existed) {
      this._shoutStates.delete(shoutId);
      if (this._equippedShoutId === shoutId) {
        this._equippedShoutId = null;
      }
    }
    return existed;
  }

  /**
   * Returns the definition for the given shout id, or `undefined` if not
   * registered.
   */
  public getShout(shoutId: string): ShoutDefinition | undefined {
    return this._shouts.get(shoutId);
  }

  /** Returns all registered shout definitions. */
  public getAllShouts(): ReadonlyArray<ShoutDefinition> {
    return Array.from(this._shouts.values());
  }

  /** Returns all registered shout ids. */
  public get registeredShoutIds(): ReadonlyArray<string> {
    return Array.from(this._shouts.keys());
  }

  // ── Dragon souls ─────────────────────────────────────────────────────────────

  /** Current dragon soul count. */
  public get dragonSouls(): number {
    return this._dragonSouls;
  }

  /**
   * Award one or more dragon souls to the player.
   * Fires `onDragonSoulGained` with the new total.
   * @param count Number of souls to add (default 1).
   */
  public gainDragonSoul(count = 1): void {
    const amount = Math.max(0, Math.floor(count));
    if (amount === 0) return;
    this._dragonSouls += amount;
    this.onDragonSoulGained?.(this._dragonSouls);
  }

  /**
   * Deduct dragon souls (for non-unlock uses, e.g. scripted events).
   * Clamps to zero; does not fire `onDragonSoulGained`.
   * @returns `true` if the full amount was available and deducted.
   */
  public spendDragonSouls(count: number): boolean {
    const amount = Math.max(0, Math.floor(count));
    if (this._dragonSouls < amount) return false;
    this._dragonSouls -= amount;
    return true;
  }

  // ── Word learning (Word Wall discovery) ──────────────────────────────────────

  /**
   * Mark a word as discovered (player visited a Word Wall).
   * A learned word can be unlocked by spending a Dragon Soul.
   *
   * @param shoutId    The shout the word belongs to.
   * @param wordIndex  Which word (0, 1, or 2).
   * @returns `false` if the shout is unknown, the index is out of range,
   *          or the word has no definition at that index.
   */
  public learnWord(shoutId: string, wordIndex: 0 | 1 | 2): boolean {
    const def   = this._shouts.get(shoutId);
    const state = this._shoutStates.get(shoutId);
    if (!def || !state) return false;
    if (wordIndex < 0 || wordIndex > 2) return false;
    if (!def.words[wordIndex]) return false;
    if (state.learned[wordIndex]) return true; // already known — idempotent

    state.learned[wordIndex] = true;
    this.onWordLearned?.(shoutId, wordIndex, def.words[wordIndex]!);
    return true;
  }

  /**
   * Returns whether the given word has been discovered.
   */
  public isWordLearned(shoutId: string, wordIndex: 0 | 1 | 2): boolean {
    return this._shoutStates.get(shoutId)?.learned[wordIndex] ?? false;
  }

  // ── Word unlocking (Dragon Soul spending) ─────────────────────────────────────

  /**
   * Spend one Dragon Soul to unlock a learned word.
   * Words must be unlocked in order (word 1 before word 2, etc.).
   *
   * @returns `false` when:
   *   - shout is unknown,
   *   - wordIndex is invalid,
   *   - the word is not yet learned,
   *   - a previous word has not been unlocked,
   *   - or the player has no Dragon Souls.
   */
  public unlockWord(shoutId: string, wordIndex: 0 | 1 | 2): boolean {
    const def   = this._shouts.get(shoutId);
    const state = this._shoutStates.get(shoutId);
    if (!def || !state) return false;
    if (wordIndex < 0 || wordIndex > 2) return false;
    if (!def.words[wordIndex]) return false;
    if (!state.learned[wordIndex]) return false;
    if (state.unlocked[wordIndex]) return true; // idempotent

    // Enforce ordering: previous word must already be unlocked
    if (wordIndex > 0 && !state.unlocked[wordIndex - 1 as 0 | 1]) return false;

    // Spend a soul
    if (this._dragonSouls < 1) return false;
    this._dragonSouls--;

    state.unlocked[wordIndex] = true;
    this.onWordUnlocked?.(shoutId, wordIndex, def.words[wordIndex]!);
    return true;
  }

  /**
   * Returns whether the given word is unlocked and active.
   */
  public isWordUnlocked(shoutId: string, wordIndex: 0 | 1 | 2): boolean {
    return this._shoutStates.get(shoutId)?.unlocked[wordIndex] ?? false;
  }

  /**
   * Returns the highest unlocked tier (word count) for a shout.
   * Returns 0 if no words are unlocked.
   */
  public getUnlockedTier(shoutId: string): 0 | 1 | 2 | 3 {
    const state = this._shoutStates.get(shoutId);
    if (!state) return 0;
    let tier: 0 | 1 | 2 | 3 = 0;
    for (let i = 0; i < 3; i++) {
      if (state.unlocked[i]) tier = (i + 1) as 1 | 2 | 3;
    }
    return tier;
  }

  // ── Shout equipment ──────────────────────────────────────────────────────────

  /**
   * Equip a shout for activation.
   * @returns `false` if the shout id is not registered.
   */
  public equipShout(shoutId: string): boolean {
    if (!this._shouts.has(shoutId)) return false;
    this._equippedShoutId = shoutId;
    return true;
  }

  /** Unequip the active shout. */
  public unequipShout(): void {
    this._equippedShoutId = null;
  }

  /** The id of the currently equipped shout, or `null` if none. */
  public get equippedShoutId(): string | null {
    return this._equippedShoutId;
  }

  // ── Cooldown ─────────────────────────────────────────────────────────────────

  /**
   * Returns the cooldown remaining for a shout in seconds.
   * Returns 0 if the shout is not on cooldown or has never been used.
   *
   * @param shoutId          The shout to check.
   * @param gameTimeMinutes  Current in-game time in minutes.
   */
  public cooldownRemaining(shoutId: string, gameTimeMinutes: number): number {
    const def   = this._shouts.get(shoutId);
    const state = this._shoutStates.get(shoutId);
    if (!def || !state || state.lastUsedMinutes === null) return 0;

    const tier = this.getUnlockedTier(shoutId);
    if (tier === 0) return 0;

    const tierDef = def.tiers[tier - 1]!;
    const cooldownMinutes = tierDef.cooldownSeconds / 60;
    const elapsed = gameTimeMinutes - state.lastUsedMinutes;
    const remaining = cooldownMinutes - elapsed;

    return remaining > 0 ? remaining * 60 : 0;
  }

  /**
   * Returns `true` if the equipped shout is ready to use (off cooldown and
   * has at least one unlocked word).
   *
   * @param gameTimeMinutes Current in-game time in minutes.
   */
  public isShoutReady(gameTimeMinutes: number): boolean {
    if (!this._equippedShoutId) return false;
    const tier = this.getUnlockedTier(this._equippedShoutId);
    if (tier === 0) return false;
    return this.cooldownRemaining(this._equippedShoutId, gameTimeMinutes) === 0;
  }

  // ── Shout activation ─────────────────────────────────────────────────────────

  /**
   * Activate the currently equipped shout.
   *
   * Chooses the highest unlocked tier, applies the cooldown, fires
   * `onShoutUsed`, and returns a `ShoutUseResult`.
   *
   * @param gameTimeMinutes Current in-game time in minutes (from TimeSystem).
   */
  public useShout(gameTimeMinutes: number): ShoutUseResult {
    if (!this._equippedShoutId) {
      return { success: false, reason: "no_shout_equipped" };
    }

    const shoutId = this._equippedShoutId;
    const def     = this._shouts.get(shoutId);
    const state   = this._shoutStates.get(shoutId);

    if (!def || !state) {
      return { success: false, reason: "unknown_shout" };
    }

    const tier = this.getUnlockedTier(shoutId);
    if (tier === 0) {
      return { success: false, reason: "no_words_unlocked" };
    }

    const remaining = this.cooldownRemaining(shoutId, gameTimeMinutes);
    if (remaining > 0) {
      return { success: false, reason: "on_cooldown", cooldownRemainingSeconds: remaining };
    }

    const tierDef = def.tiers[tier - 1]!;
    state.lastUsedMinutes = gameTimeMinutes;

    this.onShoutUsed?.(shoutId, tier, tierDef);

    return {
      success: true,
      shoutId,
      wordCount: tier,
      tier: tierDef,
    };
  }

  // ── Save / restore ────────────────────────────────────────────────────────────

  /** Returns a serialisable save snapshot. */
  public getSaveState(): DragonShoutSaveState {
    const shoutStates: DragonShoutSaveState["shoutStates"] = {};
    for (const [id, state] of this._shoutStates) {
      shoutStates[id] = {
        learned:  [...state.learned]  as [boolean, boolean, boolean],
        unlocked: [...state.unlocked] as [boolean, boolean, boolean],
        lastUsedMinutes: state.lastUsedMinutes,
      };
    }
    return {
      dragonSouls:     this._dragonSouls,
      equippedShoutId: this._equippedShoutId,
      shoutStates,
    };
  }

  /**
   * Restore system state from a previously saved snapshot.
   * Unknown shout ids in the snapshot are silently skipped.
   * Callbacks are NOT fired during restore.
   */
  public restoreFromSave(saved: DragonShoutSaveState): void {
    this._dragonSouls     = typeof saved.dragonSouls === "number" && saved.dragonSouls >= 0
      ? saved.dragonSouls
      : 0;
    this._equippedShoutId = (typeof saved.equippedShoutId === "string" &&
                             this._shouts.has(saved.equippedShoutId))
      ? saved.equippedShoutId
      : null;

    if (saved.shoutStates && typeof saved.shoutStates === "object") {
      for (const [id, raw] of Object.entries(saved.shoutStates)) {
        const state = this._shoutStates.get(id);
        if (!state) continue; // unknown shout — skip
        if (Array.isArray(raw.learned)  && raw.learned.length  === 3)
          state.learned  = [...raw.learned]  as [boolean, boolean, boolean];
        if (Array.isArray(raw.unlocked) && raw.unlocked.length === 3)
          state.unlocked = [...raw.unlocked] as [boolean, boolean, boolean];
        state.lastUsedMinutes = typeof raw.lastUsedMinutes === "number"
          ? raw.lastUsedMinutes
          : null;
      }
    }
  }
}
