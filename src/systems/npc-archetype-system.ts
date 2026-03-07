import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { NPC } from "../entities/npc";
import type { NpcArchetypeDefinition } from "../framework/content/content-types";

/**
 * Data-driven NPC factory.
 *
 * Usage:
 *   1. Register archetype definitions via `registerArchetype()` (or pass a
 *      bundle of them to `registerAll()`).
 *   2. Call `spawnNpc(archetypeId, scene, position)` to create a fully-configured
 *      NPC instance.
 *
 * The spawned NPC is not added to any system automatically — the caller
 * is responsible for registering it with ScheduleSystem, CombatSystem, etc.
 */
export class NpcArchetypeSystem {
  private _archetypes: Map<string, NpcArchetypeDefinition> = new Map();

  // ── Registry ──────────────────────────────────────────────────────────────

  public registerArchetype(def: NpcArchetypeDefinition): void {
    this._archetypes.set(def.id, def);
  }

  public registerAll(defs: NpcArchetypeDefinition[]): void {
    for (const def of defs) {
      this._archetypes.set(def.id, def);
    }
  }

  public getArchetype(id: string): NpcArchetypeDefinition | undefined {
    return this._archetypes.get(id);
  }

  public get registeredIds(): string[] {
    return Array.from(this._archetypes.keys());
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  /**
   * Instantiate an NPC from a registered archetype definition.
   *
   * Applies:
   *  - health and XP reward (scaled by `levelOverride` if provided)
   *  - faction membership and guard flag
   *  - loot table id
   *  - hostility / aggression flag
   *  - combat range adjustments based on role
   *
   * Returns null if the archetype id is not registered.
   */
  public spawnNpc(
    archetypeId: string,
    scene: Scene,
    position: Vector3,
    levelOverride?: number,
  ): NPC | null {
    const def = this._archetypes.get(archetypeId);
    if (!def) return null;

    const effectiveLevel = levelOverride ?? def.level ?? 1;

    // Scale base stats by level
    const scaledHealth = Math.round(def.baseHealth * (1 + (effectiveLevel - 1) * 0.15));
    const scaledXp     = Math.round((def.level ?? 1) * 25 * (1 + (effectiveLevel - 1) * 0.1));

    // Use archetype name as the mesh name; append a unique suffix so multiple
    // instances of the same archetype don't share the same name.
    const suffix = Math.floor(Math.random() * 100000);
    const npcName = `${def.name}_${suffix}`;

    const npc = new NPC(scene, position, npcName);

    npc.maxHealth = scaledHealth;
    npc.health    = scaledHealth;
    npc.xpReward  = scaledXp;

    // Faction & guard role
    npc.factionId = def.factionId ?? null;
    npc.isGuard   = def.role === "guard";

    // Loot table
    npc.lootTableId = def.lootTableId ?? null;

    // Hostility
    if (def.isHostile) {
      npc.isAggressive = true;
    }

    // Role-specific combat tuning
    if (def.role === "boss") {
      npc.aggroRange   = 18;
      npc.attackRange  = 3;
      npc.attackDamage = 20;
      npc.attackCooldown = 1.5;
    } else if (def.role === "enemy") {
      npc.aggroRange = 12;
    } else if (def.role === "guard") {
      npc.aggroRange = 15;
      npc.attackDamage = 12;
    }

    return npc;
  }
}
