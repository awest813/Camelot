import { FRAMEWORK_SAVE_SCHEMA_VERSION, FrameworkSaveFile } from "./save-types";
import { applySaveMigrations, DEFAULT_MIGRATIONS, SaveMigration } from "./migrations";

/**
 * SaveMigrationRegistry — structured, composable save-migration management.
 *
 * Provides a cleaner developer-facing API for registering, validating, and
 * applying versioned save-data migrations compared to working with the raw
 * `DEFAULT_MIGRATIONS` dictionary.
 *
 * Usage (typical):
 *   const registry = SaveMigrationRegistry.withDefaults();
 *   registry.register(1, migrateV1ToV2);
 *
 *   const migrated = registry.apply(rawParsedJson);
 *
 * Usage (custom chain):
 *   const registry = new SaveMigrationRegistry();
 *   registry.register(0, migrateV0ToV1);
 *   console.assert(registry.validate(0, 1));
 *   const migrated = registry.apply(legacyData, 1);
 */
export class SaveMigrationRegistry {
  private readonly _migrations = new Map<number, SaveMigration>();

  /**
   * Register a migration that upgrades a save from `fromVersion` to
   * `fromVersion + 1`.  Calling `register` twice for the same `fromVersion`
   * replaces the previous entry.
   */
  register(fromVersion: number, migration: SaveMigration): this {
    if (!Number.isInteger(fromVersion) || fromVersion < 0) {
      throw new RangeError(`fromVersion must be a non-negative integer, got ${fromVersion}.`);
    }
    this._migrations.set(fromVersion, migration);
    return this;
  }

  /**
   * Returns `true` when every step from `minVersion` up to (but not including)
   * `targetVersion` has a registered migration, i.e. the chain is gapless.
   */
  validate(minVersion: number, targetVersion: number): boolean {
    for (let v = minVersion; v < targetVersion; v++) {
      if (!this._migrations.has(v)) return false;
    }
    return true;
  }

  /**
   * Returns the ordered list of migration functions that would be applied to
   * take a save from `minVersion` to `targetVersion`.
   *
   * @throws {Error} if any step in the range is missing a registered migration.
   */
  buildChain(minVersion: number, targetVersion: number): SaveMigration[] {
    const chain: SaveMigration[] = [];
    for (let v = minVersion; v < targetVersion; v++) {
      const migration = this._migrations.get(v);
      if (!migration) {
        throw new Error(
          `SaveMigrationRegistry: missing migration for version ${v} → ${v + 1}.`
        );
      }
      chain.push(migration);
    }
    return chain;
  }

  /**
   * Apply all necessary migrations to bring `input` up to `targetVersion`.
   *
   * Delegates to `applySaveMigrations` using this registry's entries so that
   * the same normalization and version-detection logic applies.
   *
   * @param input         Parsed (but un-migrated) save object.
   * @param targetVersion Target schema version; defaults to
   *                      `FRAMEWORK_SAVE_SCHEMA_VERSION`.
   */
  apply(
    input: unknown,
    targetVersion: number = FRAMEWORK_SAVE_SCHEMA_VERSION
  ): FrameworkSaveFile {
    const migrationsRecord: Record<number, SaveMigration> = {};
    for (const [version, migration] of this._migrations.entries()) {
      migrationsRecord[version] = migration;
    }
    return applySaveMigrations(input, targetVersion, migrationsRecord);
  }

  /**
   * The number of migrations currently registered.
   */
  get size(): number {
    return this._migrations.size;
  }

  /**
   * Create a registry pre-loaded with the built-in default migrations.
   * Use this as a base and call `register()` to add project-specific steps.
   */
  static withDefaults(): SaveMigrationRegistry {
    const registry = new SaveMigrationRegistry();
    for (const [version, migration] of Object.entries(DEFAULT_MIGRATIONS)) {
      registry.register(Number(version), migration);
    }
    return registry;
  }
}
