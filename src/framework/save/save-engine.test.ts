import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaveEngine } from "./save-engine";
import { StorageAdapter } from "./save-types";

describe("SaveEngine", () => {
  let storage: Record<string, string>;
  let adapter: StorageAdapter;
  let setItemSpy: any;

  beforeEach(() => {
    storage = {};
    adapter = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
    };
    setItemSpy = vi.spyOn(adapter, "setItem");
  });

  it("creates and round-trips a framework save file", () => {
    const engine = new SaveEngine(adapter, "framework");
    const snapshot = {
      dialogueState: { active: "guard_intro" },
      questState: { quests: {} },
      inventoryState: { items: [] },
      factionState: { reputations: { guard: 10 } },
      flags: { accepted_job: true },
    };

    const save = engine.saveToStorage(snapshot, "profile_1");
    expect(save.schemaVersion).toBe(1);
    expect(setItemSpy).toHaveBeenCalled();

    const loaded = engine.loadFromStorage();
    expect(loaded?.profileId).toBe("profile_1");
    expect(loaded?.state.flags.accepted_job).toBe(true);
  });

  it("migrates legacy v0 save payloads", () => {
    const engine = new SaveEngine(adapter, "framework");
    storage.framework = JSON.stringify({
      version: 0,
      timestamp: 123456,
      profileId: "legacy",
      dialogueState: { node: "a" },
      questState: { progress: 1 },
      inventoryState: { items: [] },
      factionState: { reputations: {} },
      flags: { started: 1 },
    });

    const loaded = engine.loadFromStorage();
    expect(loaded?.schemaVersion).toBe(1);
    expect(loaded?.savedAt).toBe(123456);
    expect(loaded?.state.flags.started).toBe(true);
    expect(loaded?.state.dialogueState.node).toBe("a");
  });

  it("exportSave and importSave round-trip with checksum verification", () => {
    const engine = new SaveEngine();
    const snapshot = {
      dialogueState: {},
      questState: { quests: { q1: { status: "active", nodes: {} } } },
      inventoryState: {},
      factionState: {},
      flags: { hero: true },
    };

    const exported = engine.exportSave(snapshot, "hero_profile");
    const parsed = JSON.parse(exported);
    expect(typeof parsed.checksum).toBe("string");
    expect(parsed.checksum).toHaveLength(8);

    const imported = engine.importSave(exported);
    expect(imported.profileId).toBe("hero_profile");
    expect(imported.state.flags.hero).toBe(true);
  });

  it("importSave throws on corrupt JSON", () => {
    const engine = new SaveEngine();
    expect(() => engine.importSave("not valid json {{{")).toThrow(/not valid JSON/i);
  });

  it("importSave throws on checksum mismatch", () => {
    const engine = new SaveEngine();
    const snapshot = {
      dialogueState: {},
      questState: {},
      inventoryState: {},
      factionState: {},
      flags: {},
    };

    const exported = JSON.parse(engine.exportSave(snapshot));
    // Tamper with the state after export
    exported.state.flags.tampered = true;
    expect(() => engine.importSave(JSON.stringify(exported))).toThrow(/checksum mismatch/i);
  });

  it("importSave accepts a save without checksum (partial recovery path)", () => {
    const engine = new SaveEngine();
    const raw = JSON.stringify({
      schemaVersion: 1,
      savedAt: 999,
      profileId: "old_save",
      state: {
        dialogueState: {},
        questState: {},
        inventoryState: {},
        factionState: {},
        flags: { found_key: true },
      },
      // No checksum field — should load without error
    });

    const imported = engine.importSave(raw);
    expect(imported.profileId).toBe("old_save");
    expect(imported.state.flags.found_key).toBe(true);
  });

  it("validateSaveFile returns valid for a well-formed save", () => {
    const engine = new SaveEngine();
    const snapshot = {
      dialogueState: {},
      questState: {},
      inventoryState: {},
      factionState: {},
      flags: { accepted: true },
    };
    const saveFile = engine.createSave(snapshot, "player1");
    const result = engine.validateSaveFile(saveFile);
    expect(result.valid).toBe(true);
  });

  it("validateSaveFile detects missing state", () => {
    const engine = new SaveEngine();
    const result = engine.validateSaveFile({
      schemaVersion: 1,
      savedAt: Date.now(),
      profileId: "p1",
      state: null as unknown as any,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/state/i);
  });

  it("validateSaveFile detects checksum mismatch", () => {
    const engine = new SaveEngine();
    const snapshot = {
      dialogueState: {},
      questState: {},
      inventoryState: {},
      factionState: {},
      flags: {},
    };
    const saveFile = engine.createSave(snapshot, "p1");
    // Attach a wrong checksum
    (saveFile as any).checksum = "deadbeef";
    const result = engine.validateSaveFile(saveFile);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/checksum/i);
  });

  it("loadFromStorage returns null on invalid JSON", () => {
    const engine = new SaveEngine(adapter, "framework");
    storage.framework = "not valid json";
    const result = engine.loadFromStorage();
    expect(result).toBeNull();
  });

  it("loadFromStorage returns null when storage adapter throws", () => {
    const throwingAdapter: StorageAdapter = {
      getItem: () => {
        throw new Error("Storage failure");
      },
      setItem: () => {},
    };
    const engine = new SaveEngine(throwingAdapter, "any");
    const result = engine.loadFromStorage();
    expect(result).toBeNull();
  });

  it("loadFromStorage returns null on structural validation failure", () => {
    const engine = new SaveEngine(adapter, "framework");
    // Missing required fields like profileId or state
    storage.framework = JSON.stringify({ schemaVersion: 1 });
    const result = engine.loadFromStorage();
    expect(result).toBeNull();
  });

  it("importSave throws when root value is not an object", () => {
    const engine = new SaveEngine();
    expect(() => engine.importSave("null")).toThrow(/must be an object/i);
    expect(() => engine.importSave("123")).toThrow(/must be an object/i);
    expect(() => engine.importSave("\"string\"")).toThrow(/must be an object/i);
  });
});
