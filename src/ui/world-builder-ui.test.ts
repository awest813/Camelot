/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorldBuilderSystem } from "../systems/world-builder-system";
import { WorldBuilderUI } from "./world-builder-ui";

vi.mock("./dialog-focus", () => ({
  manageDialogFocus: vi.fn(() => ({ release: vi.fn() })),
}));

describe("WorldBuilderUI", () => {
  let sys: WorldBuilderSystem;
  let ui: WorldBuilderUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    sys = new WorldBuilderSystem();
    ui = new WorldBuilderUI(sys);
  });

  describe("Lifecycle & Visibility", () => {
    it("is not visible initially", () => {
      expect(ui.isVisible).toBe(false);
    });

    it("open() makes the overlay visible and creates the DOM dialog", () => {
      ui.open();
      expect(ui.isVisible).toBe(true);

      const dialog = document.querySelector(".world-builder");
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute("role")).toBe("dialog");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
    });

    it("close() hides the dialog and triggers onClose callback", () => {
      const onCloseSpy = vi.fn();
      ui.onClose = onCloseSpy;

      ui.open();
      expect(ui.isVisible).toBe(true);

      ui.close();
      expect(ui.isVisible).toBe(false);
      expect(onCloseSpy).toHaveBeenCalledOnce();
    });

    it("destroy() unmounts dialog from DOM", () => {
      ui.open();
      expect(document.querySelector(".world-builder")).not.toBeNull();

      ui.destroy();
      expect(document.querySelector(".world-builder")).toBeNull();
      expect(ui.isVisible).toBe(false);
    });
  });

  describe("Controls & Interaction", () => {
    beforeEach(() => {
      ui.open();
    });

    it("syncs initial seed to input field", () => {
      const seedInput = document.querySelector<HTMLInputElement>('input[data-field="seed"]');
      expect(seedInput).not.toBeNull();
      expect(seedInput?.value).toBe(sys.config.seed);
    });

    it("randomizes seed on Rand button click", () => {
      const randBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("Rand"),
      );
      expect(randBtn).toBeDefined();

      const oldSeed = sys.config.seed;
      randBtn?.click();
      expect(sys.config.seed).not.toBe(oldSeed);
      expect(typeof sys.config.seed).toBe("string");
    });

    it("loads a preset when selected and 'Load' is clicked", () => {
      const presetSelect = document.querySelector<HTMLSelectElement>(".world-builder__select");
      expect(presetSelect).not.toBeNull();

      // Change select to frostpeak_reach
      presetSelect!.value = "frostpeak_reach";

      const loadBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Load",
      );
      expect(loadBtn).toBeDefined();
      loadBtn?.click();

      expect(sys.config.seed).toBe("Frostpeak");
      expect(sys.config.worldType).toBe("amplified");
      expect(sys.config.startingBiome).toBe("tundra");
    });

    it("adds a new custom region on '+ Add Region' click", () => {
      const initialRegionCount = sys.regions.length;
      const addBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("+ Add Region"),
      );
      expect(addBtn).toBeDefined();
      addBtn?.click();

      expect(sys.regions.length).toBe(initialRegionCount + 1);

      const items = document.querySelectorAll(".world-builder__region-item");
      expect(items.length).toBe(sys.regions.length);
    });

    it("triggers onApplyToWorld with a WorldSeed and config", () => {
      const applySpy = vi.fn();
      ui.onApplyToWorld = applySpy;

      const applyBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("Apply to Game World"),
      );
      expect(applyBtn).toBeDefined();
      applyBtn?.click();

      expect(applySpy).toHaveBeenCalledOnce();
      const [seed, config] = applySpy.mock.calls[0];
      expect(seed).toBeDefined();
      expect(seed.seedString).toBe(sys.config.seed);
      expect(config.worldType).toBe(sys.config.worldType);
    });

    it("validates configuration and displays status", () => {
      const valBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Validate",
      );
      expect(valBtn).toBeDefined();
      valBtn?.click();

      const statusEl = document.querySelector(".world-builder__status");
      expect(statusEl?.textContent).toContain("Validation passed");
    });

    it("generates an Arthurian region on '🎲 Arthurian Region' click", () => {
      const initialRegionCount = sys.regions.length;
      const arthurianBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("Arthurian Region"),
      );
      expect(arthurianBtn).toBeDefined();
      arthurianBtn?.click();

      expect(sys.regions.length).toBe(initialRegionCount + 1);
      const newRegion = sys.regions[sys.regions.length - 1];
      expect(newRegion.name).toBeTruthy();
      expect(newRegion.dangerLevel).toBeGreaterThanOrEqual(1);

      const items = document.querySelectorAll(".world-builder__region-item");
      expect(items.length).toBe(sys.regions.length);
    });

    it("renders layer checkboxes and allows toggling layers", () => {
      const toggles = document.querySelectorAll<HTMLInputElement>(".world-builder__layer-toggle input[type='checkbox']");
      expect(toggles.length).toBe(9);

      const renderSpy = vi.spyOn(ui, "renderPreview");

      // Toggle relief
      toggles[0].checked = false;
      toggles[0].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalled();

      // Toggle rivers
      toggles[1].checked = false;
      toggles[1].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalledTimes(2);

      // Toggle provinces
      toggles[2].checked = false;
      toggles[2].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalledTimes(3);

      // Toggle roads
      toggles[3].checked = false;
      toggles[3].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalledTimes(4);

      // Toggle towns
      toggles[4].checked = false;
      toggles[4].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalledTimes(5);

      // Toggle dungeons
      toggles[5].checked = false;
      toggles[5].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalledTimes(6);

      // Toggle climate heatmap
      toggles[6].checked = true;
      toggles[6].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalledTimes(7);

      // Toggle danger heatmap
      toggles[7].checked = true;
      toggles[7].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalledTimes(8);

      // Toggle resources
      toggles[8].checked = true;
      toggles[8].dispatchEvent(new Event("change"));
      expect(renderSpy).toHaveBeenCalledTimes(9);
    });

    it("opens chunk inspector on canvas click and displays cell features", () => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      expect(canvas).not.toBeNull();

      vi.spyOn(canvas!, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 360,
        height: 360,
        right: 360,
        bottom: 360,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Click center of canvas (row ~7, col ~7 which is near origin cx=0, cz=0)
      canvas!.dispatchEvent(new MouseEvent("click", { clientX: 180, clientY: 180 }));

      const inspector = document.querySelector<HTMLElement>(".world-builder__chunk-inspector");
      expect(inspector).not.toBeNull();
      expect(inspector?.style.display).toBe("block");
      expect(inspector?.textContent).toContain("Chunk");
      expect(inspector?.textContent).toContain("Elevation");
      expect(inspector?.textContent).toContain("Temperature");
      expect(inspector?.textContent).toContain("Moisture");

      // Test + Region Around Chunk from inspector
      const addRegBtn = Array.from(inspector!.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("+ Region Around Chunk"),
      );
      expect(addRegBtn).toBeDefined();
      const prevRegionCount = sys.regions.length;
      addRegBtn!.click();
      expect(sys.regions.length).toBe(prevRegionCount + 1);
    });

    it("toggles accordion region item expansion and edits region properties live", () => {
      // Add a test region
      sys.addRegion({
        id: "reg_test_accordion",
        name: "Accordion Valley",
        bounds: { minCX: -1, minCZ: -1, maxCX: 1, maxCZ: 1 },
        biome: "plains",
        dangerLevel: 4,
        encounterRate: 1.0,
      });

      // Force UI refresh of region list
      const addBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("+ Add Region"),
      );
      addBtn?.click();

      const items = document.querySelectorAll(".world-builder__region-item");
      expect(items.length).toBeGreaterThan(0);

      // The newly added region is auto-expanded
      const expandedForm = document.querySelector(".world-builder__region-edit-form");
      expect(expandedForm).not.toBeNull();

      // Test editing region name
      const nameInput = expandedForm!.querySelector<HTMLInputElement>("input[type='text']");
      expect(nameInput).not.toBeNull();
      nameInput!.value = "Updated Region Name";
      nameInput!.dispatchEvent(new Event("input"));

      const latestReg = sys.regions[sys.regions.length - 1];
      expect(latestReg.name).toBe("Updated Region Name");

      // Test expand bounds button
      const expandBtn = Array.from(expandedForm!.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("+ Expand"),
      );
      expect(expandBtn).toBeDefined();
      const oldMaxCX = latestReg.bounds.maxCX;
      expandBtn!.click();
      const afterExpandReg = sys.regions[sys.regions.length - 1];
      expect(afterExpandReg.bounds.maxCX).toBe(oldMaxCX + 1);
    });

    it("paints chunk cells and regions on canvas when 2D context is available", () => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      expect(canvas).not.toBeNull();

      const mockCtx = {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        setLineDash: vi.fn(),
        fillText: vi.fn(),
      };

      vi.spyOn(canvas!, "getContext").mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);

      ui.renderPreview();

      expect(mockCtx.clearRect).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it("handles custom preset save, select visibility, and deletion", () => {
      const presetSelect = document.querySelector<HTMLSelectElement>(".world-builder__select");
      const delBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.title === "Delete this custom preset",
      );
      expect(delBtn).toBeDefined();
      expect(delBtn?.style.display).toBe("none");

      // Save a custom preset
      const nameInput = document.querySelector<HTMLInputElement>('input[data-field="preset-name"]');
      const saveBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Save Preset",
      );
      nameInput!.value = "My Custom Realm";
      saveBtn!.click();

      // Should now be selected and delete button visible
      expect(presetSelect?.value).toBe("my_custom_realm");
      expect(delBtn?.style.display).toBe("inline-block");

      // Click delete preset
      delBtn!.click();
      expect(sys.getAllPresets().some((p) => p.id === "my_custom_realm")).toBe(false);
      expect(delBtn?.style.display).toBe("none");
    });

    it("navigates canvas chunks with keyboard arrow keys, home, and space/enter", () => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      expect(canvas).not.toBeNull();

      // Keydown ArrowRight
      canvas!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      let inspector = document.querySelector<HTMLElement>(".world-builder__chunk-inspector");
      expect(inspector?.style.display).toBe("block");
      expect(inspector?.textContent).toContain("Chunk (1, 0)");

      // Keydown ArrowDown
      canvas!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      expect(inspector?.textContent).toContain("Chunk (1, 1)");

      // Keydown Home (returns to 0, 0)
      canvas!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      expect(inspector?.textContent).toContain("Chunk (0, 0)");

      // Space key re-inspects
      canvas!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      expect(inspector?.textContent).toContain("Chunk (0, 0)");
    });

    it("filters custom regions by search query", () => {
      sys.addRegion({
        id: "reg_camelot_forest",
        name: "Camelot High Forest",
        bounds: { minCX: 0, minCZ: 0, maxCX: 2, maxCZ: 2 },
        biome: "forest",
        dangerLevel: 3,
        encounterRate: 1.0,
        description: "Crown land surrounding Camelot Castle.",
      });
      sys.addRegion({
        id: "reg_wasteland",
        name: "Grim Moor",
        bounds: { minCX: 5, minCZ: 5, maxCX: 8, maxCZ: 8 },
        biome: "tundra",
        dangerLevel: 7,
        encounterRate: 1.5,
        description: "Barren freezing marshland.",
      });

      // Trigger re-render of regions
      const searchInput = document.querySelector<HTMLInputElement>(".world-builder__search-input");
      expect(searchInput).not.toBeNull();

      // Search for "camelot"
      searchInput!.value = "camelot";
      searchInput!.dispatchEvent(new Event("input"));

      let items = document.querySelectorAll(".world-builder__region-item");
      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain("Camelot High Forest");

      // Search for non-existent text
      searchInput!.value = "nonexistent_zone";
      searchInput!.dispatchEvent(new Event("input"));

      items = document.querySelectorAll(".world-builder__region-item");
      expect(items.length).toBe(0);
      const emptyMsg = document.querySelector(".world-builder__empty");
      expect(emptyMsg?.textContent).toContain('No regions match search "nonexistent_zone"');

      // Clear search
      searchInput!.value = "";
      searchInput!.dispatchEvent(new Event("input"));
      items = document.querySelectorAll(".world-builder__region-item");
      expect(items.length).toBe(sys.regions.length);
    });

    it("duplicates an existing region on 'Duplicate' click", () => {
      sys.addRegion({
        id: "reg_to_dup",
        name: "Emerald Glade",
        bounds: { minCX: 1, minCZ: 1, maxCX: 3, maxCZ: 3 },
        biome: "plains",
        dangerLevel: 2,
        encounterRate: 1.0,
      });

      // Refresh list by clicking "+ Add Region" then checking
      const searchInput = document.querySelector<HTMLInputElement>(".world-builder__search-input");
      searchInput!.value = "";
      searchInput!.dispatchEvent(new Event("input"));

      const dupBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.getAttribute("aria-label")?.includes("Duplicate region Emerald Glade"),
      );
      expect(dupBtn).toBeDefined();

      const prevCount = sys.regions.length;
      dupBtn!.click();

      expect(sys.regions.length).toBe(prevCount + 1);
      const cloned = sys.regions.find((r) => r.name.includes("Emerald Glade (Copy)"));
      expect(cloned).toBeDefined();
      expect(cloned?.bounds).toEqual({ minCX: 1, minCZ: 1, maxCX: 3, maxCZ: 3 });
    });

    it("requires 2-step confirmation to remove a region and resets on timeout", () => {
      vi.useFakeTimers();
      sys.addRegion({
        id: "reg_safe_del",
        name: "Fragile Sanctuary",
        bounds: { minCX: 0, minCZ: 0, maxCX: 1, maxCZ: 1 },
        biome: "plains",
        dangerLevel: 1,
        encounterRate: 1.0,
      });

      // Refresh list
      const searchInput = document.querySelector<HTMLInputElement>(".world-builder__search-input");
      searchInput!.value = "";
      searchInput!.dispatchEvent(new Event("input"));

      const removeBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.getAttribute("aria-label")?.includes("Remove region Fragile Sanctuary"),
      );
      expect(removeBtn).toBeDefined();
      expect(removeBtn?.textContent).toBe("Remove");

      // First click: does not delete, arms confirmation
      removeBtn!.click();
      expect(sys.regions.some((r) => r.id === "reg_safe_del")).toBe(true);

      const confirmBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.getAttribute("aria-label")?.includes("Confirm removal of region Fragile Sanctuary"),
      );
      expect(confirmBtn).toBeDefined();
      expect(confirmBtn?.textContent).toBe("Confirm?");

      // Wait 3.5s without clicking -> resets back to "Remove"
      vi.advanceTimersByTime(3500);

      const revertedBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.getAttribute("aria-label")?.includes("Remove region Fragile Sanctuary"),
      );
      expect(revertedBtn).toBeDefined();
      expect(revertedBtn?.textContent).toBe("Remove");

      // Now click twice to actually remove
      revertedBtn!.click();
      const confirmBtn2 = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.getAttribute("aria-label")?.includes("Confirm removal of region Fragile Sanctuary"),
      );
      confirmBtn2!.click();

      expect(sys.regions.some((r) => r.id === "reg_safe_del")).toBe(false);
      vi.useRealTimers();
    });

    it("copies chunk coords and deselects chunk from inspector", () => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      canvas!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

      const inspector = document.querySelector<HTMLElement>(".world-builder__chunk-inspector");
      expect(inspector?.style.display).toBe("block");

      // Copy Coords button
      const copyBtn = Array.from(inspector!.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("Copy Coords"),
      );
      expect(copyBtn).toBeDefined();
      copyBtn!.click();

      const statusEl = document.querySelector(".world-builder__status");
      expect(statusEl?.textContent).toContain("chunk: (0, 0)");

      // Deselect button
      const deselectBtn = Array.from(inspector!.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Deselect",
      );
      expect(deselectBtn).toBeDefined();
      deselectBtn!.click();

      expect(inspector?.style.display).toBe("none");
    });

    it("closes the dialog when Escape key is pressed", () => {
      expect(ui.isVisible).toBe(true);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(ui.isVisible).toBe(false);
    });

    it("displays warning badge when a region has empty name or invalid bounds", () => {
      sys.addRegion({
        id: "reg_invalid",
        name: "",
        bounds: { minCX: 5, minCZ: 5, maxCX: 2, maxCZ: 2 }, // min > max
        biome: "desert",
        dangerLevel: 5,
        encounterRate: 1.0,
      });

      const searchInput = document.querySelector<HTMLInputElement>(".world-builder__search-input");
      searchInput!.value = "";
      searchInput!.dispatchEvent(new Event("input"));

      const badge = document.querySelector(".world-builder__badge--warn");
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain("Invalid");
    });

    it("generates 5 Arthurian Kingdom regions on '👑 Kingdom' click", () => {
      const kingdomBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("Kingdom"),
      );
      expect(kingdomBtn).toBeDefined();

      kingdomBtn!.click();

      expect(sys.regions.length).toBe(5);
      const regionNames = sys.regions.map((r) => r.name);
      expect(regionNames).toContain("Camelot Crownlands");
      expect(regionNames).toContain("Brocéliande Enchanted Forest");
      expect(regionNames).toContain("Misty Isle of Avalon");

      const items = document.querySelectorAll(".world-builder__region-item");
      expect(items.length).toBe(5);
    });

    it("opens analytics modal on '📊 Analytics' click and shows metrics", () => {
      const analyticsBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("Analytics"),
      );
      expect(analyticsBtn).toBeDefined();

      analyticsBtn!.click();

      const modal = document.querySelector(".world-builder__analytics-modal");
      expect(modal).not.toBeNull();
      expect(modal?.textContent).toContain("Realm Analytics & Demographics");
      expect(modal?.textContent).toContain("Surveyed Area");
      expect(modal?.textContent).toContain("Terrain & Biome Composition");

      // Close modal using Done button
      const doneBtn = Array.from(modal!.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Done",
      );
      expect(doneBtn).toBeDefined();
      doneBtn!.click();

      expect(document.querySelector(".world-builder__analytics-modal")).toBeNull();
    });

    it("displays resource deposits in chunk inspector if chunk contains resources", () => {
      // Inject a cell sample with resource nodes
      const inspector = document.querySelector<HTMLElement>(".world-builder__chunk-inspector");
      const sampleCell = sys.sampleGrid(1, 0, 0)[0][0];
      sampleCell.resourceNodes = [
        {
          id: "res_iron_1",
          type: "iron_ore",
          name: "Iron Ore Vein",
          cx: sampleCell.cx,
          cz: sampleCell.cz,
          richness: 3,
          rarity: "common",
        },
        {
          id: "res_mithril_1",
          type: "mithril_ore",
          name: "Mithril Outcrop",
          cx: sampleCell.cx,
          cz: sampleCell.cz,
          richness: 5,
          rarity: "rare",
        },
      ];

      // Invoke chunk inspector via private method
      (ui as any)._renderChunkInspector(sampleCell);

      expect(inspector?.style.display).toBe("block");
      expect(inspector?.textContent).toContain("Resource Deposits");
      expect(inspector?.textContent).toContain("Iron");
      expect(inspector?.textContent).toContain("Mithril");
    });
  });
});


describe("WorldBuilderUI — analytics modal lifecycle", () => {
  let sys: WorldBuilderSystem;
  let ui: WorldBuilderUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    sys = new WorldBuilderSystem();
    ui = new WorldBuilderUI(sys);
    ui.open();
  });

  function openAnalytics(): HTMLElement {
    const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent?.includes("Analytics"),
    );
    btn!.click();
    return document.querySelector<HTMLElement>(".world-builder__analytics-modal")!;
  }

  it("removes the analytics modal when clicking Done, the ✕ button, or the backdrop", () => {
    const modal = openAnalytics();
    expect(modal).not.toBeNull();

    // Backdrop click dismisses
    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".world-builder__analytics-modal")).toBeNull();

    const modal2 = openAnalytics();
    const closeX = Array.from(modal2.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.getAttribute("aria-label") === "Close analytics",
    );
    closeX!.click();
    expect(document.querySelector(".world-builder__analytics-modal")).toBeNull();

    const modal3 = openAnalytics();
    const done = Array.from(modal3.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent === "Done",
    );
    done!.click();
    expect(document.querySelector(".world-builder__analytics-modal")).toBeNull();
  });

  it("does not stack a second modal when Analytics is clicked twice", () => {
    openAnalytics();
    openAnalytics();
    const modals = document.querySelectorAll(".world-builder__analytics-modal");
    expect(modals.length).toBe(1);
  });

  it("Escape closes the analytics modal first and keeps the builder open", () => {
    openAnalytics();
    expect(document.querySelector(".world-builder__analytics-modal")).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".world-builder__analytics-modal")).toBeNull();
    expect(ui.isVisible).toBe(true);

    // Second Escape closes the builder itself
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(ui.isVisible).toBe(false);
  });

  it("leaves no stale modal behind after close() and reopen", () => {
    openAnalytics();
    ui.close();
    ui.open();
    expect(document.querySelector(".world-builder__analytics-modal")).toBeNull();
  });
});
