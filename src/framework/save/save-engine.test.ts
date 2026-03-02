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
});
