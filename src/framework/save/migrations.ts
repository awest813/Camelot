import { FRAMEWORK_SAVE_SCHEMA_VERSION, FrameworkSaveFile, FrameworkStateSnapshot } from "./save-types";

export type SaveMigration = (input: unknown) => unknown;

/**
 * v0 shape (legacy draft):
 * {
 *   version: 0,
 *   timestamp: number,
 *   profileId?: string,
 *   dialogueState?: object,
 *   questState?: object,
 *   inventoryState?: object,
 *   factionState?: object,
 *   flags?: object,
 *   legacyState?: object
 * }
 */
const migrateV0ToV1: SaveMigration = (input) => {
  const legacy = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const state: FrameworkStateSnapshot = {
    dialogueState: asObject(legacy.dialogueState),
    questState: asObject(legacy.questState),
    inventoryState: asObject(legacy.inventoryState),
    factionState: asObject(legacy.factionState),
    flags: asBooleanRecord(legacy.flags),
    legacyState: asObject(legacy.legacyState),
  };

  const migrated: FrameworkSaveFile = {
    schemaVersion: 1,
    savedAt: Number.isFinite(legacy.timestamp) ? Number(legacy.timestamp) : Date.now(),
    profileId: typeof legacy.profileId === "string" ? legacy.profileId : "default",
    state,
  };

  return migrated;
};

export const DEFAULT_MIGRATIONS: Record<number, SaveMigration> = {
  0: migrateV0ToV1,
};

export const applySaveMigrations = (
  input: unknown,
  targetVersion: number = FRAMEWORK_SAVE_SCHEMA_VERSION,
  migrations: Record<number, SaveMigration> = DEFAULT_MIGRATIONS
): FrameworkSaveFile => {
  let current = input;
  let version = detectVersion(input);

  while (version < targetVersion) {
    const migration = migrations[version];
    if (!migration) {
      throw new Error(`Missing save migration for version ${version}.`);
    }
    current = migration(current);
    version = detectVersion(current);
  }

  if (version !== targetVersion) {
    throw new Error(`Unable to migrate save to target version ${targetVersion}.`);
  }

  return normalizeSave(current);
};

const detectVersion = (input: unknown): number => {
  const obj = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  if (Number.isFinite(obj.schemaVersion)) return Number(obj.schemaVersion);
  if (Number.isFinite(obj.version)) return Number(obj.version);
  return 0;
};

const normalizeSave = (input: unknown): FrameworkSaveFile => {
  const obj = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  return {
    schemaVersion: Number(obj.schemaVersion ?? FRAMEWORK_SAVE_SCHEMA_VERSION),
    savedAt: Number(obj.savedAt ?? Date.now()),
    profileId: typeof obj.profileId === "string" ? obj.profileId : "default",
    state: normalizeState(obj.state),
  };
};

const normalizeState = (state: unknown): FrameworkStateSnapshot => {
  const obj = (typeof state === "object" && state !== null ? state : {}) as Record<string, unknown>;
  return {
    dialogueState: asObject(obj.dialogueState),
    questState: asObject(obj.questState),
    inventoryState: asObject(obj.inventoryState),
    factionState: asObject(obj.factionState),
    flags: asBooleanRecord(obj.flags),
    legacyState: asObject(obj.legacyState),
  };
};

const asObject = (value: unknown): Record<string, unknown> => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

const asBooleanRecord = (value: unknown): Record<string, boolean> => {
  const source = asObject(value);
  const target: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(source)) {
    target[key] = Boolean(raw);
  }
  return target;
};
