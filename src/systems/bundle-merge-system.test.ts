import { describe, it, expect, beforeEach } from "vitest";
import { BundleMergeSystem } from "./bundle-merge-system";
import type { ContentBundleExport } from "./content-bundle-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBundle(overrides: Partial<ContentBundleExport> = {}): ContentBundleExport {
  return {
    manifest: {
      schemaVersion: 1,
      title: "Test Bundle",
      description: "",
      author: "Tester",
      exportedAt: "2024-01-01T00:00:00.000Z",
      systems: [],
    },
    ...overrides,
  };
}

const questA = { id: "q-001", name: "Main Quest", description: "The main story." };
const questB = { id: "q-001", name: "Main Quest v2", description: "Updated version." };
const questC = { id: "q-002", name: "Side Quest" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BundleMergeSystem", () => {
  let sys: BundleMergeSystem;

  beforeEach(() => {
    sys = new BundleMergeSystem();
  });

  // ── Loading ─────────────────────────────────────────────────────────────────

  it("reports hasBase / hasIncoming correctly", () => {
    expect(sys.hasBase).toBe(false);
    expect(sys.hasIncoming).toBe(false);
    sys.loadBase(makeBundle());
    expect(sys.hasBase).toBe(true);
    expect(sys.hasIncoming).toBe(false);
    sys.loadIncoming(makeBundle());
    expect(sys.hasIncoming).toBe(true);
  });

  it("clears strategies when loading a new bundle", () => {
    sys.loadBase(makeBundle({ quest: questA }));
    sys.loadIncoming(makeBundle({ quest: questB }));
    const [c] = sys.findConflicts();
    sys.setStrategy(c.id, "keep-incoming");
    // reload base → strategies cleared
    sys.loadBase(makeBundle({ quest: questA }));
    expect(sys.getStrategy(c.id)).toBe("keep-base");
  });

  // ── Conflict detection ──────────────────────────────────────────────────────

  it("finds no conflicts when bundles have different IDs", () => {
    sys.loadBase(makeBundle({ quest: questA }));
    sys.loadIncoming(makeBundle({ quest: questC }));
    expect(sys.findConflicts()).toHaveLength(0);
  });

  it("finds a conflict when both bundles have the same quest ID", () => {
    sys.loadBase(makeBundle({ quest: questA }));
    sys.loadIncoming(makeBundle({ quest: questB }));
    const conflicts = sys.findConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].systemId).toBe("quest");
    expect(conflicts[0].baseLabel).toContain("Main Quest");
    expect(conflicts[0].incomingLabel).toContain("Main Quest v2");
  });

  it("finds conflicts across multiple systems", () => {
    sys.loadBase(makeBundle({
      quest:  { id: "q-001", name: "Quest" },
      faction: { id: "f-001", name: "Faction" },
    }));
    sys.loadIncoming(makeBundle({
      quest:  { id: "q-001", name: "Quest v2" },
      faction: { id: "f-001", name: "Faction v2" },
    }));
    expect(sys.findConflicts()).toHaveLength(2);
  });

  it("detects map entity conflicts", () => {
    sys.loadBase(makeBundle({
      map: {
        version: 1, exportedAt: "", patrolRoutes: [],
        entities: [{ id: "ent-01", type: "loot", label: "Chest Base", position: { x:0,y:0,z:0 } }],
      } as any,
    }));
    sys.loadIncoming(makeBundle({
      map: {
        version: 1, exportedAt: "", patrolRoutes: [],
        entities: [{ id: "ent-01", type: "loot", label: "Chest Incoming", position: { x:1,y:0,z:1 } }],
      } as any,
    }));
    const conflicts = sys.findConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].systemId).toBe("map");
    expect(conflicts[0].baseLabel).toContain("Chest Base");
  });

  it("returns no conflicts when bundles are not loaded", () => {
    expect(sys.findConflicts()).toHaveLength(0);
  });

  // ── Strategy management ──────────────────────────────────────────────────────

  it("defaults to keep-base strategy", () => {
    sys.loadBase(makeBundle({ quest: questA }));
    sys.loadIncoming(makeBundle({ quest: questB }));
    const [c] = sys.findConflicts();
    expect(c.strategy).toBe("keep-base");
  });

  it("setStrategy updates the conflict resolution", () => {
    sys.loadBase(makeBundle({ quest: questA }));
    sys.loadIncoming(makeBundle({ quest: questB }));
    const [c] = sys.findConflicts();
    sys.setStrategy(c.id, "keep-incoming");
    expect(sys.getStrategy(c.id)).toBe("keep-incoming");
  });

  it("setAllStrategies updates all conflicts at once", () => {
    sys.loadBase(makeBundle({ quest: { id: "q-001" }, faction: { id: "f-001" } }));
    sys.loadIncoming(makeBundle({ quest: { id: "q-001" }, faction: { id: "f-001" } }));
    sys.setAllStrategies("keep-incoming");
    for (const c of sys.findConflicts()) {
      expect(sys.getStrategy(c.id)).toBe("keep-incoming");
    }
  });

  // ── Build merged ────────────────────────────────────────────────────────────

  it("throws if bundles are not loaded", () => {
    expect(() => sys.buildMerged()).toThrow();
  });

  it("keep-base uses the base payload", () => {
    sys.loadBase(makeBundle({ quest: questA }));
    sys.loadIncoming(makeBundle({ quest: questB }));
    const [c] = sys.findConflicts();
    sys.setStrategy(c.id, "keep-base");
    const { bundle, keptBase } = sys.buildMerged();
    expect((bundle.quest as typeof questA).name).toBe("Main Quest");
    expect(keptBase).toBe(1);
  });

  it("keep-incoming uses the incoming payload", () => {
    sys.loadBase(makeBundle({ quest: questA }));
    sys.loadIncoming(makeBundle({ quest: questB }));
    const [c] = sys.findConflicts();
    sys.setStrategy(c.id, "keep-incoming");
    const { bundle, keptIncoming } = sys.buildMerged();
    expect((bundle.quest as typeof questB).name).toBe("Main Quest v2");
    expect(keptIncoming).toBe(1);
  });

  it("non-conflicting entries from both bundles are included", () => {
    sys.loadBase(makeBundle({ quest: questA, item: { id: "item-01", name: "Sword" } }));
    sys.loadIncoming(makeBundle({ faction: { id: "f-001", name: "Guild" } }));
    const { bundle } = sys.buildMerged();
    expect(bundle.quest).toBeDefined();
    expect(bundle.item).toBeDefined();
    expect(bundle.faction).toBeDefined();
  });

  it("merge includes systems list in manifest", () => {
    sys.loadBase(makeBundle({ quest: questA }));
    sys.loadIncoming(makeBundle({ item: { id: "item-01" } }));
    const { bundle } = sys.buildMerged();
    expect(bundle.manifest.systems).toContain("quest");
    expect(bundle.manifest.systems).toContain("item");
  });

  it("map entities are merged without conflicts by adding incoming uniques", () => {
    sys.loadBase(makeBundle({
      map: {
        version: 1, exportedAt: "", patrolRoutes: [],
        entities: [{ id: "ent-01", type: "loot", label: "Base", position: { x:0,y:0,z:0 } }],
      } as any,
    }));
    sys.loadIncoming(makeBundle({
      map: {
        version: 1, exportedAt: "", patrolRoutes: [],
        entities: [{ id: "ent-02", type: "npc", label: "Guard", position: { x:5,y:0,z:5 } }],
      } as any,
    }));
    const { bundle } = sys.buildMerged();
    expect(bundle.map?.entities).toHaveLength(2);
  });

  it("map entity conflict with rename-incoming adds suffixed entity", () => {
    sys.loadBase(makeBundle({
      map: {
        version: 1, exportedAt: "", patrolRoutes: [],
        entities: [{ id: "ent-01", type: "loot", label: "Base Chest", position: { x:0,y:0,z:0 } }],
      } as any,
    }));
    sys.loadIncoming(makeBundle({
      map: {
        version: 1, exportedAt: "", patrolRoutes: [],
        entities: [{ id: "ent-01", type: "loot", label: "Inc Chest", position: { x:1,y:0,z:1 } }],
      } as any,
    }));
    const [c] = sys.findConflicts();
    sys.setStrategy(c.id, "rename-incoming");
    const { bundle, renamed } = sys.buildMerged();
    expect(renamed).toBe(1);
    const ids = bundle.map!.entities.map((e: { id: string }) => e.id);
    expect(ids).toContain("ent-01");
    expect(ids).toContain("ent-01_merged");
  });

  it("conflictCount reflects total detected conflicts", () => {
    sys.loadBase(makeBundle({ quest: questA, faction: { id: "f-001" } }));
    sys.loadIncoming(makeBundle({ quest: questB, faction: { id: "f-001" } }));
    const { conflictCount } = sys.buildMerged();
    expect(conflictCount).toBe(2);
  });
});
