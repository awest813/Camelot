/**
 * OffscreenSimulationSystem — Simulates NPC state while they are outside the
 * active cell / chunk radius (unloaded from the Babylon scene).
 *
 * This is a **headless core** system — it has zero Babylon dependencies and
 * operates purely on schedule / time data.  It answers the question: "What has
 * this NPC been doing while the player was elsewhere?"
 *
 * Responsibilities:
 *   - Track which NPCs are currently offscreen (registered but not in the
 *     active loaded set).
 *   - Advance each offscreen NPC's schedule state according to elapsed game time.
 *   - Accumulate offscreen economy ticks (merchant gold regen, crafting).
 *   - Provide a reconciled snapshot when an NPC comes back into view so the
 *     world streamer can place them in the correct schedule-driven position and
 *     animation state.
 *
 * Non-goals (kept in other systems):
 *   - Pathfinding or physics — offscreen NPCs don't need it.
 *   - Combat — offscreen NPCs are not engaged with the player.
 *   - Visual updates — no meshes exist for offscreen entities.
 *
 * Usage:
 * ```ts
 * const offscreen = new OffscreenSimulationSystem();
 * offscreen.register("guard_01", { scheduleBlocks, homePosition, ... });
 * offscreen.advanceTime(72);  // 72 game-hours passed (fast travel)
 * const state = offscreen.getState("guard_01");
 * // → { currentBehavior: "patrol", position: ..., ... }
 * offscreen.unregister("guard_01");  // NPC is back in view
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Schedule-like behavior descriptor used for offscreen NPCs. */
export type OffscreenBehavior = "patrol" | "work" | "sleep" | "wander" | "idle";

/** Position-like struct (matching framework conventions, no Babylon). */
export interface OffscreenPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * A single time-block in an NPC's daily schedule, mirroring ScheduleBlock
 * from the entity layer but without Babylon Vector3 references.
 */
export interface OffscreenScheduleBlock {
  /** Hour of day this block starts (0–23). */
  startHour: number;
  /** Behavior during this block. */
  behavior: OffscreenBehavior;
  /** Optional anchor position for this block (e.g. work station, bed). */
  anchorPosition?: OffscreenPosition;
}

/**
 * Registration data for an NPC entering offscreen simulation.
 * Enough state to replay schedule progression without the full NPC entity.
 */
export interface OffscreenNpcEntry {
  /** Unique NPC identifier (usually mesh name). */
  id: string;
  /** Daily schedule blocks (must cover 24h or fallback to "idle"). */
  scheduleBlocks: OffscreenScheduleBlock[];
  /** Position at the time the NPC went offscreen. */
  lastKnownPosition: OffscreenPosition;
  /** NPC home position (for sleep blocks). */
  homePosition?: OffscreenPosition;
  /** NPC work position (for work blocks). */
  workPosition?: OffscreenPosition;
  /** Current health (tracked for offscreen healing). */
  health: number;
  /** Maximum health. */
  maxHealth: number;
  /** Whether the NPC is dead (dead NPCs are not simulated). */
  isDead: boolean;
  /** Optional merchant ID — if set, offscreen gold regeneration applies. */
  merchantId?: string;
  /** Current merchant gold (regenerated offscreen). */
  merchantGold?: number;
  /** Max merchant gold (cap for regeneration). */
  merchantMaxGold?: number;
}

/** The reconciled state of an offscreen NPC at a given game time. */
export interface OffscreenNpcState {
  id: string;
  /** Current schedule behavior at the queried game time. */
  currentBehavior: OffscreenBehavior;
  /** Expected position based on schedule anchor. */
  expectedPosition: OffscreenPosition;
  /** Health (may have regenerated while offscreen). */
  health: number;
  /** Whether the NPC is sleeping right now. */
  isSleeping: boolean;
  /** Accumulated offscreen hours since registration. */
  offscreenHours: number;
  /** Merchant gold (if applicable). */
  merchantGold?: number;
}

/** Snapshot for save/restore. */
export interface OffscreenSimulationSnapshot {
  entries: OffscreenNpcEntry[];
  /** Game-time hour at which the snapshot was taken. */
  lastGameHour: number;
  /** Total accumulated offscreen hours per NPC. */
  accumulatedHours: Record<string, number>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Health regeneration per game-hour while offscreen and not dead. */
const OFFSCREEN_HEALTH_REGEN_PER_HOUR = 5;

/** Gold regeneration per game-hour for merchant NPCs. */
const OFFSCREEN_GOLD_REGEN_PER_HOUR = 2;

// ── System ─────────────────────────────────────────────────────────────────────

export class OffscreenSimulationSystem {
  private _entries = new Map<string, OffscreenNpcEntry>();
  private _accumulatedHours = new Map<string, number>();
  private _lastGameHour = 0;

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /** Fired when an NPC's offscreen behavior changes (e.g. patrol → sleep). */
  public onBehaviorChange: ((id: string, behavior: OffscreenBehavior) => void) | null = null;

  /** Fired when a merchant NPC's gold fully regenerates offscreen. */
  public onMerchantRestock: ((id: string, newGold: number) => void) | null = null;

  // ── Registration ──────────────────────────────────────────────────────────

  /** Register an NPC for offscreen simulation. */
  register(id: string, entry: Omit<OffscreenNpcEntry, "id">): void {
    this._entries.set(id, { ...entry, id });
    if (!this._accumulatedHours.has(id)) {
      this._accumulatedHours.set(id, 0);
    }
  }

  /** Remove an NPC from offscreen simulation (it is back in view). */
  unregister(id: string): OffscreenNpcState | null {
    const state = this.getState(id);
    this._entries.delete(id);
    this._accumulatedHours.delete(id);
    return state;
  }

  /** Whether a given NPC is currently being simulated offscreen. */
  has(id: string): boolean {
    return this._entries.has(id);
  }

  /** Number of NPCs currently simulated offscreen. */
  get count(): number {
    return this._entries.size;
  }

  /** All registered offscreen NPC ids. */
  get registeredIds(): string[] {
    return [...this._entries.keys()];
  }

  // ── Time advancement ──────────────────────────────────────────────────────

  /**
   * Advance all offscreen NPCs by `hours` game-hours.
   * Call this when the game time jumps (fast travel, waiting, sleeping, etc.).
   */
  advanceTime(hours: number): void {
    if (hours <= 0) return;

    for (const [id, entry] of this._entries) {
      if (entry.isDead) continue;

      // Health regen
      const healAmount = OFFSCREEN_HEALTH_REGEN_PER_HOUR * hours;
      entry.health = Math.min(entry.maxHealth, entry.health + healAmount);

      // Merchant gold regen
      if (entry.merchantId != null && entry.merchantGold != null && entry.merchantMaxGold != null) {
        const goldBefore = entry.merchantGold;
        entry.merchantGold = Math.min(
          entry.merchantMaxGold,
          entry.merchantGold + OFFSCREEN_GOLD_REGEN_PER_HOUR * hours,
        );
        if (goldBefore < entry.merchantMaxGold && entry.merchantGold >= entry.merchantMaxGold) {
          this.onMerchantRestock?.(id, entry.merchantGold);
        }
      }

      // Accumulate hours
      const prev = this._accumulatedHours.get(id) ?? 0;
      this._accumulatedHours.set(id, prev + hours);
    }

    this._lastGameHour = (this._lastGameHour + hours) % 24;
  }

  /**
   * Set the current game hour (0–23) without advancing offscreen state.
   * Used on initial registration or save restore.
   */
  setGameHour(hour: number): void {
    this._lastGameHour = ((hour % 24) + 24) % 24;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /**
   * Get the reconciled offscreen state for an NPC at the current game hour.
   * Returns null if the NPC is not registered.
   */
  getState(id: string): OffscreenNpcState | null {
    const entry = this._entries.get(id);
    if (!entry) return null;

    const behavior = this._resolveBehavior(entry, this._lastGameHour);
    const expectedPosition = this._resolvePosition(entry, behavior);
    const isSleeping = behavior === "sleep";

    return {
      id,
      currentBehavior: behavior,
      expectedPosition,
      health: entry.health,
      isSleeping,
      offscreenHours: this._accumulatedHours.get(id) ?? 0,
      merchantGold: entry.merchantGold,
    };
  }

  /** Get the raw entry for an NPC (for inspection / debugging). */
  getEntry(id: string): Readonly<OffscreenNpcEntry> | null {
    return this._entries.get(id) ?? null;
  }

  // ── Snapshot / Restore ────────────────────────────────────────────────────

  getSnapshot(): OffscreenSimulationSnapshot {
    const entries: OffscreenNpcEntry[] = [];
    for (const entry of this._entries.values()) {
      entries.push({ ...entry });
    }
    const accumulatedHours: Record<string, number> = {};
    for (const [id, hours] of this._accumulatedHours) {
      accumulatedHours[id] = hours;
    }
    return { entries, lastGameHour: this._lastGameHour, accumulatedHours };
  }

  restoreSnapshot(snap: OffscreenSimulationSnapshot): void {
    this._entries.clear();
    this._accumulatedHours.clear();
    this._lastGameHour = snap.lastGameHour;
    for (const entry of snap.entries) {
      this._entries.set(entry.id, { ...entry });
    }
    for (const [id, hours] of Object.entries(snap.accumulatedHours)) {
      this._accumulatedHours.set(id, hours);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _resolveBehavior(entry: OffscreenNpcEntry, hour: number): OffscreenBehavior {
    if (entry.isDead) return "idle";
    if (entry.scheduleBlocks.length === 0) return "idle";

    // Find the schedule block whose startHour is the latest ≤ current hour.
    // Handles midnight wrap-around.
    let best: OffscreenScheduleBlock | null = null;
    let bestDist = Infinity;
    for (const block of entry.scheduleBlocks) {
      const hoursDelta = ((hour - block.startHour) % 24 + 24) % 24;
      if (hoursDelta < bestDist) {
        bestDist = hoursDelta;
        best = block;
      }
    }
    return best?.behavior ?? "idle";
  }

  private _resolvePosition(entry: OffscreenNpcEntry, behavior: OffscreenBehavior): OffscreenPosition {
    switch (behavior) {
      case "sleep":
        return entry.homePosition ?? entry.lastKnownPosition;
      case "work":
        return entry.workPosition ?? entry.lastKnownPosition;
      case "patrol":
      case "wander":
      case "idle":
      default:
        return entry.lastKnownPosition;
    }
  }
}
