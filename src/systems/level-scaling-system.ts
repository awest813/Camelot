import type { NPC } from "../entities/npc";

/**
 * LevelScalingSystem — Oblivion-style enemy scaling.
 *
 * In Oblivion, creatures and NPCs scale with the player's level so that the
 * world remains challenging throughout the playthrough.  This system mirrors
 * that behaviour by computing a scale factor from the player's current level
 * and applying it to a freshly-spawned NPC's stats.
 *
 * Scaling formula:
 *   scaleFactor = clamp(0.8 + playerLevel × SCALE_PER_LEVEL, MIN_SCALE, MAX_SCALE)
 *
 * Defaults:
 *   SCALE_PER_LEVEL = 0.1   → level 1  → ×0.9, level 5  → ×1.3, level 10 → ×1.8
 *   MIN_SCALE       = 0.75  → NPCs are never weaker than 75 % of their base stats
 *   MAX_SCALE       = 3.0   → caps at 300 % so late-game NPCs don't become immortal
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.levelScalingSystem = new LevelScalingSystem();
 * // After spawning an NPC:
 * this.levelScalingSystem.scaleNPC(npc, this.player.level);
 * ```
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Factor added per player level above 0. */
export const SCALE_PER_LEVEL = 0.1;
/** Minimum allowed scale (NPCs are never below 75 % of base stats). */
export const MIN_SCALE = 0.75;
/** Maximum allowed scale (caps at 300 % so the game stays completable). */
export const MAX_SCALE = 3.0;
/** Base offset before per-level scaling begins (gives level-1 NPCs 90 % stats). */
const BASE_OFFSET = 0.8;

// ── System ────────────────────────────────────────────────────────────────────

export class LevelScalingSystem {
  /**
   * Compute the scale factor for a given player level.
   * Exposed as a static helper so callers can preview the factor without
   * creating an instance.
   */
  public static computeScale(playerLevel: number): number {
    const raw = BASE_OFFSET + Math.max(1, playerLevel) * SCALE_PER_LEVEL;
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw));
  }

  /**
   * Apply player-level-based scaling to an NPC's stats in-place.
   *
   * Affected stats:
   *   - `health` and `maxHealth` – scaled by `factor`
   *   - `xpReward`               – scaled by `factor` (higher-level enemies give more XP)
   *
   * The NPC's current health is set to the new maxHealth so freshly-spawned
   * enemies start at full HP.
   *
   * @param npc         The NPC to scale (modified in-place).
   * @param playerLevel The player's current level.
   */
  public scaleNPC(npc: NPC, playerLevel: number): void {
    const factor = LevelScalingSystem.computeScale(playerLevel);

    const newMaxHealth = Math.max(1, Math.round(npc.maxHealth * factor));
    npc.maxHealth = newMaxHealth;
    npc.health    = newMaxHealth;
    npc.xpReward  = Math.max(1, Math.round(npc.xpReward * factor));
  }
}
