/**
 * VillageRaidSystem — bandits occasionally raid the village the player is in.
 *
 * Pure rules and state (no Babylon). The game asks once per in-game hour
 * whether a raid starts ({@link VillageRaidSystem.shouldRaid}), spawns the
 * raiders, reports their deaths ({@link VillageRaidSystem.onKill}), and ends
 * the raid early if the player leaves ({@link VillageRaidSystem.abandon}).
 *
 * Only the per-village cooldowns are saved; a raid in progress isn't, because
 * the raiders aren't either.
 */

/** Hours a village is left alone after a raid. */
export const RAID_COOLDOWN_HOURS = 72;
/** Chance per in-game hour, by day. */
export const RAID_CHANCE = 0.08;
/** Night (20:00–05:00) raids are this much more likely. */
export const RAID_NIGHT_MULTIPLIER = 1.8;
/** Raids only start once the player has this level. */
export const RAID_MIN_LEVEL = 2;
/** Raids never start in the first hours of a game. */
export const RAID_GRACE_HOURS = 6;

export interface ActiveRaid {
  villageId: string;
  villageName: string;
  /** Names of raiders still standing. */
  remaining: Set<string>;
  total: number;
  startedAt: number;
}

export interface RaidOutcome {
  villageId: string;
  villageName: string;
  total: number;
  rewardGold: number;
  rewardXp: number;
}

export interface VillageRaidSaveState {
  lastRaidAt: Record<string, number>;
}

/** How many raiders come, by player level (2 … 5). */
export function raiderCount(playerLevel: number): number {
  return Math.max(2, Math.min(5, 2 + Math.floor(playerLevel / 3)));
}

export function isNightHour(hour: number): boolean {
  return hour >= 20 || hour < 5;
}

export class VillageRaidSystem {
  private readonly _lastRaidAt = new Map<string, number>();
  private _active: ActiveRaid | null = null;

  public get active(): ActiveRaid | null {
    return this._active;
  }

  /**
   * Whether a raid starts on the village now. `rand` is a 0..1 roll (injected
   * for tests). Never while another raid is on.
   */
  public shouldRaid(opts: {
    villageId: string;
    elapsedHours: number;
    hourOfDay: number;
    playerLevel: number;
    rand: number;
  }): boolean {
    if (this._active) return false;
    if (opts.playerLevel < RAID_MIN_LEVEL) return false;
    if (opts.elapsedHours < RAID_GRACE_HOURS) return false;
    const last = this._lastRaidAt.get(opts.villageId);
    if (last !== undefined && opts.elapsedHours - last < RAID_COOLDOWN_HOURS) return false;
    const chance = RAID_CHANCE * (isNightHour(opts.hourOfDay) ? RAID_NIGHT_MULTIPLIER : 1);
    return opts.rand < chance;
  }

  /** Start a raid with the given raiders (their NPC names). */
  public start(villageId: string, villageName: string, raiderNames: string[], elapsedHours: number): ActiveRaid {
    this._lastRaidAt.set(villageId, elapsedHours);
    const remaining = new Set(raiderNames);
    this._active = {
      villageId,
      villageName,
      remaining,
      total: remaining.size,
      startedAt: elapsedHours,
    };
    return this._active;
  }

  /**
   * Count a death. Returns the outcome when it was the last raider, otherwise
   * null (also for anyone who isn't a raider).
   */
  public onKill(npcName: string): RaidOutcome | null {
    const raid = this._active;
    if (!raid || !raid.remaining.delete(npcName)) return null;
    if (raid.remaining.size > 0) return null;
    this._active = null;
    return {
      villageId: raid.villageId,
      villageName: raid.villageName,
      total: raid.total,
      rewardGold: 35 * raid.total,
      rewardXp: 25 * raid.total,
    };
  }

  /** The player left (or the village unloaded): the raid ends without a reward. */
  public abandon(): ActiveRaid | null {
    const raid = this._active;
    this._active = null;
    return raid;
  }

  public getSaveState(): VillageRaidSaveState {
    return { lastRaidAt: Object.fromEntries(this._lastRaidAt) };
  }

  public restoreFromSave(state: VillageRaidSaveState | undefined): void {
    this._lastRaidAt.clear();
    this._active = null;
    for (const [k, v] of Object.entries(state?.lastRaidAt ?? {})) {
      if (typeof v === "number") this._lastRaidAt.set(k, v);
    }
  }
}
