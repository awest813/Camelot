// ── Biome definition ──────────────────────────────────────────────────────────

/**
 * Defines the characteristics of a named biome.
 *
 * Biomes are associated with {@link RegionSystem} regions via
 * {@link BiomeSystem.setRegionBiome} and drive encounter-table selection,
 * level scaling, and ambient mood for the game layer.
 */
export interface BiomeDefinition {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Optional author note / flavour description. */
  description?: string;
  /**
   * IDs of `SpawnGroupDraft` tables (from `SpawnCreatorSystem`) that apply
   * to this biome.  The game layer picks from these tables when spawning
   * encounters inside any region mapped to this biome.
   */
  spawnTableIds: string[];
  /**
   * Multiplier applied to the base encounter frequency while the player is
   * in a region with this biome.  1.0 is normal, < 1.0 is sparse, > 1.0
   * is dense.
   */
  encounterWeightMultiplier: number;
  /**
   * Minimum character level at which encounters from this biome become
   * active.  0 = no lower bound.
   */
  encounterLevelMin: number;
  /**
   * Maximum character level at which encounters from this biome remain
   * active.  0 = no upper bound.
   */
  encounterLevelMax: number;
  /**
   * Optional ambient mood tag (e.g. `"eerie"`, `"serene"`, `"hostile"`).
   * The game layer can use this to drive music, ambient audio, or visual
   * post-processing.
   */
  ambientMoodId?: string;
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Minimal save payload — only the dynamic region↔biome mapping is persisted;
 * biome definitions are treated as static game-data.
 */
export interface BiomeSaveState {
  /** Map of `regionId` → `biomeId`. */
  regionBiomes: Record<string, string>;
}

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Registry of biome definitions with region↔biome association helpers.
 *
 * Typical usage:
 * ```ts
 * const biomes = new BiomeSystem();
 * biomes.registerBiome({
 *   id: "darkwood",
 *   name: "Darkwood Forest",
 *   spawnTableIds: ["sg_wolves", "sg_bandits"],
 *   encounterWeightMultiplier: 1.4,
 *   encounterLevelMin: 3,
 *   encounterLevelMax: 12,
 *   ambientMoodId: "eerie",
 * });
 * biomes.setRegionBiome("region_north", "darkwood");
 *
 * // At encounter tick:
 * const tableIds = biomes.getSpawnTableIds("region_north");
 * const weight   = biomes.getEncounterWeightMultiplier("region_north");
 * ```
 */
export class BiomeSystem {
  private readonly _biomes  = new Map<string, BiomeDefinition>();
  /** regionId → biomeId */
  private readonly _regionBiomes = new Map<string, string>();

  // ── Biome CRUD ────────────────────────────────────────────────────────────

  /**
   * Register or replace a biome definition.
   * Silently replaces an existing biome with the same id.
   */
  public registerBiome(definition: BiomeDefinition): void {
    this._biomes.set(definition.id, { ...definition });
  }

  /**
   * Remove a biome.  Any regions mapped to this biome lose their mapping.
   * Safe to call with an unknown id.
   */
  public unregisterBiome(id: string): void {
    this._biomes.delete(id);
    // Remove all region→biome mappings that referenced this biome.
    for (const [regionId, biomeId] of this._regionBiomes) {
      if (biomeId === id) this._regionBiomes.delete(regionId);
    }
  }

  /** Returns the biome definition for `id`, or `undefined`. */
  public getBiome(id: string): BiomeDefinition | undefined {
    return this._biomes.get(id);
  }

  /** All registered biome definitions. */
  public get biomes(): BiomeDefinition[] {
    return Array.from(this._biomes.values());
  }

  // ── Region ↔ Biome association ────────────────────────────────────────────

  /**
   * Associate a region with a biome.
   * Silently overwrites any previous mapping for `regionId`.
   * Throws if `biomeId` does not refer to a registered biome.
   */
  public setRegionBiome(regionId: string, biomeId: string): void {
    if (!this._biomes.has(biomeId)) {
      throw new Error(`BiomeSystem: unknown biome "${biomeId}"`);
    }
    this._regionBiomes.set(regionId, biomeId);
  }

  /**
   * Remove the biome mapping for `regionId`.
   * Safe to call when no mapping exists.
   */
  public clearRegionBiome(regionId: string): void {
    this._regionBiomes.delete(regionId);
  }

  /** Returns the biome id mapped to `regionId`, or `undefined`. */
  public getBiomeIdForRegion(regionId: string): string | undefined {
    return this._regionBiomes.get(regionId);
  }

  /** Returns the biome definition for the region, or `undefined`. */
  public getBiomeForRegion(regionId: string): BiomeDefinition | undefined {
    const biomeId = this._regionBiomes.get(regionId);
    if (!biomeId) return undefined;
    return this._biomes.get(biomeId);
  }

  /**
   * Returns the ids of all regions currently mapped to `biomeId`.
   */
  public getRegionsForBiome(biomeId: string): string[] {
    const result: string[] = [];
    for (const [regionId, bid] of this._regionBiomes) {
      if (bid === biomeId) result.push(regionId);
    }
    return result;
  }

  // ── Encounter helpers ─────────────────────────────────────────────────────

  /**
   * Returns the spawn-table IDs for the biome associated with `regionId`.
   * Returns an empty array when the region has no biome mapping.
   */
  public getSpawnTableIds(regionId: string): string[] {
    return this.getBiomeForRegion(regionId)?.spawnTableIds ?? [];
  }

  /**
   * Returns the encounter weight multiplier for the biome associated with
   * `regionId`.  Returns `1.0` when the region has no biome mapping.
   */
  public getEncounterWeightMultiplier(regionId: string): number {
    return this.getBiomeForRegion(regionId)?.encounterWeightMultiplier ?? 1.0;
  }

  /**
   * Returns the encounter level range `{ min, max }` for the biome mapped
   * to `regionId`.  Returns `{ min: 0, max: 0 }` (no bounds) when no mapping
   * exists.
   */
  public getEncounterLevelRange(regionId: string): { min: number; max: number } {
    const biome = this.getBiomeForRegion(regionId);
    if (!biome) return { min: 0, max: 0 };
    return { min: biome.encounterLevelMin, max: biome.encounterLevelMax };
  }

  /**
   * Returns true when an encounter at `playerLevel` is within the level range
   * of the biome mapped to `regionId`.  Always returns true if the region has
   * no biome mapping (uncontrolled regions permit all encounters).
   */
  public isLevelInRange(regionId: string, playerLevel: number): boolean {
    const biome = this.getBiomeForRegion(regionId);
    if (!biome) return true;
    const { encounterLevelMin: min, encounterLevelMax: max } = biome;
    if (min > 0 && playerLevel < min) return false;
    if (max > 0 && playerLevel > max) return false;
    return true;
  }

  /**
   * Returns the ambient mood id for the biome mapped to `regionId`, or
   * `undefined` when the region has no biome mapping or the biome has no
   * mood.
   */
  public getAmbientMoodId(regionId: string): string | undefined {
    return this.getBiomeForRegion(regionId)?.ambientMoodId;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /** Capture the current region↔biome mapping for save persistence. */
  public getSaveState(): BiomeSaveState {
    const regionBiomes: Record<string, string> = {};
    for (const [regionId, biomeId] of this._regionBiomes) {
      regionBiomes[regionId] = biomeId;
    }
    return { regionBiomes };
  }

  /**
   * Restore region↔biome mapping from a saved state.
   * Only mappings where the biome id is still registered are restored;
   * stale references are silently dropped.
   */
  public restoreFromSave(state: BiomeSaveState): void {
    this._regionBiomes.clear();
    for (const [regionId, biomeId] of Object.entries(state.regionBiomes)) {
      if (this._biomes.has(biomeId)) {
        this._regionBiomes.set(regionId, biomeId);
      }
    }
  }

  /** Remove all biomes and region mappings. */
  public clear(): void {
    this._biomes.clear();
    this._regionBiomes.clear();
  }
}
