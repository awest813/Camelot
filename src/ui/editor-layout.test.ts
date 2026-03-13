import { describe, it, expect, beforeEach, vi } from "vitest";
import { EditorLayout } from "./editor-layout";
import type { PanelDockState } from "./editor-layout";

describe("EditorLayout — panel management", () => {
  let layout: EditorLayout;

  beforeEach(() => {
    layout = new EditorLayout();
  });

  it("registerPanel adds a panel with default float side", () => {
    layout.registerPanel("hierarchy");
    const state = layout.getPanelState("hierarchy");
    expect(state).not.toBeNull();
    expect(state!.side).toBe("float");
    expect(state!.isVisible).toBe(true);
  });

  it("registerPanel respects provided side and size", () => {
    layout.registerPanel("palette", { side: "left", size: 220 });
    const state = layout.getPanelState("palette");
    expect(state!.side).toBe("left");
    expect(state!.size).toBe(220);
  });

  it("registerPanel does not overwrite existing state without force", () => {
    layout.registerPanel("panel", { side: "left" });
    layout.registerPanel("panel", { side: "right" });
    expect(layout.getPanelState("panel")!.side).toBe("left");
  });

  it("registerPanel with force=true overwrites existing state", () => {
    layout.registerPanel("panel", { side: "left" });
    layout.registerPanel("panel", { side: "right", force: true });
    expect(layout.getPanelState("panel")!.side).toBe("right");
  });

  it("returns null for unknown panel", () => {
    expect(layout.getPanelState("unknown")).toBeNull();
  });

  it("dock changes side and fires onLayoutChanged", () => {
    layout.registerPanel("hierarchy", { side: "float" });
    const changes: PanelDockState[] = [];
    layout.onLayoutChanged = (s) => changes.push(s);

    layout.dock("hierarchy", "left", 240);

    expect(layout.getPanelState("hierarchy")!.side).toBe("left");
    expect(layout.getPanelState("hierarchy")!.size).toBe(240);
    expect(changes).toHaveLength(1);
    expect(changes[0].side).toBe("left");
  });

  it("dock registers the panel automatically if not yet registered", () => {
    layout.dock("newPanel", "right");
    expect(layout.getPanelState("newPanel")!.side).toBe("right");
  });

  it("undock sets side to float and fires onLayoutChanged", () => {
    layout.dock("palette", "left");
    const changes: PanelDockState[] = [];
    layout.onLayoutChanged = (s) => changes.push(s);

    layout.undock("palette");

    expect(layout.getPanelState("palette")!.side).toBe("float");
    expect(changes[0].side).toBe("float");
  });

  it("undock does nothing for unknown panel", () => {
    layout.onLayoutChanged = vi.fn();
    layout.undock("ghost");
    expect(layout.onLayoutChanged).not.toHaveBeenCalled();
  });

  it("setVisible hides and shows panels", () => {
    layout.registerPanel("toolbar");
    layout.setVisible("toolbar", false);
    expect(layout.getPanelState("toolbar")!.isVisible).toBe(false);
    layout.setVisible("toolbar", true);
    expect(layout.getPanelState("toolbar")!.isVisible).toBe(true);
  });

  it("showAll and hideAll toggle all panels", () => {
    layout.registerPanel("a");
    layout.registerPanel("b");
    layout.hideAll();
    expect(layout.allPanels.every(p => !p.isVisible)).toBe(true);
    layout.showAll();
    expect(layout.allPanels.every(p => p.isVisible)).toBe(true);
  });

  it("allPanels returns all registered panels", () => {
    layout.registerPanel("a");
    layout.registerPanel("b");
    layout.registerPanel("c");
    expect(layout.allPanels).toHaveLength(3);
  });

  it("getPanelsBySide returns only panels docked to that side", () => {
    layout.dock("hierarchy", "left");
    layout.dock("palette", "left");
    layout.dock("properties", "right");
    layout.dock("validation", "bottom");

    const left = layout.getPanelsBySide("left");
    expect(left).toHaveLength(2);
    expect(left.map(p => p.panelId)).toContain("hierarchy");
    expect(left.map(p => p.panelId)).toContain("palette");

    expect(layout.getPanelsBySide("bottom")).toHaveLength(1);
    expect(layout.getPanelsBySide("float")).toHaveLength(0);
  });
});

describe("EditorLayout — unified selection model", () => {
  let layout: EditorLayout;

  beforeEach(() => {
    layout = new EditorLayout();
  });

  it("initial selection is null", () => {
    expect(layout.selectedEntityId).toBeNull();
  });

  it("setSelection updates the selected entity", () => {
    layout.setSelection("entity_001");
    expect(layout.selectedEntityId).toBe("entity_001");
  });

  it("isSelected returns true for the selected entity", () => {
    layout.setSelection("entity_001");
    expect(layout.isSelected("entity_001")).toBe(true);
    expect(layout.isSelected("entity_002")).toBe(false);
  });

  it("clearSelection sets selection to null", () => {
    layout.setSelection("entity_001");
    layout.clearSelection();
    expect(layout.selectedEntityId).toBeNull();
  });

  it("onSelectionChanged fires on new selection", () => {
    const changes: Array<string | null> = [];
    layout.onSelectionChanged = (id) => changes.push(id);

    layout.setSelection("entity_001");
    layout.setSelection("entity_002");
    layout.clearSelection();

    expect(changes).toEqual(["entity_001", "entity_002", null]);
  });

  it("onSelectionChanged does NOT fire when selection does not change", () => {
    layout.setSelection("entity_001");
    const changes: Array<string | null> = [];
    layout.onSelectionChanged = (id) => changes.push(id);

    layout.setSelection("entity_001"); // same id — should be a no-op
    expect(changes).toHaveLength(0);
  });

  it("setSelection with null fires onSelectionChanged", () => {
    layout.setSelection("entity_001");
    const changes: Array<string | null> = [];
    layout.onSelectionChanged = (id) => changes.push(id);
    layout.setSelection(null);
    expect(changes).toEqual([null]);
  });
});

describe("EditorLayout — layout serialisation", () => {
  it("getLayoutSnapshot returns a deep-copy of all panel states", () => {
    const layout = new EditorLayout();
    layout.dock("hierarchy", "left", 240);
    layout.dock("properties", "right", 300);

    const snap = layout.getLayoutSnapshot();
    expect(snap).toHaveLength(2);
    // Mutating the snapshot should not affect internal state
    snap[0].size = 999;
    expect(layout.getPanelState("hierarchy")!.size).toBe(240);
  });

  it("restoreLayoutSnapshot restores panel positions", () => {
    const layout = new EditorLayout();
    layout.registerPanel("hierarchy");
    layout.registerPanel("properties");

    const snapshot: PanelDockState[] = [
      { panelId: "hierarchy", side: "left", size: 220, isVisible: true },
      { panelId: "properties", side: "right", size: 280, isVisible: false },
    ];

    layout.restoreLayoutSnapshot(snapshot);

    expect(layout.getPanelState("hierarchy")!.side).toBe("left");
    expect(layout.getPanelState("hierarchy")!.size).toBe(220);
    expect(layout.getPanelState("properties")!.isVisible).toBe(false);
  });

  it("restoreLayoutSnapshot fires onLayoutChanged for each panel", () => {
    const layout = new EditorLayout();
    const fired: string[] = [];
    layout.onLayoutChanged = (s) => fired.push(s.panelId);

    layout.restoreLayoutSnapshot([
      { panelId: "a", side: "left", isVisible: true },
      { panelId: "b", side: "right", isVisible: true },
    ]);

    expect(fired).toContain("a");
    expect(fired).toContain("b");
  });

  it("round-trips a layout snapshot", () => {
    const layout = new EditorLayout();
    layout.dock("hierarchy", "left", 240);
    layout.dock("palette", "bottom", 180);
    layout.setVisible("palette", false);

    const snap = layout.getLayoutSnapshot();

    const layout2 = new EditorLayout();
    layout2.restoreLayoutSnapshot(snap);

    expect(layout2.getPanelState("hierarchy")).toMatchObject({ side: "left", size: 240, isVisible: true });
    expect(layout2.getPanelState("palette")).toMatchObject({ side: "bottom", isVisible: false });
  });
});
