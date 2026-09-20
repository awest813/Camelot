/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Minimal stubs for DialogueCreatorSystem ────────────────────────────────────

function makeSystem() {
  return {
    draft: { id: "dlg_test", startNodeId: "node_1", nodes: [] as unknown[] },
    nodes: [] as unknown[],
    setMeta: vi.fn(),
    addNode: vi.fn(() => "node_new"),
    removeNode: vi.fn(),
    updateNode: vi.fn(),
    addChoice: vi.fn(() => "c_new"),
    removeChoice: vi.fn(),
    updateChoice: vi.fn(),
    exportJSON: vi.fn(() => "{}"),
    importJSON: vi.fn(),
    clear: vi.fn(),
  };
}

// Stub manageDialogFocus
vi.mock("./dialog-focus", () => ({
  manageDialogFocus: vi.fn(() => ({ release: vi.fn() })),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────
import { DialogueCreatorUI } from "./dialogue-creator-ui";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("DialogueCreatorUI", () => {
  let ui: DialogueCreatorUI;
  let sys: ReturnType<typeof makeSystem>;

  beforeEach(() => {
    document.body.innerHTML = "";
    sys = makeSystem();
    ui = new DialogueCreatorUI(sys as never);
  });

  it("is not visible before open()", () => {
    expect(ui.isVisible).toBe(false);
  });

  it("open() makes the UI visible", () => {
    ui.open();
    expect(ui.isVisible).toBe(true);
  });

  it("close() makes the UI invisible", () => {
    ui.open();
    ui.close();
    expect(ui.isVisible).toBe(false);
  });

  it("open() appends a DOM element", () => {
    expect(document.body.children).toHaveLength(0);
    ui.open();
    expect(document.body.children.length).toBeGreaterThan(0);
  });

  it("close() fires onClose callback", () => {
    const cb = vi.fn();
    ui.onClose = cb;
    ui.open();
    ui.close();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("second open() reuses existing root (no duplicate DOM nodes)", () => {
    ui.open();
    const count1 = document.body.children.length;
    ui.close();
    ui.open();
    expect(document.body.children.length).toBe(count1);
  });

  it("Escape keydown closes the UI", () => {
    ui.open();
    expect(ui.isVisible).toBe(true);

    // Dispatch on the root element
    const root = document.body.firstElementChild as HTMLElement;
    const evt = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    root.dispatchEvent(evt);

    expect(ui.isVisible).toBe(false);
  });

  it("Escape keydown fires onClose callback", () => {
    const cb = vi.fn();
    ui.onClose = cb;
    ui.open();
    const root = document.body.firstElementChild as HTMLElement;
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(cb).toHaveBeenCalledOnce();
  });

  it("non-Escape keydown does not close the UI", () => {
    ui.open();
    const root = document.body.firstElementChild as HTMLElement;
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(ui.isVisible).toBe(true);
  });

  it("populates inputs from draft data on open()", () => {
    ui.open();
    // The system's draft.id should be readable — we verify open() doesn't throw
    // and that the root element exists (sync reads draft.id and draft.startNodeId)
    expect(document.body.firstElementChild).not.toBeNull();
  });

  it("isVisible is false initially even after close() is called without open()", () => {
    expect(() => ui.close()).not.toThrow();
    expect(ui.isVisible).toBe(false);
  });
});
