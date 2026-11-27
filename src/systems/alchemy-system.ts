import type { Player } from "../entities/player";
import type { UIManager } from "../ui/ui-manager";
import { unseededRandom } from "../core/rng/rng";

// ── Alchemy effect types ──────────────────────────────────────────────────────

export type AlchemyEffectId =
  | "restore_health"
  | "restore_magicka"
  | "restore_stamina"
  | "damage_health"
  | "damage_magicka"
  | "fortify_strength"
  | "fortify_endurance"
  | "fortify_intelligence"
  | "fortify_speed"
  | "resist_fire"
  | "resist_frost"
  | "resist_shock"
  | "weakness_fire"
  | "weakness_frost"
  | "weakness_shock"
  | "invisibility"
  | "night_eye"
  | "feather"
  | "burden"
  | "silence";

export interface AlchemyEffect {
  id: AlchemyEffectId;
  name: string;
  description: string;
  /** Base magnitude for one unit of potency. Scaled by ingredient potency. */
  baseMagnitude: number;
  /** Base duration in seconds. 0 for instant effects. */
  baseDuration: number;
  /** If true, the effect harms rather than helps the caster (used for sorting). */
  isHarmful: boolean;
}

// ── Ingredient definition ─────────────────────────────────────────────────────

export interface IngredientDefinition {
  id: string;
  name: string;
  description?: string;
  /** Weight of one unit (affects carry weight). */
  weight: number;
  /** Gold value of one unit. */
  value: number;
  /**
   * Up to 4 effects this ingredient has.
   * The first effect is revealed on first use;
   * subsequent effects are discovered through experimentation (crafting).
   */
  effects: AlchemyEffectId[];
  /** Potency multiplier (default 1.0). Higher quality ingredients = stronger effects. */
  potency?: number;
}

// ── Potion ────────────────────────────────────────────────────────────────────

export interface AlchemyPotion {
  id: string;
  name: string;
  /** Effects this potion carries (intersection of ingredient effects). */
  effects: Array<{ effectId: AlchemyEffectId; magnitude: number; duration: number }>;
  /** Base gold value. */
  value: number;
  weight: number;
  /** Source ingredient ids used to create this potion. */
  sourceIngredients: string[];
}

// ── Save state ────────────────────────────────────────────────────────────────

export interface AlchemySaveState {
  /** Ingredient id → quantity in player's alchemy satchel. */
  ingredients: Record<string, number>;
  /** Set of (ingredientId, effectIndex) pairs the player has already discovered. */
  discoveredEffects: Array<[string, number]>;
  /** Potions the player has crafted but not yet used. */
  craftedPotions: AlchemyPotion[];
}

// ── Effect catalogue ──────────────────────────────────────────────────────────

export const ALCHEMY_EFFECTS: Record<AlchemyEffectId, AlchemyEffect> = {
  restore_health:       { id: "restore_health",       name: "Restore Health",       description: "Instantly heals the drinker.",                        baseMagnitude: 10, baseDuration: 0,    isHarmful: false },
  restore_magicka:      { id: "restore_magicka",      name: "Restore Magicka",      description: "Restores Magicka instantly.",                          baseMagnitude: 10, baseDuration: 0,    isHarmful: false },
  restore_stamina:      { id: "restore_stamina",      name: "Restore Stamina",      description: "Restores Stamina instantly.",                          baseMagnitude: 15, baseDuration: 0,    isHarmful: false },
  damage_health:        { id: "damage_health",        name: "Damage Health",        description: "Poisons the target, reducing their health over time.",  baseMagnitude: 4,  baseDuration: 10,   isHarmful: true  },
  damage_magicka:       { id: "damage_magicka",       name: "Damage Magicka",       description: "Drains the target's Magicka over time.",               baseMagnitude: 3,  baseDuration: 10,   isHarmful: true  },
  fortify_strength:     { id: "fortify_strength",     name: "Fortify Strength",     description: "Increases Strength, improving melee damage.",          baseMagnitude: 5,  baseDuration: 60,   isHarmful: false },
  fortify_endurance:    { id: "fortify_endurance",    name: "Fortify Endurance",    description: "Increases Endurance, improving health.",               baseMagnitude: 5,  baseDuration: 60,   isHarmful: false },
  fortify_intelligence: { id: "fortify_intelligence", name: "Fortify Intelligence", description: "Increases Intelligence, improving Magicka.",           baseMagnitude: 5,  baseDuration: 60,   isHarmful: false },
  fortify_speed:        { id: "fortify_speed",        name: "Fortify Speed",        description: "Increases movement speed.",                            baseMagnitude: 10, baseDuration: 30,   isHarmful: false },
  resist_fire:          { id: "resist_fire",          name: "Resist Fire",          description: "Reduces fire damage taken.",                           baseMagnitude: 10, baseDuration: 60,   isHarmful: false },
  resist_frost:         { id: "resist_frost",         name: "Resist Frost",         description: "Reduces frost damage taken.",                          baseMagnitude: 10, baseDuration: 60,   isHarmful: false },
  resist_shock:         { id: "resist_shock",         name: "Resist Shock",         description: "Reduces shock damage taken.",                          baseMagnitude: 10, baseDuration: 60,   isHarmful: false },
  weakness_fire:        { id: "weakness_fire",        name: "Weakness to Fire",     description: "Increases fire damage taken.",                         baseMagnitude: 10, baseDuration: 30,   isHarmful: true  },
  weakness_frost:       { id: "weakness_frost",       name: "Weakness to Frost",    description: "Increases frost damage taken.",                        baseMagnitude: 10, baseDuration: 30,   isHarmful: true  },
  weakness_shock:       { id: "weakness_shock",       name: "Weakness to Shock",    description: "Increases shock damage taken.",                        baseMagnitude: 10, baseDuration: 30,   isHarmful: true  },
  invisibility:         { id: "invisibility",         name: "Invisibility",         description: "Renders the caster invisible.",                        baseMagnitude: 1,  baseDuration: 30,   isHarmful: false },
  night_eye:            { id: "night_eye",            name: "Owl-sight",            description: "Allows seeing in the dark.",                           baseMagnitude: 1,  baseDuration: 60,   isHarmful: false },
  feather:              { id: "feather",              name: "Lightfoot",            description: "Reduces carry weight burden.",                         baseMagnitude: 50, baseDuration: 120,  isHarmful: false },
  burden:               { id: "burden",               name: "Weight",               description: "Increases the target's carry weight.",                 baseMagnitude: 50, baseDuration: 30,   isHarmful: true  },
  silence:              { id: "silence",              name: "Silence",              description: "Prevents the target from casting spells.",             baseMagnitude: 1,  baseDuration: 15,   isHarmful: true  },
};

// ── Starter ingredient catalogue ──────────────────────────────────────────────

export const DEFAULT_INGREDIENTS: IngredientDefinition[] = [
  {
    id: "henbane",
    name: "Henbane",
    description: "Sticky, foul-smelling leaves of the hedgerow; a poisoner's friend.",
    weight: 0.1,
    value: 8,
    effects: ["damage_health", "weakness_fire", "damage_magicka", "restore_stamina"],
  },
  {
    id: "comfrey_root",
    name: "Comfrey Root",
    description: "Knitbone, the herbwives call it: it mends flesh and bone.",
    weight: 0.1,
    value: 5,
    effects: ["restore_health", "restore_stamina", "damage_magicka", "fortify_strength"],
  },
  {
    id: "plantain_leaves",
    name: "Plantain Leaves",
    description: "Broad wayside leaves, chewed and laid on burns and cuts.",
    weight: 0.1,
    value: 4,
    effects: ["restore_health", "restore_stamina", "resist_fire", "fortify_endurance"],
  },
  {
    id: "vervain",
    name: "Vervain",
    description: "The druids' holy herb, gathered when neither sun nor moon is up.",
    weight: 0.1,
    value: 3,
    effects: ["restore_magicka", "fortify_intelligence", "restore_health", "resist_frost"],
  },
  {
    id: "eyebright",
    name: "Eyebright",
    description: "A little white flower of the meadows that clears the sight and the mind.",
    weight: 0.1,
    value: 4,
    effects: ["restore_magicka", "fortify_intelligence", "resist_frost", "weakness_frost"],
  },
  {
    id: "fly_agaric",
    name: "Fly Agaric",
    description: "The red-capped toadstool of fairy rings. Handle with care.",
    weight: 0.1,
    value: 12,
    effects: ["damage_health", "damage_magicka", "silence", "invisibility"],
    potency: 1.25,
  },
  {
    id: "meadowsweet",
    name: "Meadowsweet",
    description: "Creamy flowers of the water meadows, strewn on floors for their scent.",
    weight: 0.1,
    value: 5,
    effects: ["resist_shock", "restore_health", "fortify_endurance", "weakness_shock"],
  },
  {
    id: "st_johns_wort",
    name: "St John's Wort",
    description: "Yellow midsummer flowers that bleed red when crushed; hung over doors against fire.",
    weight: 0.1,
    value: 7,
    effects: ["resist_fire", "fortify_strength", "fortify_endurance", "weakness_frost"],
    potency: 1.1,
  },
  {
    id: "boar_tusk",
    name: "Boar Tusk",
    description: "A wild boar's tusk, sharp as a knife and twice as mean.",
    weight: 0.3,
    value: 20,
    effects: ["damage_health", "burden", "fortify_strength", "resist_shock"],
    potency: 1.3,
  },
  {
    id: "wolfsbane",
    name: "Wolfsbane",
    description: "Hooded blue flowers, deadly to wolves and to men.",
    weight: 0.2,
    value: 15,
    effects: ["damage_health", "damage_magicka", "weakness_fire", "burden"],
    potency: 1.2,
  },
  {
    id: "hares_foot",
    name: "Hare's Foot",
    description: "A hare's foot, carried for luck and swiftness.",
    weight: 0.1,
    value: 2,
    effects: ["restore_stamina", "feather", "fortify_speed", "resist_frost"],
  },
  {
    id: "puffball",
    name: "Puffball",
    description: "A round white mushroom of the pastures; its dust stanches blood.",
    weight: 0.1,
    value: 3,
    effects: ["restore_health", "burden", "weakness_fire", "damage_magicka"],
  },
  {
    id: "foxglove",
    name: "Foxglove",
    description: "Tall purple bells: a little steadies the heart, a little more stops it.",
    weight: 0.1,
    value: 10,
    effects: ["damage_health", "silence", "damage_magicka", "weakness_shock"],
    potency: 1.15,
  },
  {
    id: "owl_feather",
    name: "Owl Feather",
    description: "A barn owl's soft feather, said to lend the owl's sight in the dark.",
    weight: 0.1,
    value: 2,
    effects: ["night_eye", "restore_stamina", "feather", "resist_frost"],
  },
  {
    id: "fern_seed",
    name: "Fern Seed",
    description: "Gathered on midsummer's eve, when fern seed is said to make the bearer unseen.",
    weight: 0.2,
    value: 8,
    effects: ["restore_magicka", "resist_fire", "fortify_intelligence", "invisibility"],
  },
];

// ── AlchemySystem ─────────────────────────────────────────────────────────────

/**
 * Alchemy: herbs, finds and the potions brewed from them.
 *
 * Core loop:
 *  1. Player collects ingredients in the world (addIngredient).
 *  2. Eating a single ingredient reveals its first effect (eatIngredient).
 *  3. Combining 2–4 ingredients at an alchemy apparatus creates a potion
 *     with the effects shared by ≥2 ingredients (craftPotion).
 *  4. Drinking a potion applies its effects to the player (drinkPotion).
 *
 * Skill integration:
 *  - `alchemySkill` (0–100) scales potion magnitude and duration.
 *  - Every successful craft increases the skill.
 */
export class AlchemySystem {
  /**
   * Where this system's random rolls come from.  The game gives it a named
   * stream of the kernel's seeded RNG, so a seed replays a session; tests
   * and standalone use fall back to an unseeded source.
   */
  public random: () => number = unseededRandom;

  private _player: Player;
  private _ui: UIManager;

  /** Registered ingredient definitions. */
  private _ingredientDefs: Map<string, IngredientDefinition> = new Map();

  /** Player's ingredient satchel: id → quantity. */
  private _ingredients: Map<string, number> = new Map();

  /**
   * Which (ingredientId, effectIndex) pairs the player has discovered.
   * The first effect (index 0) of each ingredient is auto-revealed on
   * first use; subsequent indices require mixing.
   */
  private _discoveredEffects: Set<string> = new Set();

  /** Potions the player has crafted and not yet consumed. */
  private _craftedPotions: AlchemyPotion[] = [];

  /** Player alchemy skill (0–100). Improves magnitude and duration. */
  public alchemySkill: number = 15;

  /** Fired when a potion is successfully crafted. */
  public onPotionCrafted: ((potion: AlchemyPotion) => void) | null = null;

  /** Fired when a potion effect resolves on the player. */
  public onPotionDrunk: ((potion: AlchemyPotion) => void) | null = null;

  constructor(player: Player, ui: UIManager) {
    this._player = player;
    this._ui     = ui;

    for (const def of DEFAULT_INGREDIENTS) {
      this._ingredientDefs.set(def.id, def);
    }
  }

  // ── Ingredient registry ──────────────────────────────────────────────────

  /** Register a custom ingredient definition (for mod support). */
  public registerIngredient(def: IngredientDefinition): void {
    this._ingredientDefs.set(def.id, def);
  }

  /** All registered ingredient definitions. */
  public getIngredientDefinitions(): IngredientDefinition[] {
    return Array.from(this._ingredientDefs.values());
  }

  public getIngredientDef(id: string): IngredientDefinition | undefined {
    return this._ingredientDefs.get(id);
  }

  // ── Satchel management ───────────────────────────────────────────────────

  /** Add `quantity` of an ingredient to the player's satchel. Returns false if unknown id. */
  public addIngredient(id: string, quantity: number = 1): boolean {
    if (!this._ingredientDefs.has(id)) return false;
    this._ingredients.set(id, (this._ingredients.get(id) ?? 0) + quantity);
    return true;
  }

  /** Remove `quantity` from the satchel. Returns false if insufficient. */
  public removeIngredient(id: string, quantity: number = 1): boolean {
    const current = this._ingredients.get(id) ?? 0;
    if (current < quantity) return false;
    const next = current - quantity;
    if (next <= 0) {
      this._ingredients.delete(id);
    } else {
      this._ingredients.set(id, next);
    }
    return true;
  }

  /** Current quantity of an ingredient in the satchel. */
  public getIngredientCount(id: string): number {
    return this._ingredients.get(id) ?? 0;
  }

  /** All ingredients the player currently carries. */
  public getSatchelContents(): Array<{ def: IngredientDefinition; quantity: number }> {
    const result: Array<{ def: IngredientDefinition; quantity: number }> = [];
    for (const [id, qty] of this._ingredients) {
      const def = this._ingredientDefs.get(id);
      if (def) result.push({ def, quantity: qty });
    }
    return result;
  }

  // ── Effect discovery ─────────────────────────────────────────────────────

  /** Internal key for a (ingredientId, effectIndex) discovery. */
  private _discoveryKey(ingredientId: string, effectIndex: number): string {
    return `${ingredientId}:${effectIndex}`;
  }

  /** Returns true if the player has discovered the given effect slot. */
  public hasDiscoveredEffect(ingredientId: string, effectIndex: number): boolean {
    return this._discoveredEffects.has(this._discoveryKey(ingredientId, effectIndex));
  }

  /** Mark an effect slot as discovered. */
  private _discover(ingredientId: string, effectIndex: number): void {
    this._discoveredEffects.add(this._discoveryKey(ingredientId, effectIndex));
  }

  /**
   * Eat a raw ingredient.  Reveals its first effect and applies it (at half
   * potency) to the player.  Consumes one unit from the satchel.
   *
   * Returns null if the ingredient is not in the satchel.
   */
  public eatIngredient(id: string): string | null {
    const def = this._ingredientDefs.get(id);
    if (!def) return null;
    if (!this.removeIngredient(id, 1)) return null;

    // Reveal first effect
    this._discover(id, 0);

    const firstEffectId = def.effects[0];
    const effect = ALCHEMY_EFFECTS[firstEffectId];
    const potency = def.potency ?? 1.0;
    const magnitude = Math.round(effect.baseMagnitude * potency * 0.5); // half potency for raw

    const msg = this._applyEffectToPlayer(firstEffectId, magnitude, 0);
    const notification = `Ate ${def.name}: ${effect.name} (${msg})`;
    this._ui.showNotification(notification, 2000);
    return notification;
  }

  // ── Crafting ─────────────────────────────────────────────────────────────

  /**
   * Attempt to craft a potion from the given ingredient ids.
   *
   * Rules:
   * - 2–4 ingredients required.
   * - All must be in the satchel.
   * - The resulting potion contains all effects shared by ≥2 ingredients.
   * - Mixing reveals all effect slots for each used ingredient.
   * - One unit of each ingredient is consumed.
   *
   * Returns the crafted potion on success, or null with a UI notification on failure.
   */
  public craftPotion(ingredientIds: string[]): AlchemyPotion | null {
    if (ingredientIds.length < 2 || ingredientIds.length > 4) {
      this._ui.showNotification("Alchemy requires 2–4 ingredients.", 2000);
      return null;
    }

    // Validate and load defs
    const defs: IngredientDefinition[] = [];
    for (const id of ingredientIds) {
      const def = this._ingredientDefs.get(id);
      if (!def) {
        this._ui.showNotification(`Unknown ingredient: ${id}`, 2000);
        return null;
      }
      if ((this._ingredients.get(id) ?? 0) < 1) {
        this._ui.showNotification(`Not enough ${def.name}.`, 2000);
        return null;
      }
      defs.push(def);
    }

    // Tally effect frequency across all ingredients
    const effectCount: Map<AlchemyEffectId, number> = new Map();
    const effectPotency: Map<AlchemyEffectId, number> = new Map();
    for (const def of defs) {
      const seen = new Set<AlchemyEffectId>();
      for (const eid of def.effects) {
        if (seen.has(eid)) continue; // deduplicate per-ingredient
        seen.add(eid);
        effectCount.set(eid, (effectCount.get(eid) ?? 0) + 1);
        const prev = effectPotency.get(eid) ?? 0;
        effectPotency.set(eid, Math.max(prev, def.potency ?? 1.0));
      }
    }

    // Keep only effects present in ≥2 ingredients
    const sharedEffects: AlchemyEffectId[] = [];
    for (const [eid, count] of effectCount) {
      if (count >= 2) sharedEffects.push(eid);
    }

    if (sharedEffects.length === 0) {
      this._ui.showNotification("No matching effects — potion failed.", 2000);
      // Still consume ingredients and reveal effects (you learn from failure)
      for (const id of ingredientIds) {
        this.removeIngredient(id, 1);
        const def = this._ingredientDefs.get(id)!;
        for (let i = 0; i < def.effects.length; i++) this._discover(id, i);
      }
      return null;
    }

    // Consume ingredients and reveal all effects
    for (const id of ingredientIds) {
      this.removeIngredient(id, 1);
      const def = this._ingredientDefs.get(id)!;
      for (let i = 0; i < def.effects.length; i++) this._discover(id, i);
    }

    // Compute skill bonus (0–100 → 0.5×–2.0× multiplier)
    const skillMult = 0.5 + (this.alchemySkill / 100) * 1.5;

    // Build potion effects
    const potionEffects = sharedEffects.map((eid) => {
      const eff      = ALCHEMY_EFFECTS[eid];
      const potency  = effectPotency.get(eid) ?? 1.0;
      const magnitude = Math.max(1, Math.round(eff.baseMagnitude * potency * skillMult));
      const duration  = eff.baseDuration > 0
        ? Math.max(1, Math.round(eff.baseDuration * skillMult))
        : 0;
      return { effectId: eid, magnitude, duration };
    });

    // Name potion: majority helpful = "Potion of X", majority harmful = "Poison of X"
    const harmfulCount = sharedEffects.filter(e => ALCHEMY_EFFECTS[e].isHarmful).length;
    const prefix = harmfulCount > sharedEffects.length / 2 ? "Poison" : "Potion";
    const primaryEffect = ALCHEMY_EFFECTS[sharedEffects[0]];
    const potionName = `${prefix} of ${primaryEffect.name}`;

    // Value = sum of individual ingredient values * skill multiplier
    const baseValue = defs.reduce((s, d) => s + d.value, 0);
    const potionValue = Math.round(baseValue * skillMult);

    const potion: AlchemyPotion = {
      id: `potion_${Date.now()}_${Math.floor(this.random() * 1000)}`,
      name: potionName,
      effects: potionEffects,
      value: potionValue,
      weight: 0.5,
      sourceIngredients: ingredientIds.slice(),
    };

    this._craftedPotions.push(potion);

    // Raise alchemy skill slightly on each successful craft
    this.alchemySkill = Math.min(100, this.alchemySkill + 1 + Math.floor(sharedEffects.length * 0.5));

    this._ui.showNotification(`Crafted: ${potionName}`, 2500);
    this.onPotionCrafted?.(potion);
    return potion;
  }

  // ── Consumption ───────────────────────────────────────────────────────────

  /** Player's current crafted potion inventory. */
  public get craftedPotions(): AlchemyPotion[] {
    return this._craftedPotions.slice();
  }

  /**
   * Drink a potion from the crafted list by index or id.
   * Applies all effects immediately and removes the potion from inventory.
   *
   * Returns false if the potion wasn't found.
   */
  public drinkPotion(potionId: string): boolean {
    const idx = this._craftedPotions.findIndex(p => p.id === potionId);
    if (idx === -1) return false;

    const potion = this._craftedPotions.splice(idx, 1)[0];

    const msgs: string[] = [];
    for (const entry of potion.effects) {
      const msg = this._applyEffectToPlayer(entry.effectId, entry.magnitude, entry.duration);
      msgs.push(`${ALCHEMY_EFFECTS[entry.effectId].name}: ${msg}`);
    }

    this._ui.showNotification(`Drank ${potion.name}`, 1500);
    if (msgs.length) {
      this._ui.showNotification(msgs.join(", "), 3000);
    }
    this.onPotionDrunk?.(potion);
    return true;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Apply a single alchemy effect to the player.
   * Returns a short description of what was applied.
   */
  /**
   * Where a potion's lasting effects go (the game's active effects and the
   * stealth cloak): set by the game. Without it they fall back to the old
   * permanent bonuses.
   */
  public effects: {
    timed(kind: "fortify_strength" | "fortify_health" | "fortify_magicka" | "resist_damage" | "burden", magnitude: number, seconds: number, name: string): void;
    unseen(seconds: number): void;
  } | null = null;

  private _applyEffectToPlayer(
    effectId: AlchemyEffectId,
    magnitude: number,
    _duration: number,
  ): string {
    const fx = this.effects;
    const secs = _duration > 0 ? _duration : 60;
    if (fx) {
      switch (effectId) {
        case "fortify_strength": fx.timed("fortify_strength", magnitude, secs, "Fortify Strength"); return `+${magnitude} Strength (${secs}s)`;
        case "fortify_endurance": fx.timed("fortify_health", magnitude * 2, secs, "Fortify Endurance"); return `+${magnitude * 2} max health (${secs}s)`;
        case "fortify_intelligence": fx.timed("fortify_magicka", magnitude, secs, "Fortify Intelligence"); return `+${magnitude} max magicka (${secs}s)`;
        case "feather": fx.timed("burden", -magnitude, secs, "Lightfoot"); return `+${magnitude} carry weight (${secs}s)`;
        case "burden": fx.timed("burden", magnitude, secs, "Weight"); return `-${magnitude} carry weight (${secs}s)`;
        case "resist_fire": case "resist_frost": case "resist_shock":
          fx.timed("resist_damage", Math.round(magnitude / 2), secs, "Resist harm"); return `Harm taken -${Math.round(magnitude / 2)}% (${secs}s)`;
        case "invisibility": fx.unseen(secs); return `Unseen (${secs}s)`;
        default: break;
      }
    }
    switch (effectId) {
      case "restore_health": {
        const actual = Math.min(magnitude, this._player.maxHealth - this._player.health);
        this._player.health = Math.min(this._player.maxHealth, this._player.health + magnitude);
        return `+${actual} HP`;
      }
      case "restore_magicka": {
        const actual = Math.min(magnitude, this._player.maxMagicka - this._player.magicka);
        this._player.magicka = Math.min(this._player.maxMagicka, this._player.magicka + magnitude);
        return `+${actual} Magicka`;
      }
      case "restore_stamina": {
        const actual = Math.min(magnitude, this._player.maxStamina - this._player.stamina);
        this._player.stamina = Math.min(this._player.maxStamina, this._player.stamina + magnitude);
        return `+${actual} Stamina`;
      }
      case "damage_health":
        this._player.health = Math.max(0, this._player.health - magnitude);
        this._player.notifyDamageTaken();
        return `-${magnitude} HP`;
      case "damage_magicka":
        this._player.magicka = Math.max(0, this._player.magicka - magnitude);
        return `-${magnitude} Magicka`;
      case "feather":
        // Increase effective carry capacity for duration (simplified: permanent +magnitude)
        this._player.maxCarryWeight += magnitude;
        return `+${magnitude} carry weight`;
      case "burden":
        this._player.maxCarryWeight = Math.max(0, this._player.maxCarryWeight - magnitude);
        return `-${magnitude} carry weight`;
      // Stat fortifications: map to bonus damage / armor as a simplification
      case "fortify_strength":
        this._player.bonusDamage += magnitude;
        return `+${magnitude} melee damage`;
      case "fortify_intelligence":
        this._player.bonusMagicDamage += magnitude;
        return `+${magnitude} magic damage`;
      case "fortify_endurance":
        this._player.bonusArmor += magnitude;
        return `+${magnitude} armor`;
      case "fortify_speed":
        this._player.baseSpeed = Math.min(1.5, this._player.baseSpeed + magnitude / 100);
        return `+${magnitude}% speed`;
      // Resistance/weakness effects are noted in the notification only (not yet
      // wired into a player resistance table — that's a future enhancement).
      case "resist_fire":
        return `Fire resist +${magnitude}% (${_duration}s)`;
      case "resist_frost":
        return `Frost resist +${magnitude}% (${_duration}s)`;
      case "resist_shock":
        return `Shock resist +${magnitude}% (${_duration}s)`;
      case "weakness_fire":
        return `Fire weakness +${magnitude}% (${_duration}s)`;
      case "weakness_frost":
        return `Frost weakness +${magnitude}% (${_duration}s)`;
      case "weakness_shock":
        return `Shock weakness +${magnitude}% (${_duration}s)`;
      case "invisibility":
        return `Invisible (${_duration}s)`;
      case "night_eye":
        return `Owl-sight (${_duration}s)`;
      case "silence":
        return `Silenced (${_duration}s)`;
      default:
        return `effect applied`;
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): AlchemySaveState {
    const ingredients: Record<string, number> = {};
    for (const [id, qty] of this._ingredients) {
      ingredients[id] = qty;
    }

    const discoveredEffects: Array<[string, number]> = [];
    for (const key of this._discoveredEffects) {
      const [ingredientId, indexStr] = key.split(":");
      discoveredEffects.push([ingredientId, parseInt(indexStr, 10)]);
    }

    return {
      ingredients,
      discoveredEffects,
      craftedPotions: this._craftedPotions.slice(),
    };
  }

  public restoreFromSave(state: AlchemySaveState): void {
    if (!state) return;

    this._ingredients.clear();
    if (state.ingredients && typeof state.ingredients === "object") {
      for (const [id, qty] of Object.entries(state.ingredients)) {
        if (typeof qty === "number" && qty > 0 && this._ingredientDefs.has(id)) {
          this._ingredients.set(id, qty);
        }
      }
    }

    this._discoveredEffects.clear();
    if (Array.isArray(state.discoveredEffects)) {
      for (const [ingId, idx] of state.discoveredEffects) {
        if (typeof ingId === "string" && typeof idx === "number") {
          this._discoveredEffects.add(this._discoveryKey(ingId, idx));
        }
      }
    }

    this._craftedPotions = [];
    if (Array.isArray(state.craftedPotions)) {
      // Basic validation: check required fields exist
      for (const p of state.craftedPotions) {
        if (p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.effects)) {
          this._craftedPotions.push(p as AlchemyPotion);
        }
      }
    }
  }
}
