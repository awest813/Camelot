import { describe, it, expect, beforeEach } from "vitest";
import {
  ContentBundleSystem,
  sortKeysDeep,
  toNormalizedJson,
} from "./content-bundle-system";
import { QuestCreatorSystem } from "./quest-creator-system";
import { FactionCreatorSystem } from "./faction-creator-system";
import { LootTableCreatorSystem } from "./loot-table-creator-system";
import { ItemCreatorSystem } from "./item-creator-system";
import { NpcCreatorSystem } from "./npc-creator-system";
import { SpawnCreatorSystem } from "./spawn-creator-system";
import { DialogueCreatorSystem } from "./dialogue-creator-system";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeBundle() {
  return new ContentBundleSystem();
}

function makePopulatedQuest() {
  const s = new QuestCreatorSystem();
  s.setMeta("q1", "Test Quest", "A test quest", 100);
  s.addNode({ id: "n1", description: "Kill 3 bandits", triggerType: "kill", targetId: "bandit", requiredCount: 3 });
  return s;
}

function makePopulatedFaction() {
  const s = new FactionCreatorSystem();
  s.setMeta({ id: "f1", name: "Guards", defaultReputation: 0 });
  return s;
}

function makePopulatedLootTable() {
  const s = new LootTableCreatorSystem();
  s.setMeta({ id: "lt1", rolls: 1 });
  s.addEntry({ itemId: "gold", itemName: "Gold", weight: 10 });
  return s;
}

function makePopulatedItem() {
  const s = new ItemCreatorSystem();
  s.setMeta({ id: "sword", name: "Iron Sword", description: "A sturdy iron sword." });
  return s;
}

function makePopulatedNpc() {
  const s = new NpcCreatorSystem();
  s.setMeta({ id: "guard_01", name: "Guard", role: "guard" });
  return s;
}

function makePopulatedSpawn() {
  const s = new SpawnCreatorSystem();
  s.setMeta("sg1", "Camp", "A spawn group");
  s.addEntry({ archetypeId: "bandit", count: 2, levelMin: 1, levelMax: 5, respawnIntervalHours: 72 });
  return s;
}

function makePopulatedDialogue() {
  const s = new DialogueCreatorSystem();
  s.setMeta("d1", "greeting");
  s.addNode({ id: "greeting", speaker: "Guard", text: "Halt!" });
  return s;
}

// ── constructor ────────────────────────────────────────────────────────────

describe("ContentBundleSystem — constructor", () => {
  it("starts with empty attached systems", () => {
    const bundle = makeBundle();
    expect(bundle.attachedSystems).toHaveLength(0);
  });

  it("starts with blank meta", () => {
    const bundle = makeBundle();
    expect(bundle.meta.title).toBe("");
    expect(bundle.meta.description).toBe("");
    expect(bundle.meta.author).toBe("");
  });
});

// ── setMeta ────────────────────────────────────────────────────────────────

describe("ContentBundleSystem — setMeta", () => {
  it("sets title, description, author", () => {
    const b = makeBundle();
    b.setMeta({ title: "My Bundle", description: "desc", author: "Author" });
    expect(b.meta.title).toBe("My Bundle");
    expect(b.meta.description).toBe("desc");
    expect(b.meta.author).toBe("Author");
  });

  it("trims whitespace", () => {
    const b = makeBundle();
    b.setMeta({ title: "  Bundle  ", author: "  Author  " });
    expect(b.meta.title).toBe("Bundle");
    expect(b.meta.author).toBe("Author");
  });

  it("partial update leaves other fields unchanged", () => {
    const b = makeBundle();
    b.setMeta({ title: "T1", author: "A1" });
    b.setMeta({ description: "D1" });
    expect(b.meta.title).toBe("T1");
    expect(b.meta.author).toBe("A1");
    expect(b.meta.description).toBe("D1");
  });
});

// ── attach* ────────────────────────────────────────────────────────────────

describe("ContentBundleSystem — attach systems", () => {
  it("attachQuest registers the quest system", () => {
    const b = makeBundle();
    b.attachQuest(makePopulatedQuest());
    expect(b.attachedSystems).toContain("quest");
  });

  it("attachFaction registers the faction system", () => {
    const b = makeBundle();
    b.attachFaction(makePopulatedFaction());
    expect(b.attachedSystems).toContain("faction");
  });

  it("attachLootTable registers the loot table system", () => {
    const b = makeBundle();
    b.attachLootTable(makePopulatedLootTable());
    expect(b.attachedSystems).toContain("lootTable");
  });

  it("attachItem registers the item system", () => {
    const b = makeBundle();
    b.attachItem(makePopulatedItem());
    expect(b.attachedSystems).toContain("item");
  });

  it("attachNpc registers the npc system", () => {
    const b = makeBundle();
    b.attachNpc(makePopulatedNpc());
    expect(b.attachedSystems).toContain("npc");
  });

  it("attachSpawn registers the spawn system", () => {
    const b = makeBundle();
    b.attachSpawn(makePopulatedSpawn());
    expect(b.attachedSystems).toContain("spawn");
  });

  it("attachDialogue registers the dialogue system", () => {
    const b = makeBundle();
    b.attachDialogue(makePopulatedDialogue());
    expect(b.attachedSystems).toContain("dialogue");
  });

  it("attach returns this for chaining", () => {
    const b = makeBundle();
    const result = b.attachQuest(makePopulatedQuest()).attachFaction(makePopulatedFaction());
    expect(result).toBe(b);
    expect(b.attachedSystems).toContain("quest");
    expect(b.attachedSystems).toContain("faction");
  });
});

// ── validate ──────────────────────────────────────────────────────────────

describe("ContentBundleSystem — validate", () => {
  it("returns allValid=true with no systems attached", () => {
    const b = makeBundle();
    const r = b.validate();
    expect(r.allValid).toBe(true);
    expect(r.systems).toHaveLength(0);
    expect(r.generatedAt).toBeTruthy();
  });

  it("includes a report for each attached system", () => {
    const b = makeBundle();
    b.attachQuest(makePopulatedQuest());
    b.attachFaction(makePopulatedFaction());
    const r = b.validate();
    const ids = r.systems.map((s) => s.systemId);
    expect(ids).toContain("quest");
    expect(ids).toContain("faction");
    expect(r.systems).toHaveLength(2);
  });

  it("valid quest passes validation", () => {
    const b = makeBundle();
    b.attachQuest(makePopulatedQuest());
    const r = b.validate();
    const qs = r.systems.find((s) => s.systemId === "quest");
    expect(qs?.valid).toBe(true);
    expect(qs?.issues).toHaveLength(0);
  });

  it("invalid quest fails validation", () => {
    const b = makeBundle();
    // Quest with a node referencing a non-existent prerequisite → validation error
    const q = new QuestCreatorSystem();
    q.setMeta("q_bad", "Bad Quest", "", 0);
    q.addNode({ id: "n1", description: "Talk", triggerType: "talk", targetId: "npc", requiredCount: 1, prerequisites: ["ghost_node"] });
    b.attachQuest(q);
    const r = b.validate();
    const qs = r.systems.find((s) => s.systemId === "quest");
    expect(qs?.valid).toBe(false);
    expect(qs?.issues.length).toBeGreaterThan(0);
  });

  it("allValid is false when any system has issues", () => {
    const b = makeBundle();
    // Quest with a bad prerequisite reference → validation error
    const q = new QuestCreatorSystem();
    q.setMeta("q_bad", "Bad Quest", "", 0);
    q.addNode({ id: "n1", description: "Talk", triggerType: "talk", targetId: "npc", requiredCount: 1, prerequisites: ["missing_node"] });
    b.attachQuest(q);
    b.attachFaction(makePopulatedFaction());
    const r = b.validate();
    expect(r.allValid).toBe(false);
  });

  it("each issue has a non-empty message string", () => {
    const b = makeBundle();
    const q = new QuestCreatorSystem();
    q.setMeta("q_bad", "Bad Quest", "", 0);
    q.addNode({ id: "n1", description: "Talk", triggerType: "talk", targetId: "npc", requiredCount: 1, prerequisites: ["missing_node"] });
    b.attachQuest(q);
    const r = b.validate();
    const qs = r.systems.find((s) => s.systemId === "quest");
    for (const issue of qs!.issues) {
      expect(typeof issue.message).toBe("string");
      expect(issue.message.length).toBeGreaterThan(0);
    }
  });

  it("generatedAt is a valid ISO date string", () => {
    const b = makeBundle();
    const r = b.validate();
    const d = new Date(r.generatedAt);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it("reports pass for valid loot table", () => {
    const b = makeBundle();
    b.attachLootTable(makePopulatedLootTable());
    const r = b.validate();
    const lt = r.systems.find((s) => s.systemId === "lootTable");
    expect(lt?.valid).toBe(true);
  });

  it("reports pass for valid item", () => {
    const b = makeBundle();
    b.attachItem(makePopulatedItem());
    const r = b.validate();
    const it_ = r.systems.find((s) => s.systemId === "item");
    expect(it_?.valid).toBe(true);
  });

  it("reports pass for valid spawn group", () => {
    const b = makeBundle();
    b.attachSpawn(makePopulatedSpawn());
    const r = b.validate();
    const sp = r.systems.find((s) => s.systemId === "spawn");
    expect(sp?.valid).toBe(true);
  });
});

// ── buildBundle ───────────────────────────────────────────────────────────

describe("ContentBundleSystem — buildBundle", () => {
  it("manifest contains expected fields", () => {
    const b = makeBundle();
    b.setMeta({ title: "Test Bundle", author: "Tester" });
    const bundle = b.buildBundle();
    expect(bundle.manifest.schemaVersion).toBe(1);
    expect(bundle.manifest.title).toBe("Test Bundle");
    expect(bundle.manifest.author).toBe("Tester");
    expect(bundle.manifest.exportedAt).toBeTruthy();
  });

  it("manifest lists included system IDs", () => {
    const b = makeBundle();
    b.attachQuest(makePopulatedQuest()).attachFaction(makePopulatedFaction());
    const bundle = b.buildBundle();
    expect(bundle.manifest.systems).toContain("quest");
    expect(bundle.manifest.systems).toContain("faction");
    expect(bundle.manifest.systems).toHaveLength(2);
  });

  it("defaults manifest title to Untitled Bundle when empty", () => {
    const bundle = makeBundle().buildBundle();
    expect(bundle.manifest.title).toBe("Untitled Bundle");
  });

  it("quest field is populated when quest system attached", () => {
    const b = makeBundle();
    b.attachQuest(makePopulatedQuest());
    const bundle = b.buildBundle();
    expect(bundle.quest).toBeDefined();
    expect((bundle.quest as Record<string, unknown>).id).toBe("q1");
  });

  it("faction field is populated when faction system attached", () => {
    const b = makeBundle();
    b.attachFaction(makePopulatedFaction());
    const bundle = b.buildBundle();
    expect(bundle.faction).toBeDefined();
    expect((bundle.faction as Record<string, unknown>).id).toBe("f1");
  });

  it("systems not attached are absent from bundle", () => {
    const b = makeBundle();
    b.attachQuest(makePopulatedQuest());
    const bundle = b.buildBundle();
    expect(bundle.dialogue).toBeUndefined();
    expect(bundle.faction).toBeUndefined();
    expect(bundle.map).toBeUndefined();
  });
});

// ── exportToJson ──────────────────────────────────────────────────────────

describe("ContentBundleSystem — exportToJson", () => {
  it("returns a valid JSON string", () => {
    const b = makeBundle();
    b.attachQuest(makePopulatedQuest());
    const json = b.exportToJson();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("JSON contains manifest", () => {
    const b = makeBundle();
    const json = b.exportToJson();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.manifest).toBeDefined();
  });

  it("JSON keys are sorted alphabetically at each level", () => {
    const b = makeBundle();
    b.attachFaction(makePopulatedFaction());
    const json = b.exportToJson();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const topKeys = Object.keys(parsed);
    // "faction" < "manifest"
    expect(topKeys.indexOf("faction")).toBeLessThan(topKeys.indexOf("manifest"));
  });
});

// ── sortKeysDeep ──────────────────────────────────────────────────────────

describe("sortKeysDeep", () => {
  it("sorts object keys alphabetically", () => {
    const sorted = sortKeysDeep({ z: 1, a: 2, m: 3 }) as Record<string, number>;
    expect(Object.keys(sorted)).toEqual(["a", "m", "z"]);
  });

  it("recursively sorts nested objects", () => {
    const sorted = sortKeysDeep({ b: { d: 1, c: 2 }, a: 3 }) as Record<string, unknown>;
    expect(Object.keys(sorted)).toEqual(["a", "b"]);
    expect(Object.keys(sorted.b as object)).toEqual(["c", "d"]);
  });

  it("preserves array order while sorting objects inside arrays", () => {
    const sorted = sortKeysDeep([{ z: 1, a: 2 }, { y: 3, b: 4 }]) as Array<Record<string, number>>;
    expect(sorted[0]).toEqual({ a: 2, z: 1 });
    expect(sorted[1]).toEqual({ b: 4, y: 3 });
  });

  it("passes through primitives unchanged", () => {
    expect(sortKeysDeep(42)).toBe(42);
    expect(sortKeysDeep("hello")).toBe("hello");
    expect(sortKeysDeep(null)).toBeNull();
    expect(sortKeysDeep(true)).toBe(true);
  });

  it("handles empty objects and arrays", () => {
    expect(sortKeysDeep({})).toEqual({});
    expect(sortKeysDeep([])).toEqual([]);
  });
});

// ── toNormalizedJson ──────────────────────────────────────────────────────

describe("toNormalizedJson", () => {
  it("produces deterministic output regardless of insertion order", () => {
    const a = toNormalizedJson({ z: 1, a: 2 });
    const b = toNormalizedJson({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it("uses 2-space indentation", () => {
    const json = toNormalizedJson({ a: 1 });
    expect(json).toBe('{\n  "a": 1\n}');
  });
});

// ── getPlayFromHereConfig ─────────────────────────────────────────────────

describe("ContentBundleSystem — getPlayFromHereConfig", () => {
  it("returns null when system is not attached", () => {
    const b = makeBundle();
    expect(b.getPlayFromHereConfig("quest")).toBeNull();
    expect(b.getPlayFromHereConfig("faction")).toBeNull();
  });

  it("returns config with systemId and label when attached", () => {
    const b = makeBundle();
    b.attachQuest(makePopulatedQuest());
    const config = b.getPlayFromHereConfig("quest");
    expect(config).not.toBeNull();
    expect(config!.systemId).toBe("quest");
    expect(config!.label).toBe("Quest Creator");
  });

  it("returns correct label for each system id", () => {
    const b = makeBundle();
    b.attachFaction(makePopulatedFaction())
      .attachLootTable(makePopulatedLootTable())
      .attachItem(makePopulatedItem())
      .attachNpc(makePopulatedNpc())
      .attachSpawn(makePopulatedSpawn())
      .attachDialogue(makePopulatedDialogue());

    expect(b.getPlayFromHereConfig("faction")!.label).toBe("Faction Creator");
    expect(b.getPlayFromHereConfig("lootTable")!.label).toBe("Loot Table Creator");
    expect(b.getPlayFromHereConfig("item")!.label).toBe("Item Creator");
    expect(b.getPlayFromHereConfig("npc")!.label).toBe("NPC Creator");
    expect(b.getPlayFromHereConfig("spawn")!.label).toBe("Loot + Spawn Creator");
    expect(b.getPlayFromHereConfig("dialogue")!.label).toBe("Dialogue Creator");
  });
});
