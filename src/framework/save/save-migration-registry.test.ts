import { describe, it, expect } from "vitest";
import { SaveMigrationRegistry } from "./save-migration-registry";
import { FRAMEWORK_SAVE_SCHEMA_VERSION } from "./save-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function identityMigration(input: unknown): unknown {
  const obj = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  return { ...obj, schemaVersion: (Number(obj.schemaVersion ?? 0)) + 1 };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SaveMigrationRegistry — construction", () => {
  it("starts empty", () => {
    const reg = new SaveMigrationRegistry();
    expect(reg.size).toBe(0);
    expect(reg.registeredVersions()).toEqual([]);
  });

  it("withDefaults() includes the v0→v1 migration", () => {
    const reg = SaveMigrationRegistry.withDefaults();
    expect(reg.has(0)).toBe(true);
    expect(reg.size).toBeGreaterThanOrEqual(1);
  });
});

describe("SaveMigrationRegistry — register / has / get / unregister", () => {
  it("register() stores a migration and has() returns true", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(0, identityMigration);
    expect(reg.has(0)).toBe(true);
    expect(reg.size).toBe(1);
  });

  it("get() returns the registered migration", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(0, identityMigration);
    expect(reg.get(0)).toBe(identityMigration);
  });

  it("get() returns undefined for an unregistered version", () => {
    const reg = new SaveMigrationRegistry();
    expect(reg.get(99)).toBeUndefined();
  });

  it("re-registering the same version overwrites the previous migration", () => {
    const reg = new SaveMigrationRegistry();
    const second = (v: unknown) => v;
    reg.register(0, identityMigration);
    reg.register(0, second);
    expect(reg.get(0)).toBe(second);
    expect(reg.size).toBe(1);
  });

  it("unregister() removes a migration", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(0, identityMigration);
    reg.unregister(0);
    expect(reg.has(0)).toBe(false);
    expect(reg.size).toBe(0);
  });

  it("unregister() is a no-op for an unknown version", () => {
    const reg = new SaveMigrationRegistry();
    expect(() => reg.unregister(99)).not.toThrow();
  });

  it("register() throws for a negative version", () => {
    const reg = new SaveMigrationRegistry();
    expect(() => reg.register(-1, identityMigration)).toThrow();
  });

  it("register() returns the registry for chaining", () => {
    const reg = new SaveMigrationRegistry();
    const result = reg.register(0, identityMigration);
    expect(result).toBe(reg);
  });

  it("registeredVersions() returns sorted ascending list", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(2, identityMigration);
    reg.register(0, identityMigration);
    reg.register(1, identityMigration);
    expect(reg.registeredVersions()).toEqual([0, 1, 2]);
  });
});

describe("SaveMigrationRegistry — validate", () => {
  it("returns valid=true when all versions 0..targetVersion-1 are registered", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(0, identityMigration);
    const result = reg.validate(1);
    expect(result.valid).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.targetVersion).toBe(1);
  });

  it("reports gaps when a migration is missing", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(0, identityMigration);
    // Version 1 is missing
    reg.register(2, identityMigration);
    const result = reg.validate(3);
    expect(result.valid).toBe(false);
    expect(result.gaps).toContain(1);
  });

  it("returns valid=true for an empty registry when targetVersion=0", () => {
    const reg = new SaveMigrationRegistry();
    const result = reg.validate(0);
    expect(result.valid).toBe(true);
    expect(result.gaps).toEqual([]);
  });

  it("uses FRAMEWORK_SAVE_SCHEMA_VERSION as default target version", () => {
    const reg = SaveMigrationRegistry.withDefaults();
    const result = reg.validate();
    expect(result.targetVersion).toBe(FRAMEWORK_SAVE_SCHEMA_VERSION);
  });
});

describe("SaveMigrationRegistry — buildChain", () => {
  it("returns empty chain when from === to", () => {
    const reg = new SaveMigrationRegistry();
    expect(reg.buildChain(1, 1)).toEqual([]);
  });

  it("returns the single migration entry for a one-step chain", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(0, identityMigration);
    const chain = reg.buildChain(0, 1);
    expect(chain).toHaveLength(1);
    expect(chain[0].fromVersion).toBe(0);
    expect(chain[0].toVersion).toBe(1);
    expect(chain[0].migration).toBe(identityMigration);
  });

  it("returns all steps for a multi-step chain", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(0, identityMigration);
    reg.register(1, identityMigration);
    reg.register(2, identityMigration);
    const chain = reg.buildChain(0, 3);
    expect(chain).toHaveLength(3);
    expect(chain.map(e => e.fromVersion)).toEqual([0, 1, 2]);
    expect(chain.map(e => e.toVersion)).toEqual([1, 2, 3]);
  });

  it("throws when a migration step is missing from the chain", () => {
    const reg = new SaveMigrationRegistry();
    reg.register(0, identityMigration);
    // version 1 missing
    reg.register(2, identityMigration);
    expect(() => reg.buildChain(0, 3)).toThrow(/No migration registered for version 1/);
  });
});

describe("SaveMigrationRegistry — apply", () => {
  it("applies the v0→v1 migration when using withDefaults()", () => {
    const reg = SaveMigrationRegistry.withDefaults();
    const legacyInput = {
      version: 0,
      timestamp: 9999,
      profileId: "player1",
      questState: { quests: {} },
      inventoryState: { items: [] },
      factionState: { reputations: {} },
      dialogueState: {},
      flags: {},
    };
    const result = reg.apply(legacyInput, 1);
    expect(result.schemaVersion).toBe(1);
    expect(result.savedAt).toBe(9999);
    expect(result.profileId).toBe("player1");
  });

  it("no-ops when input is already at the target version", () => {
    const reg = SaveMigrationRegistry.withDefaults();
    const v1Input = {
      schemaVersion: 1,
      savedAt: 12345,
      profileId: "p",
      state: {
        dialogueState: {},
        questState: {},
        inventoryState: {},
        factionState: {},
        flags: {},
      },
    };
    const result = reg.apply(v1Input, 1);
    expect(result.schemaVersion).toBe(1);
    expect(result.profileId).toBe("p");
  });

  it("applies a chain of custom migrations in order", () => {
    const reg = new SaveMigrationRegistry();
    const calls: number[] = [];
    reg.register(0, (input) => {
      calls.push(0);
      const obj = input as Record<string, unknown>;
      return { ...obj, schemaVersion: 1, profileId: "step1" };
    });
    reg.register(1, (input) => {
      calls.push(1);
      const obj = input as Record<string, unknown>;
      return {
        ...obj,
        schemaVersion: 2,
        profileId: "step2",
        state: {
          dialogueState: {},
          questState: {},
          inventoryState: {},
          factionState: {},
          flags: {},
        },
      };
    });

    const result = reg.apply({ version: 0, profileId: "original" }, 2);
    expect(calls).toEqual([0, 1]);
    expect(result.schemaVersion).toBe(2);
    expect(result.profileId).toBe("step2");
  });

  it("throws when a migration step is missing", () => {
    const reg = new SaveMigrationRegistry();
    // No migrations registered
    expect(() => reg.apply({ schemaVersion: 0 }, 1)).toThrow(/Missing save migration/);
  });
});
