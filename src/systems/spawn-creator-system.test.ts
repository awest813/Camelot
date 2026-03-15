import { describe, it, expect, beforeEach } from "vitest";
import { SpawnCreatorSystem } from "./spawn-creator-system";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSystem() {
  return new SpawnCreatorSystem();
}

function makePopulated() {
  const sys = makeSystem();
  sys.setMeta("sg_bandit_camp", "Bandit Camp", "A group of hostile bandits");
  sys.addEntry({
    id:                   "e1",
    archetypeId:          "bandit",
    lootTableId:          "bandit_loot",
    count:                3,
    levelMin:             1,
    levelMax:             10,
    respawnIntervalHours: 72,
  });
  sys.addEntry({
    id:                   "e2",
    archetypeId:          "bandit_chief",
    lootTableId:          "boss_loot",
    count:                1,
    levelMin:             5,
    levelMax:             0,
    respawnIntervalHours: 120,
  });
  return sys;
}

// ── Constructor ────────────────────────────────────────────────────────────

describe("SpawnCreatorSystem — constructor", () => {
  it("starts with a blank draft", () => {
    const sys = makeSystem();
    expect(sys.draft.id).toBe("");
    expect(sys.draft.name).toBe("");
    expect(sys.draft.description).toBe("");
    expect(sys.entries).toHaveLength(0);
  });

  it("accepts an initial partial draft", () => {
    const sys = new SpawnCreatorSystem({ id: "sg1", name: "Test Group" });
    expect(sys.draft.id).toBe("sg1");
    expect(sys.draft.name).toBe("Test Group");
  });
});

// ── setMeta ────────────────────────────────────────────────────────────────

describe("SpawnCreatorSystem — setMeta", () => {
  it("updates all metadata fields", () => {
    const sys = makeSystem();
    sys.setMeta("sg_cave", "Cave Spawn", "Spiders in the cave");
    expect(sys.draft.id).toBe("sg_cave");
    expect(sys.draft.name).toBe("Cave Spawn");
    expect(sys.draft.description).toBe("Spiders in the cave");
  });

  it("trims whitespace from id and name", () => {
    const sys = makeSystem();
    sys.setMeta("  sg1  ", "  My Group  ");
    expect(sys.draft.id).toBe("sg1");
    expect(sys.draft.name).toBe("My Group");
  });

  it("defaults description to empty string when omitted", () => {
    const sys = makeSystem();
    sys.setMeta("sg1", "Group");
    expect(sys.draft.description).toBe("");
  });
});

// ── addEntry ───────────────────────────────────────────────────────────────

describe("SpawnCreatorSystem — addEntry", () => {
  it("returns the entry id and appends it to the list", () => {
    const sys = makeSystem();
    const id = sys.addEntry({ id: "e1", archetypeId: "guard", count: 2 });
    expect(id).toBe("e1");
    expect(sys.entries).toHaveLength(1);
    expect(sys.entries[0].archetypeId).toBe("guard");
    expect(sys.entries[0].count).toBe(2);
  });

  it("auto-generates an id when none is provided", () => {
    const sys = makeSystem();
    const id1 = sys.addEntry();
    const id2 = sys.addEntry();
    expect(id1).not.toBe(id2);
    expect(sys.entries).toHaveLength(2);
  });

  it("defaults count to 1 when 0 is provided", () => {
    const sys = makeSystem();
    sys.addEntry({ id: "e0", count: 0 });
    expect(sys.entries[0].count).toBe(1);
  });

  it("defaults levelMin to 1 and levelMax to 0", () => {
    const sys = makeSystem();
    sys.addEntry({ id: "e0" });
    expect(sys.entries[0].levelMin).toBe(1);
    expect(sys.entries[0].levelMax).toBe(0);
  });

  it("defaults respawnIntervalHours to 72", () => {
    const sys = makeSystem();
    sys.addEntry({ id: "e0" });
    expect(sys.entries[0].respawnIntervalHours).toBe(72);
  });

  it("clamps levelMin to at least 1", () => {
    const sys = makeSystem();
    sys.addEntry({ id: "e0", levelMin: -5 });
    expect(sys.entries[0].levelMin).toBe(1);
  });
});

// ── updateEntry ────────────────────────────────────────────────────────────

describe("SpawnCreatorSystem — updateEntry", () => {
  it("updates individual fields", () => {
    const sys = makePopulated();
    const ok = sys.updateEntry("e1", { count: 5, archetypeId: "bandit_archer" });
    expect(ok).toBe(true);
    expect(sys.entries[0].count).toBe(5);
    expect(sys.entries[0].archetypeId).toBe("bandit_archer");
  });

  it("returns false for unknown entry", () => {
    const sys = makePopulated();
    expect(sys.updateEntry("ghost", { count: 1 })).toBe(false);
  });

  it("trims archetypeId whitespace", () => {
    const sys = makePopulated();
    sys.updateEntry("e1", { archetypeId: "  guard  " });
    expect(sys.entries[0].archetypeId).toBe("guard");
  });

  it("clamps count to at least 1", () => {
    const sys = makePopulated();
    sys.updateEntry("e1", { count: 0 });
    expect(sys.entries[0].count).toBe(1);
  });

  it("clamps levelMax to at least 0", () => {
    const sys = makePopulated();
    sys.updateEntry("e1", { levelMax: -1 });
    expect(sys.entries[0].levelMax).toBe(0);
  });
});

// ── removeEntry ────────────────────────────────────────────────────────────

describe("SpawnCreatorSystem — removeEntry", () => {
  it("removes the entry by id", () => {
    const sys = makePopulated();
    const ok = sys.removeEntry("e1");
    expect(ok).toBe(true);
    expect(sys.entries).toHaveLength(1);
    expect(sys.entries[0].id).toBe("e2");
  });

  it("returns false for unknown entry", () => {
    const sys = makePopulated();
    expect(sys.removeEntry("ghost")).toBe(false);
  });
});

// ── validate ───────────────────────────────────────────────────────────────

describe("SpawnCreatorSystem — validate", () => {
  it("returns valid for a well-formed spawn group", () => {
    const sys = makePopulated();
    const report = sys.validate();
    expect(report.valid).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("flags missing id", () => {
    const sys = makeSystem();
    sys.setMeta("", "Test");
    sys.addEntry({ id: "e1", archetypeId: "guard" });
    const report = sys.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some(i => i.type === "missing_id")).toBe(true);
  });

  it("flags missing name", () => {
    const sys = makeSystem();
    sys.setMeta("sg1", "");
    sys.addEntry({ id: "e1", archetypeId: "guard" });
    const report = sys.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some(i => i.type === "missing_name")).toBe(true);
  });

  it("flags missing archetypeId on an entry", () => {
    const sys = makeSystem();
    sys.setMeta("sg1", "Group");
    sys.addEntry({ id: "e1", archetypeId: "" });
    const report = sys.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some(i => i.type === "missing_archetype" && i.entryId === "e1")).toBe(true);
  });

  it("flags invalid level range when levelMax < levelMin", () => {
    const sys = makeSystem();
    sys.setMeta("sg1", "Group");
    sys.addEntry({ id: "e1", archetypeId: "guard", levelMin: 10, levelMax: 5 });
    const report = sys.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some(i => i.type === "invalid_level_range")).toBe(true);
  });

  it("allows levelMax = 0 (no cap)", () => {
    const sys = makeSystem();
    sys.setMeta("sg1", "Group");
    sys.addEntry({ id: "e1", archetypeId: "guard", levelMin: 5, levelMax: 0 });
    const report = sys.validate();
    expect(report.valid).toBe(true);
  });

  it("accepts a group with no entries as valid (entries are optional)", () => {
    const sys = makeSystem();
    sys.setMeta("sg_empty", "Empty Group");
    const report = sys.validate();
    expect(report.valid).toBe(true);
  });
});

// ── JSON round-trip ────────────────────────────────────────────────────────

describe("SpawnCreatorSystem — JSON round-trip", () => {
  it("serializes and deserializes without data loss", () => {
    const sys = makePopulated();
    const json = sys.exportToJson();
    expect(typeof json).toBe("string");

    const sys2 = makeSystem();
    const ok = sys2.importFromJson(json);
    expect(ok).toBe(true);
    expect(sys2.draft.id).toBe("sg_bandit_camp");
    expect(sys2.draft.name).toBe("Bandit Camp");
    expect(sys2.entries).toHaveLength(2);
    expect(sys2.entries[0].archetypeId).toBe("bandit");
    expect(sys2.entries[0].count).toBe(3);
    expect(sys2.entries[1].lootTableId).toBe("boss_loot");
  });

  it("returns false for invalid JSON", () => {
    const sys = makeSystem();
    expect(sys.importFromJson("not json")).toBe(false);
  });

  it("returns false when entries field is missing", () => {
    const sys = makeSystem();
    expect(sys.importFromJson(JSON.stringify({ id: "x", name: "y" }))).toBe(false);
  });

  it("returns false for empty string", () => {
    const sys = makeSystem();
    expect(sys.importFromJson("")).toBe(false);
  });

  it("clamps values from import to valid ranges", () => {
    const badData = JSON.stringify({
      id: "sg1", name: "Test", description: "",
      entries: [{ id: "e1", archetypeId: "guard", count: -5, levelMin: -2, levelMax: -1, respawnIntervalHours: -10 }],
    });
    const sys = makeSystem();
    const ok = sys.importFromJson(badData);
    expect(ok).toBe(true);
    expect(sys.entries[0].count).toBe(1);
    expect(sys.entries[0].levelMin).toBe(1);
    expect(sys.entries[0].levelMax).toBe(0);
    expect(sys.entries[0].respawnIntervalHours).toBe(0);
  });
});

// ── reset ──────────────────────────────────────────────────────────────────

describe("SpawnCreatorSystem — reset", () => {
  it("clears all draft state", () => {
    const sys = makePopulated();
    sys.reset();
    expect(sys.draft.id).toBe("");
    expect(sys.draft.name).toBe("");
    expect(sys.entries).toHaveLength(0);
  });

  it("resets auto-id counter so generated ids restart", () => {
    const sys = makeSystem();
    sys.addEntry(); // entry_1
    sys.reset();
    const id = sys.addEntry();
    expect(id).toBe("entry_1"); // counter restarted
  });
});
