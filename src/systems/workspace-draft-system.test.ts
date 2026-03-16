import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WorkspaceDraftSystem } from "./workspace-draft-system";
import type { WorkspaceDraftSnapshot } from "./workspace-draft-system";

// ── localStorage mock ─────────────────────────────────────────────────────────

const store: Record<string, string> = {};

const mockLocalStorage = {
  getItem:    (k: string) => store[k] ?? null,
  setItem:    (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

// Patch globalThis.localStorage for tests
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// ── Creator-system stub factory ───────────────────────────────────────────────

function makeStub(exported: string, importOk = true) {
  return {
    exportToJson:   vi.fn(() => exported),
    importFromJson: vi.fn(() => importOk),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorkspaceDraftSystem", () => {
  let sys: WorkspaceDraftSystem;

  beforeEach(() => {
    // Clear the mock store
    for (const k of Object.keys(store)) delete store[k];
    sys = new WorkspaceDraftSystem();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── hasDraft / clearDraft ──────────────────────────────────────────────────

  it("hasDraft returns false when no draft exists", () => {
    expect(sys.hasDraft()).toBe(false);
  });

  it("hasDraft returns true after save", () => {
    sys.save();
    expect(sys.hasDraft()).toBe(true);
  });

  it("clearDraft removes the draft", () => {
    sys.save();
    sys.clearDraft();
    expect(sys.hasDraft()).toBe(false);
  });

  it("getDraftSavedAt returns null when no draft", () => {
    expect(sys.getDraftSavedAt()).toBeNull();
  });

  it("getDraftSavedAt returns ISO string after save", () => {
    sys.save();
    const ts = sys.getDraftSavedAt();
    expect(ts).not.toBeNull();
    expect(() => new Date(ts!)).not.toThrow();
  });

  // ── save ──────────────────────────────────────────────────────────────────

  it("save persists quest JSON when id is non-empty", () => {
    const quest = makeStub(JSON.stringify({ id: "q-001", nodes: [] }));
    sys.attachQuest(quest as any);
    const snap = sys.save();
    expect(snap.quest).toBeDefined();
    expect(quest.exportToJson).toHaveBeenCalledOnce();
  });

  it("save skips quest when id is blank", () => {
    const quest = makeStub(JSON.stringify({ id: "" }));
    sys.attachQuest(quest as any);
    const snap = sys.save();
    expect(snap.quest).toBeUndefined();
  });

  it("save persists multiple systems", () => {
    sys.attachQuest(makeStub(JSON.stringify({ id: "q-001" })) as any);
    sys.attachFaction(makeStub(JSON.stringify({ id: "f-001" })) as any);
    const snap = sys.save();
    expect(snap.quest).toBeDefined();
    expect(snap.faction).toBeDefined();
  });

  it("onSaved callback fires after save", () => {
    const cb = vi.fn();
    sys.onSaved = cb;
    sys.save();
    expect(cb).toHaveBeenCalledOnce();
  });

  // ── restore ───────────────────────────────────────────────────────────────

  it("restore returns restoredCount 0 when no draft", () => {
    sys.attachQuest(makeStub("{}") as any);
    const result = sys.restore();
    expect(result.restoredCount).toBe(0);
    expect(result.savedAt).toBeNull();
  });

  it("restore calls importFromJson on attached systems", () => {
    const questJson = JSON.stringify({ id: "q-001" });
    const stub = makeStub(questJson);
    sys.attachQuest(stub as any);
    sys.save();

    // New system, restore into same stubs
    const sys2 = new WorkspaceDraftSystem();
    sys2.attachQuest(stub as any);
    const result = sys2.restore();

    expect(result.restoredCount).toBe(1);
    expect(result.restoredSystems).toContain("Quest");
    expect(stub.importFromJson).toHaveBeenCalledWith(questJson);
  });

  it("restore returns savedAt from snapshot", () => {
    sys.save();
    const result = sys.restore();
    expect(result.savedAt).not.toBeNull();
  });

  it("restore skips systems not attached", () => {
    const questStub = makeStub(JSON.stringify({ id: "q-001" }));
    sys.attachQuest(questStub as any);
    sys.save();

    const sys2 = new WorkspaceDraftSystem(); // no quest attached
    const result = sys2.restore();
    expect(result.restoredCount).toBe(0);
  });

  it("restore counts only systems where importFromJson returns true", () => {
    const questStub = makeStub(JSON.stringify({ id: "q-001" }), false); // importFromJson → false
    sys.attachQuest(questStub as any);
    sys.save();

    const sys2 = new WorkspaceDraftSystem();
    sys2.attachQuest(questStub as any);
    const result = sys2.restore();
    expect(result.restoredCount).toBe(0);
  });

  // ── markDirty / debounce ──────────────────────────────────────────────────

  it("markDirty triggers a debounced save after 2 s", () => {
    const onSaved = vi.fn();
    sys.onSaved = onSaved;
    sys.markDirty();
    expect(onSaved).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("multiple markDirty calls within window only save once", () => {
    const onSaved = vi.fn();
    sys.onSaved = onSaved;
    sys.markDirty();
    vi.advanceTimersByTime(500);
    sys.markDirty();
    vi.advanceTimersByTime(500);
    sys.markDirty();
    vi.advanceTimersByTime(2000);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("cancelPending prevents debounced save", () => {
    const onSaved = vi.fn();
    sys.onSaved = onSaved;
    sys.markDirty();
    sys.cancelPending();
    vi.advanceTimersByTime(3000);
    expect(onSaved).not.toHaveBeenCalled();
  });

  // ── peekDraft ─────────────────────────────────────────────────────────────

  it("peekDraft returns null when no draft", () => {
    expect(sys.peekDraft()).toBeNull();
  });

  it("peekDraft returns snapshot without side effects", () => {
    sys.attachQuest(makeStub(JSON.stringify({ id: "q-001" })) as any);
    sys.save();
    const snap = sys.peekDraft() as WorkspaceDraftSnapshot;
    expect(snap).toBeDefined();
    expect(snap.savedAt).toBeDefined();
    expect(sys.hasDraft()).toBe(true); // still there
  });

  // ── attach chaining ───────────────────────────────────────────────────────

  it("attach() merges multiple systems", () => {
    const q = makeStub(JSON.stringify({ id: "q-001" }));
    const f = makeStub(JSON.stringify({ id: "f-001" }));
    sys.attach({ quest: q as any, faction: f as any });
    const snap = sys.save();
    expect(snap.quest).toBeDefined();
    expect(snap.faction).toBeDefined();
  });
});
