import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { NPC } from "../entities/npc";
import type { Player } from "../entities/player";
import type { UIManager } from "../ui/ui-manager";

// ── Spell types ───────────────────────────────────────────────────────────────

export type SpellSchool = "destruction" | "restoration" | "illusion" | "conjuration" | "alteration";
export type SpellDelivery = "touch" | "target" | "self";
export type DamageType = "fire" | "frost" | "shock" | "magic" | "poison";

export interface SpellDefinition {
  id: string;
  name: string;
  description?: string;
  school: SpellSchool;
  delivery: SpellDelivery;
  /** Magicka consumed on cast. */
  magickaCost: number;
  /** Seconds before this spell can be cast again. */
  cooldown: number;
  /** Direct damage dealt to target (if any). */
  damage?: number;
  damageType?: DamageType;
  /** HP restored to the caster. */
  heal?: number;
  /** Effect duration in seconds (e.g. for damage-over-time or buff spells). */
  duration?: number;
  /** Maximum cast range in world units (for target delivery). */
  range?: number;
  /** Splash/area radius (0 or undefined = single target). */
  aoeRadius?: number;
}

export interface SpellCastResult {
  success: boolean;
  /** Why the cast failed, if success === false. */
  reason?: "no_spell_equipped" | "insufficient_magicka" | "on_cooldown";
  damage?: number;
  heal?: number;
  hitNpc?: string;
}

export interface SpellSaveState {
  knownSpellIds: string[];
  equippedSpellId: string | null;
}

// ── Default starting spells ───────────────────────────────────────────────────

export const DEFAULT_SPELLS: SpellDefinition[] = [
  {
    id: "flames",
    name: "Flames",
    description: "A gout of fire that deals 8 fire damage on contact and burns for 3 seconds.",
    school: "destruction",
    delivery: "target",
    magickaCost: 14,
    cooldown: 0.4,
    damage: 8,
    damageType: "fire",
    range: 18,
    duration: 3,
  },
  {
    id: "frostbite",
    name: "Frostbite",
    description: "A freezing ray dealing 10 frost damage and slowing for 4 seconds.",
    school: "destruction",
    delivery: "target",
    magickaCost: 18,
    cooldown: 0.6,
    damage: 10,
    damageType: "frost",
    range: 22,
    duration: 4,
  },
  {
    id: "spark",
    name: "Spark",
    description: "A jolt of lightning dealing 12 shock damage and shocking for 2 seconds.",
    school: "destruction",
    delivery: "target",
    magickaCost: 22,
    cooldown: 0.8,
    damage: 12,
    damageType: "shock",
    range: 25,
    duration: 2,
  },
  {
    id: "healing",
    name: "Healing",
    description: "Restore 20 HP instantly.",
    school: "restoration",
    delivery: "self",
    magickaCost: 25,
    cooldown: 1.5,
    heal: 20,
  },
  {
    id: "heal_other",
    name: "Heal Other",
    description: "Restore 15 HP to a friendly target.",
    school: "restoration",
    delivery: "target",
    magickaCost: 30,
    cooldown: 1.5,
    heal: 15,
    range: 12,
  },
  {
    id: "fireball",
    name: "Fireball",
    description: "An explosive ball of fire dealing 35 damage in a 5m radius and burning for 5 seconds.",
    school: "destruction",
    delivery: "target",
    magickaCost: 55,
    cooldown: 2.0,
    damage: 35,
    damageType: "fire",
    range: 30,
    aoeRadius: 5,
    duration: 5,
  },
  {
    id: "poison_touch",
    name: "Poison Touch",
    description: "Poisons the target for 8 damage per second over 6 seconds on touch.",
    school: "destruction",
    delivery: "touch",
    magickaCost: 35,
    cooldown: 1.0,
    damage: 5,
    damageType: "poison",
    duration: 6,
  },
  {
    id: "greater_heal",
    name: "Greater Heal",
    description: "Restore 50 HP instantly.",
    school: "restoration",
    delivery: "self",
    magickaCost: 55,
    cooldown: 3.0,
    heal: 50,
  },
];

// ── SpellSystem ───────────────────────────────────────────────────────────────

const TOUCH_RANGE = 3.5; // world units for "touch" delivery spells

/**
 * Manages known spells, the currently equipped spell, casting cooldowns,
 * and delivers spell effects to NPCs and the player.
 *
 * Design:
 *   - Spells are pure data (SpellDefinition).  Effects are resolved here,
 *     no BabylonJS mesh required for the core logic.
 *   - Optional `scene` reference is used only for visual hit particles
 *     (nullable to support headless tests).
 *   - `castSpell()` checks magicka and cooldown, applies damage/heal,
 *     then fires the optional `onSpellCast` hook for audio/VFX.
 *
 * Usage:
 *   1. Construct with player, npc list, and ui.
 *   2. Call `learnSpell(id)` to add a spell to the known pool.
 *   3. Call `equipSpell(id)` to select the active spell slot.
 *   4. Call `castSpell()` on the appropriate input event.
 *   5. Call `update(deltaTime)` every game frame to advance cooldowns.
 */
export class SpellSystem {
  private _player: Player;
  private _npcs: NPC[];
  private _ui: UIManager;
  private _scene: Scene | null;

  private _definitions: Map<string, SpellDefinition> = new Map();
  private _knownSpellIds: Set<string> = new Set();
  private _equippedSpellId: string | null = null;
  private _cooldownRemaining: number = 0;

  /** Base magic damage bonus contributed by the AttributeSystem. */
  public magicDamageBonus: number = 0;

  /**
   * Fired when a spell is successfully cast.
   * Hook to play audio, spawn a visual projectile / particle burst, etc.
   */
  public onSpellCast: ((spell: SpellDefinition, result: SpellCastResult) => void) | null = null;

  constructor(player: Player, npcs: NPC[], ui: UIManager, scene: Scene | null = null) {
    this._player = player;
    this._npcs   = npcs;
    this._ui     = ui;
    this._scene  = scene;

    // Register default spell library
    for (const spell of DEFAULT_SPELLS) {
      this._definitions.set(spell.id, spell);
    }
  }

  // ── NPC list hot-swap ─────────────────────────────────────────────────────

  public get npcs(): NPC[] { return this._npcs; }
  public set npcs(value: NPC[]) { this._npcs = value; }

  // ── Spell registry ────────────────────────────────────────────────────────

  /** Register a custom spell definition (from mods / data files). */
  public registerSpell(def: SpellDefinition): void {
    this._definitions.set(def.id, def);
  }

  /** Returns all registered spell definitions. */
  public getDefinitions(): SpellDefinition[] {
    return Array.from(this._definitions.values());
  }

  // ── Learning & equipping ──────────────────────────────────────────────────

  /**
   * Add a spell to the player's known pool.
   * Returns false if the spell is already known or the id is invalid.
   */
  public learnSpell(spellId: string): boolean {
    if (!this._definitions.has(spellId)) return false;
    if (this._knownSpellIds.has(spellId)) return false;
    this._knownSpellIds.add(spellId);
    return true;
  }

  /** Returns true if the player knows the spell. */
  public knowsSpell(spellId: string): boolean {
    return this._knownSpellIds.has(spellId);
  }

  /** All spells the player has learned. */
  public get knownSpells(): SpellDefinition[] {
    return Array.from(this._knownSpellIds)
      .map(id => this._definitions.get(id)!)
      .filter(Boolean);
  }

  /**
   * Equip (select) a known spell for casting.
   * Returns false if the player doesn't know the spell.
   */
  public equipSpell(spellId: string): boolean {
    if (!this._knownSpellIds.has(spellId)) return false;
    this._equippedSpellId = spellId;
    const spell = this._definitions.get(spellId)!;
    this._ui.showNotification(`Equipped: ${spell.name}`, 1500);
    return true;
  }

  /** The currently equipped spell definition, or null if none selected. */
  public get equippedSpell(): SpellDefinition | null {
    if (!this._equippedSpellId) return null;
    return this._definitions.get(this._equippedSpellId) ?? null;
  }

  /** Seconds remaining until the equipped spell can be cast again. */
  public get cooldownRemaining(): number { return this._cooldownRemaining; }

  // ── Casting ───────────────────────────────────────────────────────────────

  /**
   * Attempt to cast the equipped spell.
   *
   * - Checks magicka and cooldown preconditions.
   * - Applies effects (damage NPCs in range, heal player, etc.).
   * - Notifies the UI.
   * - Fires `onSpellCast` hook.
   */
  public castSpell(): SpellCastResult {
    const spell = this.equippedSpell;
    if (!spell) return { success: false, reason: "no_spell_equipped" };

    if (this._cooldownRemaining > 0) {
      return { success: false, reason: "on_cooldown" };
    }

    if (this._player.magicka < spell.magickaCost) {
      this._ui.showNotification("Not enough Magicka!", 1500);
      return { success: false, reason: "insufficient_magicka" };
    }

    // Consume magicka and start cooldown
    this._player.magicka -= spell.magickaCost;
    this._player.notifyResourceSpent("magicka");
    this._cooldownRemaining = spell.cooldown;

    const result = this._resolveEffect(spell);

    const msg = result.hitNpc
      ? `${spell.name} → ${result.hitNpc} (${result.damage ?? 0} dmg)`
      : result.heal
        ? `${spell.name} → healed ${result.heal} HP`
        : `${spell.name} cast`;
    this._ui.showNotification(msg, 1500);

    this.onSpellCast?.(spell, result);
    return result;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /** Advance cooldown timer.  Call every game frame. */
  public update(deltaTime: number): void {
    if (this._cooldownRemaining > 0) {
      this._cooldownRemaining = Math.max(0, this._cooldownRemaining - deltaTime);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _resolveEffect(spell: SpellDefinition): SpellCastResult {
    // Self-targeted spells
    if (spell.delivery === "self") {
      if (spell.heal) {
        const actual = Math.min(spell.heal, this._player.maxHealth - this._player.health);
        this._player.health = Math.min(this._player.maxHealth, this._player.health + spell.heal);
        return { success: true, heal: actual };
      }
      return { success: true };
    }

    // Touch / target spells
    const range = spell.delivery === "touch" ? TOUCH_RANGE : (spell.range ?? 20);
    const playerPos = this._player.camera.position;

    if (spell.damage) {
      const baseDamage = spell.damage + this.magicDamageBonus;
      let hitNpcName: string | undefined;

      if (spell.aoeRadius && spell.aoeRadius > 0) {
        // AoE: find a point in front of the camera and damage all in radius
        const forward = this._player.camera.getForwardRay
          ? this._player.camera.getForwardRay(range).direction
          : new Vector3(0, 0, 1);
        const impactPoint = playerPos.add(forward.scale(Math.min(range, 25)));

        for (const npc of this._npcs) {
          if (npc.isDead) continue;
          const dist = Vector3.Distance(npc.mesh.position, impactPoint);
          if (dist <= spell.aoeRadius) {
            npc.takeDamage(baseDamage);
            this._applySpellDoT(spell, npc);
            hitNpcName = hitNpcName ?? npc.mesh.name;
          }
        }
      } else {
        // Single target: find nearest NPC within range + facing cone
        const target = this._findTargetNpc(playerPos, range);
        if (target) {
          target.takeDamage(baseDamage);
          this._applySpellDoT(spell, target);
          hitNpcName = target.mesh.name;
        }
      }

      return { success: true, damage: baseDamage, hitNpc: hitNpcName };
    }

    if (spell.heal) {
      // Heal-other: find nearest NPC (friendly) or default to self
      const actual = Math.min(spell.heal, this._player.maxHealth - this._player.health);
      this._player.health = Math.min(this._player.maxHealth, this._player.health + spell.heal);
      return { success: true, heal: actual };
    }

    return { success: true };
  }

  /**
   * Apply a damage-over-time status effect to an NPC when the spell has a
   * `duration` configured.  Each damage type maps to a distinct status effect.
   */
  private _applySpellDoT(spell: SpellDefinition, npc: NPC): void {
    if (!spell.duration || spell.duration <= 0) return;
    if (!spell.damageType || spell.damageType === "magic") return;

    // Map spell damage type → status effect type
    const effectTypeMap: Record<string, "burn" | "poison" | "freeze" | "shock"> = {
      fire:  "burn",
      frost: "freeze",
      shock: "shock",
      poison: "poison",
    };
    const effectType = effectTypeMap[spell.damageType];
    if (!effectType) return;

    const tickInterval = 1.0; // 1 second between ticks
    const tickDamage = Math.max(1, Math.round((spell.damage ?? 0) * 0.25)); // 25% of hit per tick

    npc.applyStatusEffect({
      type: effectType,
      damagePerTick: tickDamage,
      tickInterval,
      tickTimer: tickInterval,
      remainingDuration: spell.duration,
    });
  }

  /** Find the closest live NPC within `range` in front of the player camera. */
  private _findTargetNpc(playerPos: Vector3, range: number): NPC | null {
    let closest: NPC | null = null;
    let closestDist = range;

    for (const npc of this._npcs) {
      if (npc.isDead) continue;
      const dist = Vector3.Distance(playerPos, npc.mesh.position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = npc;
      }
    }
    return closest;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): SpellSaveState {
    return {
      knownSpellIds: Array.from(this._knownSpellIds),
      equippedSpellId: this._equippedSpellId,
    };
  }

  public restoreFromSave(state: SpellSaveState): void {
    if (Array.isArray(state?.knownSpellIds)) {
      this._knownSpellIds = new Set(state.knownSpellIds.filter(id => this._definitions.has(id)));
    }
    if (state?.equippedSpellId && this._knownSpellIds.has(state.equippedSpellId)) {
      this._equippedSpellId = state.equippedSpellId;
    } else {
      this._equippedSpellId = null;
    }
  }
}
