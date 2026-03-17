import { describe, it, expect } from "vitest";
import { SaveMigrationRegistry } from "./save-migration-registry";
import { SaveMigration } from "./migrations";
import { FRAMEWORK_SAVE_SCHEMA_VERSION } from "./save-types";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Minimal v0 legacy payload identical to what DEFAULT_MIGRATIONS expects. */
const v0Payload = {
  version: 0,
  timestamp: 111111,
  profileId: "tester",
  dialogueState: { node: "a" },
  questState: { progress: 1 },
  inventoryState: { items: [] },
  factionState: { reputations: {} },
  flags: { done: true },
};

/** Trivial migration that advances schemaVersion by 1 each time. */
const bumpVersion = (toVersion: number): SaveMigration =>
  (input) => ({ ...(input as object), schemaVersion: toVersion });

/** Pass-through migration from v1 → v2 (for multi-version chain tests). */
const passThroughV1 = bumpVersion(2);

// ── withDefaults ──────────────────────────────────────────────────────────────

describe("SaveMigrationRegistry.withDefaults()", () => {
  it("creates a registry pre-seeded with built-in migrations", () => {
    const registry = SaveMigrationRegistry.withDefaults();
    expect(registry.size).toBeGreaterThan(0);
  });

  it("apply() migrates a v0 legacy payload to current schema", () => {
    const registry = SaveMigrationRegistry.withDefaults();
    const result = registry.apply(v0Payload);
    expect(result.schemaVersion).toBe(FRAMEWORK_SAVE_SCHEMA_VERSION);
    expect(result.profileId).toBe("tester");
    expect(result.savedAt).toBe(111111);
    expect(result.state.flags.done).toBe(true);
    expect(result.state.questState).toMatchObject({ progress: 1 });
  });

  it("apply() leaves an already-current save untouched", () => {
    const registry = SaveMigrationRegistry.withDefaults();
    const current = {
      schemaVersion: FRAMEWORK_SAVE_SCHEMA_VERSION,
      savedAt: 999,
      profileId: "modern",
      state: {
        dialogueState: {},
        questState: {},
        inventoryState: {},
        factionState: {},
        flags: { hero: true },
      },
    };
    const result = registry.apply(current);
    expect(result.schemaVersion).toBe(FRAMEWORK_SAVE_SCHEMA_VERSION);
    expect(result.state.flags.hero).toBe(true);
  });
});

// ── register ──────────────────────────────────────────────────────────────────

describe("SaveMigrationRegistry#register()", () => {
  it("returns `this` for fluent chaining", () => {
    const registry = new SaveMigrationRegistry();
    const returned = registry.register(0, passThroughV1);
    expect(returned).toBe(registry);
  });

  it("replaces an existing migration when called twice for the same version", () => {
    const first: SaveMigration = (input) =>
      ({ ...(input as object), schemaVersion: 1, tag: "first" });
    const second: SaveMigration = (input) =>
      ({ ...(input as object), schemaVersion: 1, tag: "second" });

    const registry = new SaveMigrationRegistry();
    registry.register(0, first).register(0, second);
    expect(registry.size).toBe(1); // only one entry
  });

  it("increments size for each unique fromVersion", () => {
    const registry = new SaveMigrationRegistry();
    registry.register(0, passThroughV1);
    registry.register(1, passThroughV1);
    expect(registry.size).toBe(2);
  });

  it("throws RangeError for negative fromVersion", () => {
    const registry = new SaveMigrationRegistry();
    expect(() => registry.register(-1, passThroughV1)).toThrow(RangeError);
  });

  it("throws RangeError for non-integer fromVersion", () => {
    const registry = new SaveMigrationRegistry();
    expect(() => registry.register(0.5, passThroughV1)).toThrow(RangeError);
  });
});

// ── validate ─────────────────────────────────────────────────────────────────

describe("SaveMigrationRegistry#validate()", () => {
  it("returns true when chain is gapless", () => {
    const registry = new SaveMigrationRegistry();
    registry.register(0, passThroughV1);
    expect(registry.validate(0, 1)).toBe(true);
  });

  it("returns false when a step is missing", () => {
    const registry = new SaveMigrationRegistry();
    registry.register(0, passThroughV1);
    // Missing migration for version 1 → 2
    expect(registry.validate(0, 2)).toBe(false);
  });

  it("returns true for an empty range (minVersion === targetVersion)", () => {
    const registry = new SaveMigrationRegistry();
    expect(registry.validate(1, 1)).toBe(true);
  });

  it("returns true for a multi-step gapless chain", () => {
    const registry = new SaveMigrationRegistry();
    registry.register(0, passThroughV1);
    registry.register(1, passThroughV1);
    registry.register(2, passThroughV1);
    expect(registry.validate(0, 3)).toBe(true);
  });

  it("returns false when intermediate step is missing", () => {
    const registry = new SaveMigrationRegistry();
    registry.register(0, passThroughV1);
    // Skipped version 1
    registry.register(2, passThroughV1);
    expect(registry.validate(0, 3)).toBe(false);
  });
});

// ── buildChain ────────────────────────────────────────────────────────────────

describe("SaveMigrationRegistry#buildChain()", () => {
  it("returns an empty array for an empty range", () => {
    const registry = new SaveMigrationRegistry();
    expect(registry.buildChain(1, 1)).toEqual([]);
  });

  it("returns the single migration for a one-step range", () => {
    const registry = new SaveMigrationRegistry();
    registry.register(0, passThroughV1);
    const chain = registry.buildChain(0, 1);
    expect(chain).toHaveLength(1);
    expect(chain[0]).toBe(passThroughV1);
  });

  it("returns migrations in ascending order for a multi-step range", () => {
    const m0: SaveMigration = (x) => x;
    const m1: SaveMigration = (x) => x;
    const m2: SaveMigration = (x) => x;

    const registry = new SaveMigrationRegistry();
    registry.register(0, m0).register(1, m1).register(2, m2);
    const chain = registry.buildChain(0, 3);

    expect(chain).toHaveLength(3);
    expect(chain[0]).toBe(m0);
    expect(chain[1]).toBe(m1);
    expect(chain[2]).toBe(m2);
  });

  it("throws when a migration is missing in the chain", () => {
    const registry = new SaveMigrationRegistry();
    registry.register(0, passThroughV1);
    // No migration for version 1 → 2
    expect(() => registry.buildChain(0, 2)).toThrow(/missing migration/i);
  });

  it("error message includes the missing version number", () => {
    const registry = new SaveMigrationRegistry();
    registry.register(0, passThroughV1);
    expect(() => registry.buildChain(0, 2)).toThrow("1");
  });
});

// ── apply ─────────────────────────────────────────────────────────────────────

describe("SaveMigrationRegistry#apply()", () => {
  it("applies a custom migration chain beyond the defaults", () => {
    // Build a registry with the default v0→v1 migration plus a synthetic v1→v2
    // that stores a marker in legacyState (which normalizeSave preserves).
    const registry = SaveMigrationRegistry.withDefaults();
    const migrateV1ToV2: SaveMigration = (input) => {
      const obj = input as Record<string, unknown>;
      const state = (obj.state ?? {}) as Record<string, unknown>;
      return {
        ...obj,
        schemaVersion: 2,
        state: {
          ...state,
          legacyState: { ...(state.legacyState as object ?? {}), migratedToV2: true },
        },
      };
    };
    registry.register(1, migrateV1ToV2);

    const result = registry.apply(v0Payload, 2);
    expect(result.schemaVersion).toBe(2);
    expect(result.state.legacyState?.migratedToV2).toBe(true);
  });

  it("throws when a required migration step is missing", () => {
    const registry = new SaveMigrationRegistry();
    // Register v0→v1 only (using a migration that correctly produces v1);
    // trying to reach v2 should fail because there is no v1→v2 step.
    registry.register(0, bumpVersion(1));
    expect(() => registry.apply(v0Payload, 2)).toThrow();
  });

  it("defaults targetVersion to FRAMEWORK_SAVE_SCHEMA_VERSION", () => {
    const registry = SaveMigrationRegistry.withDefaults();
    const result = registry.apply(v0Payload);
    expect(result.schemaVersion).toBe(FRAMEWORK_SAVE_SCHEMA_VERSION);
  });
});
