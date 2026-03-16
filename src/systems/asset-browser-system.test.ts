import { describe, it, expect, beforeEach } from "vitest";
import { AssetBrowserSystem } from "./asset-browser-system";
import type { AssetEntry } from "./asset-browser-system";
import type { ContentBundleExport } from "./content-bundle-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: "test-id",
    name: "Test Entry",
    type: "item",
    tags: ["weapon"],
    description: "A test item.",
    dependencies: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AssetBrowserSystem", () => {
  let sys: AssetBrowserSystem;

  beforeEach(() => {
    sys = new AssetBrowserSystem();
  });

  // ── Registration ────────────────────────────────────────────────────────────

  it("registers and retrieves an asset", () => {
    sys.register(makeEntry({ id: "sword-01", name: "Iron Sword" }));
    expect(sys.getById("sword-01")).toMatchObject({ name: "Iron Sword" });
    expect(sys.size).toBe(1);
  });

  it("replaces an existing asset on re-register", () => {
    sys.register(makeEntry({ id: "sword-01", name: "Iron Sword" }));
    sys.register(makeEntry({ id: "sword-01", name: "Steel Sword" }));
    expect(sys.getById("sword-01")?.name).toBe("Steel Sword");
    expect(sys.size).toBe(1);
  });

  it("unregisters an asset", () => {
    sys.register(makeEntry({ id: "sword-01" }));
    expect(sys.unregister("sword-01")).toBe(true);
    expect(sys.size).toBe(0);
  });

  it("returns false when unregistering a missing asset", () => {
    expect(sys.unregister("no-such-id")).toBe(false);
  });

  it("clears all assets and favorites", () => {
    sys.register(makeEntry({ id: "a" }));
    sys.register(makeEntry({ id: "b" }));
    sys.toggleFavorite("a");
    sys.clear();
    expect(sys.size).toBe(0);
    expect(sys.favoriteCount).toBe(0);
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  it("returns all assets with empty options", () => {
    sys.register(makeEntry({ id: "a", name: "Alpha" }));
    sys.register(makeEntry({ id: "b", name: "Beta" }));
    expect(sys.search()).toHaveLength(2);
  });

  it("filters by query string (name match)", () => {
    sys.register(makeEntry({ id: "a", name: "Iron Sword" }));
    sys.register(makeEntry({ id: "b", name: "Steel Shield" }));
    const results = sys.search({ query: "sword" });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("a");
  });

  it("filters by query string (id match)", () => {
    sys.register(makeEntry({ id: "boss-goblin", name: "Goblin Chief" }));
    sys.register(makeEntry({ id: "archer-01", name: "Archer" }));
    expect(sys.search({ query: "boss" })).toHaveLength(1);
  });

  it("filters by type", () => {
    sys.register(makeEntry({ id: "a", type: "item" }));
    sys.register(makeEntry({ id: "b", type: "npc" }));
    sys.register(makeEntry({ id: "c", type: "quest" }));
    const results = sys.search({ types: ["item", "npc"] });
    expect(results).toHaveLength(2);
  });

  it("filters by tags (all must match)", () => {
    sys.register(makeEntry({ id: "a", tags: ["weapon", "magic"] }));
    sys.register(makeEntry({ id: "b", tags: ["weapon"] }));
    expect(sys.search({ tags: ["weapon", "magic"] })).toHaveLength(1);
    expect(sys.search({ tags: ["weapon"] })).toHaveLength(2);
  });

  it("filters favorites only", () => {
    sys.register(makeEntry({ id: "a" }));
    sys.register(makeEntry({ id: "b" }));
    sys.toggleFavorite("a");
    expect(sys.search({ favoritesOnly: true })).toHaveLength(1);
  });

  it("sorts favorites first then alphabetically", () => {
    sys.register(makeEntry({ id: "a", name: "Zeta" }));
    sys.register(makeEntry({ id: "b", name: "Alpha" }));
    sys.register(makeEntry({ id: "c", name: "Beta" }));
    sys.toggleFavorite("a");
    const results = sys.search();
    expect(results[0].id).toBe("a"); // favorite first
    expect(results[1].name).toBe("Alpha");
    expect(results[2].name).toBe("Beta");
  });

  // ── Favorites ───────────────────────────────────────────────────────────────

  it("toggles favorites on/off", () => {
    sys.register(makeEntry({ id: "x" }));
    expect(sys.isFavorite("x")).toBe(false);
    expect(sys.toggleFavorite("x")).toBe(true);
    expect(sys.isFavorite("x")).toBe(true);
    expect(sys.toggleFavorite("x")).toBe(false);
    expect(sys.isFavorite("x")).toBe(false);
  });

  it("returns favorite IDs list", () => {
    sys.register(makeEntry({ id: "a" }));
    sys.register(makeEntry({ id: "b" }));
    sys.toggleFavorite("a");
    expect(sys.getFavoriteIds()).toContain("a");
    expect(sys.getFavoriteIds()).not.toContain("b");
  });

  it("removes from favorites on unregister", () => {
    sys.register(makeEntry({ id: "a" }));
    sys.toggleFavorite("a");
    sys.unregister("a");
    expect(sys.isFavorite("a")).toBe(false);
  });

  // ── Dependency graph ─────────────────────────────────────────────────────────

  it("getDependencies returns linked assets", () => {
    sys.register(makeEntry({ id: "lt-01", type: "lootTable" }));
    sys.register(makeEntry({ id: "npc-01", type: "npc", dependencies: ["lt-01"] }));
    const deps = sys.getDependencies("npc-01");
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe("lt-01");
  });

  it("getDependencies skips unknown IDs", () => {
    sys.register(makeEntry({ id: "npc-01", dependencies: ["missing-id"] }));
    expect(sys.getDependencies("npc-01")).toHaveLength(0);
  });

  it("getDependents returns reverse dependencies", () => {
    sys.register(makeEntry({ id: "lt-01", type: "lootTable" }));
    sys.register(makeEntry({ id: "npc-01", type: "npc", dependencies: ["lt-01"] }));
    sys.register(makeEntry({ id: "spawn-01", type: "spawn", dependencies: ["lt-01"] }));
    const dependents = sys.getDependents("lt-01");
    expect(dependents).toHaveLength(2);
    const ids = dependents.map((a) => a.id).sort();
    expect(ids).toEqual(["npc-01", "spawn-01"]);
  });

  it("getTransitiveDependencies performs BFS", () => {
    sys.register(makeEntry({ id: "root",  dependencies: ["mid"] }));
    sys.register(makeEntry({ id: "mid",   dependencies: ["leaf"] }));
    sys.register(makeEntry({ id: "leaf",  dependencies: [] }));
    const transitive = sys.getTransitiveDependencies("root");
    const ids = transitive.map((a) => a.id).sort();
    expect(ids).toEqual(["leaf", "mid"]);
  });

  // ── Tags ─────────────────────────────────────────────────────────────────────

  it("getAllTags returns sorted distinct tags", () => {
    sys.register(makeEntry({ id: "a", tags: ["weapon", "rare"] }));
    sys.register(makeEntry({ id: "b", tags: ["armor", "rare"] }));
    const tags = sys.getAllTags();
    expect(tags).toEqual(["armor", "rare", "weapon"]);
  });

  // ── Bundle import ────────────────────────────────────────────────────────────

  it("importFromBundle registers quest asset", () => {
    const bundle: ContentBundleExport = {
      manifest: {
        schemaVersion: 1,
        title: "Test",
        description: "",
        author: "",
        exportedAt: "",
        systems: ["quest"],
      },
      quest: { id: "q-001", name: "Main Quest", description: "The main quest." },
    };
    const n = sys.importFromBundle(bundle);
    expect(n).toBe(1);
    const asset = sys.getById("q-001");
    expect(asset?.type).toBe("quest");
    expect(asset?.name).toBe("Main Quest");
  });

  it("importFromBundle registers item asset", () => {
    const bundle: ContentBundleExport = {
      manifest: {
        schemaVersion: 1, title: "", description: "", author: "", exportedAt: "", systems: ["item"],
      },
      item: { id: "sword-02", name: "Iron Sword", tags: ["weapon"], description: "A trusty sword." },
    };
    const n = sys.importFromBundle(bundle);
    expect(n).toBe(1);
    expect(sys.getById("sword-02")?.type).toBe("item");
  });

  it("importFromBundle registers map entities", () => {
    const bundle: ContentBundleExport = {
      manifest: {
        schemaVersion: 1, title: "", description: "", author: "", exportedAt: "", systems: ["map"],
      },
      map: {
        version: 1,
        exportedAt: "",
        entities: [
          { id: "entity-01", type: "loot", label: "Chest", position: { x: 0, y: 0, z: 0 } },
          { id: "entity-02", type: "npc",  label: "Guard", position: { x: 1, y: 0, z: 1 } },
        ],
        patrolRoutes: [],
      } as any,
    };
    const n = sys.importFromBundle(bundle);
    expect(n).toBe(2);
  });

  it("importFromBundle skips entries with no id", () => {
    const bundle: ContentBundleExport = {
      manifest: {
        schemaVersion: 1, title: "", description: "", author: "", exportedAt: "", systems: ["quest"],
      },
      quest: { name: "No ID Quest" }, // missing id
    };
    expect(sys.importFromBundle(bundle)).toBe(0);
  });
});
