import { FRAMEWORK_SAVE_SCHEMA_VERSION, FrameworkSaveFile } from "./save-types";
import { applySaveMigrations, DEFAULT_MIGRATIONS, SaveMigration } from "./migrations";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MigrationValidationResult {
  /** True when every version from 0 up to `targetVersion - 1` has a migration. */
  valid: boolean;
  /**
   * List of version numbers for which a migration is missing.
   * Empty when `valid` is true.
   */
  gaps: number[];
  /** The target version this validation ran against. */
  targetVersion: number;
}

export interface MigrationChainEntry {
  fromVersion: number;
  toVersion: number;
  migration: SaveMigration;
}

// ── SaveMigrationRegistry ─────────────────────────────────────────────────────

/**
 * Registry for versioned save-file migrations.
 *
 * Provides a clean, runtime-extensible alternative to the static
 * `DEFAULT_MIGRATIONS` object so host games can register their own
 * migration steps without monkey-patching the framework defaults.
 *
 * **Typical usage**
 * ```ts
 * const registry = SaveMigrationRegistry.withDefaults();
 *
 * // Host game adds its own migration from v1 → v2
 * registry.register(1, (input) => {
 *   const save = input as FrameworkSaveFile;
 *   // …transform save…
 *   return { ...save, schemaVersion: 2 };
 * });
 *
 * // Validate the chain before applying
 * const check = registry.validate(2);
 * if (!check.valid) {
 *   throw new Error(`Missing migrations for versions: ${check.gaps.join(", ")}`);
 * }
 *
 * // Apply all necessary migrations
 * const migrated = registry.apply(rawSaveData, 2);
 * ```
 *
 * **Integration with SaveEngine**
 * Pass the registry to `SaveEngine` via its constructor so it uses the
 * extended chain for all serialize/deserialize operations:
 * ```ts
 * const engine = new SaveEngine(storage, "key", registry);
 * ```
 */
export class SaveMigrationRegistry {
  private _migrations: Map<number, SaveMigration> = new Map();

  /**
   * Create a registry pre-loaded with the framework default migrations
   * (currently only the v0 → v1 migration).
   */
  public static withDefaults(): SaveMigrationRegistry {
    const registry = new SaveMigrationRegistry();
    for (const [version, migration] of Object.entries(DEFAULT_MIGRATIONS)) {
      registry.register(Number(version), migration);
    }
    return registry;
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a migration that transforms a save file from `fromVersion` to
   * `fromVersion + 1`.
   *
   * Re-registering an existing version overwrites the previous migration.
   *
   * @param fromVersion - The schema version this migration applies to.
   * @param migration   - A pure function that accepts a raw/unknown save value
   *   and returns the transformed value at `fromVersion + 1`.
   */
  public register(fromVersion: number, migration: SaveMigration): this {
    if (!Number.isFinite(fromVersion) || fromVersion < 0) {
      throw new Error(`fromVersion must be a non-negative integer, got ${fromVersion}.`);
    }
    this._migrations.set(Math.floor(fromVersion), migration);
    return this;
  }

  /**
   * Remove a previously registered migration for `fromVersion`.
   * No-op if no migration exists for that version.
   */
  public unregister(fromVersion: number): void {
    this._migrations.delete(Math.floor(fromVersion));
  }

  /** True if a migration is registered for `fromVersion`. */
  public has(fromVersion: number): boolean {
    return this._migrations.has(Math.floor(fromVersion));
  }

  /**
   * Return the migration function for `fromVersion`, or `undefined` if none
   * is registered.
   */
  public get(fromVersion: number): SaveMigration | undefined {
    return this._migrations.get(Math.floor(fromVersion));
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Check that there are no gaps in the migration chain from version 0 up to
   * `targetVersion - 1`.
   *
   * @param targetVersion - Defaults to `FRAMEWORK_SAVE_SCHEMA_VERSION`.
   */
  public validate(targetVersion: number = FRAMEWORK_SAVE_SCHEMA_VERSION): MigrationValidationResult {
    const gaps: number[] = [];
    for (let v = 0; v < targetVersion; v++) {
      if (!this._migrations.has(v)) gaps.push(v);
    }
    return { valid: gaps.length === 0, gaps, targetVersion };
  }

  /**
   * Build an ordered list of migration entries for the path from `from` to
   * `to`.  Throws if any step in the chain is missing a registered migration.
   */
  public buildChain(from: number, to: number): MigrationChainEntry[] {
    if (from >= to) return [];
    const chain: MigrationChainEntry[] = [];
    for (let v = from; v < to; v++) {
      const migration = this._migrations.get(v);
      if (!migration) {
        throw new Error(`No migration registered for version ${v} → ${v + 1}.`);
      }
      chain.push({ fromVersion: v, toVersion: v + 1, migration });
    }
    return chain;
  }

  // ── Application ───────────────────────────────────────────────────────────

  /**
   * Apply all migrations needed to bring `input` up to `targetVersion`.
   *
   * Delegates to the framework `applySaveMigrations` function using this
   * registry's migrations as the migration table.
   *
   * @param input         - Raw (possibly un-migrated) save data.
   * @param targetVersion - Defaults to `FRAMEWORK_SAVE_SCHEMA_VERSION`.
   */
  public apply(input: unknown, targetVersion: number = FRAMEWORK_SAVE_SCHEMA_VERSION): FrameworkSaveFile {
    const migrationRecord: Record<number, SaveMigration> = {};
    for (const [v, fn] of this._migrations.entries()) {
      migrationRecord[v] = fn;
    }
    return applySaveMigrations(input, targetVersion, migrationRecord);
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  /**
   * Return an array of all registered `fromVersion` values, sorted ascending.
   */
  public registeredVersions(): number[] {
    return Array.from(this._migrations.keys()).sort((a, b) => a - b);
  }

  /** Total number of registered migrations. */
  public get size(): number {
    return this._migrations.size;
  }
}
