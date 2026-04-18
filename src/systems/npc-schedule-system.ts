import type { NPC, ScheduleBlock } from "../entities/npc";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A named, reusable collection of ScheduleBlocks that can be registered by id
 * and applied to any NPC via `NpcScheduleSystem.applySchedule()`.
 *
 * Linking an archetype to a schedule:
 *   Set `NpcArchetypeDefinition.scheduleId` to the definition id, then attach
 *   an `NpcScheduleSystem` instance to `NpcArchetypeSystem.scheduleSystem`.
 *   The schedule is applied automatically when `spawnNpc()` is called.
 */
export interface NpcScheduleDefinition {
  /** Unique identifier used as the lookup key (e.g. `"sched_guard"`). */
  id: string;
  /** Human-readable label shown in editor tooling. */
  name?: string;
  /** Optional description of this schedule's intent. */
  description?: string;
  /**
   * Ordered list of time-of-day behavior blocks.
   * Blocks may carry an optional `anchorPosition`:
   *   - `"work"` blocks: position becomes `npc.workPosition` (when not already set).
   *   - `"sleep"` blocks: position becomes `npc.homePosition` (when not already set).
   */
  blocks: ScheduleBlock[];
}

// ── Built-in schedule IDs ─────────────────────────────────────────────────────

/** Patrols 06:00–22:00, sleeps 22:00–06:00. */
export const SCHED_GUARD     = "sched_guard";
/** Works 08:00–18:00, wanders 18:00–22:00, sleeps 22:00–08:00. */
export const SCHED_VILLAGER  = "sched_villager";
/** Works 08:00–23:00, sleeps 23:00–08:00. */
export const SCHED_INNKEEPER = "sched_innkeeper";
/** Works 08:00–20:00, wanders 20:00–22:00, sleeps 22:00–08:00. */
export const SCHED_MERCHANT  = "sched_merchant";

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Registry for named NPC schedule definitions.
 *
 * Usage:
 *   1. Instantiate (built-in presets registered automatically).
 *   2. Optionally `registerSchedule()` custom definitions.
 *   3. Assign to `NpcArchetypeSystem.scheduleSystem` — archetypes whose
 *      `scheduleId` field is set will have their schedule applied on spawn.
 *   4. Call `applySchedule(npc, id)` directly to configure an NPC at runtime.
 *
 * `applySchedule()` effects:
 *   - Replaces `npc.scheduleBlocks` with a copy of the definition's blocks.
 *   - For each block that carries an `anchorPosition`:
 *       • `"work"`  block → sets `npc.workPosition`  (only if not already set).
 *       • `"sleep"` block → sets `npc.homePosition`  (only if not already set).
 *     This means the first encountered anchor for each category wins; any
 *     position already configured on the NPC entity is preserved.
 */
export class NpcScheduleSystem {
  private _definitions: Map<string, NpcScheduleDefinition> = new Map();

  /**
   * @param registerBuiltins - When `true` (default), the four built-in
   *   schedule presets are registered automatically.  Pass `false` to start
   *   with an empty registry (useful for isolated unit tests).
   */
  constructor(registerBuiltins: boolean = true) {
    if (registerBuiltins) {
      this._registerBuiltins();
    }
  }

  // ── Registry ──────────────────────────────────────────────────────────────

  /**
   * Register a schedule definition.
   * If a definition with the same id already exists it is replaced.
   */
  public registerSchedule(def: NpcScheduleDefinition): void {
    this._definitions.set(def.id, def);
  }

  /**
   * Remove a schedule definition by id.
   * No-op when the id is not registered.
   */
  public removeSchedule(id: string): void {
    this._definitions.delete(id);
  }

  /**
   * Retrieve a registered schedule definition, or `undefined` if unknown.
   */
  public getSchedule(id: string): NpcScheduleDefinition | undefined {
    return this._definitions.get(id);
  }

  /** Array of all registered definition ids. */
  public get registeredIds(): string[] {
    return Array.from(this._definitions.keys());
  }

  // ── Application ───────────────────────────────────────────────────────────

  /**
   * Apply the named schedule to an NPC.
   *
   * - Replaces `npc.scheduleBlocks` with a shallow copy of the definition's blocks.
   * - For blocks that carry `anchorPosition`:
   *     • `"work"`  → sets `npc.workPosition`  if it is currently `null`.
   *     • `"sleep"` → sets `npc.homePosition`  if it is currently `null`.
   *
   * @returns `true` if the schedule was found and applied; `false` if the
   *   id is not registered (the NPC is left unmodified in that case).
   */
  public applySchedule(npc: NPC, scheduleId: string): boolean {
    const def = this._definitions.get(scheduleId);
    if (!def) return false;

    npc.scheduleBlocks = [...def.blocks];

    for (const block of def.blocks) {
      if (!block.anchorPosition) continue;

      if (block.behavior === "work" && npc.workPosition === null) {
        npc.workPosition = block.anchorPosition.clone();
      } else if (block.behavior === "sleep" && npc.homePosition === null) {
        npc.homePosition = block.anchorPosition.clone();
      }
    }

    return true;
  }

  // ── Built-ins ─────────────────────────────────────────────────────────────

  private _registerBuiltins(): void {
    this.registerSchedule({
      id: SCHED_GUARD,
      name: "Guard",
      description: "Patrols during daylight hours and sleeps at night.",
      blocks: [
        { startHour: 6,  endHour: 22, behavior: "patrol" },
        { startHour: 22, endHour: 6,  behavior: "sleep"  },
      ],
    });

    this.registerSchedule({
      id: SCHED_VILLAGER,
      name: "Villager",
      description: "Works during the day, wanders in the evening, sleeps at night.",
      blocks: [
        { startHour: 8,  endHour: 18, behavior: "work"   },
        { startHour: 18, endHour: 22, behavior: "wander" },
        { startHour: 22, endHour: 8,  behavior: "sleep"  },
      ],
    });

    this.registerSchedule({
      id: SCHED_INNKEEPER,
      name: "Innkeeper",
      description: "Works long hours at the inn, sleeps late at night.",
      blocks: [
        { startHour: 8,  endHour: 23, behavior: "work"  },
        { startHour: 23, endHour: 8,  behavior: "sleep" },
      ],
    });

    this.registerSchedule({
      id: SCHED_MERCHANT,
      name: "Merchant",
      description: "Tends the shop during the day, wanders in the evening, sleeps at night.",
      blocks: [
        { startHour: 8,  endHour: 20, behavior: "work"   },
        { startHour: 20, endHour: 22, behavior: "wander" },
        { startHour: 22, endHour: 8,  behavior: "sleep"  },
      ],
    });
  }
}
