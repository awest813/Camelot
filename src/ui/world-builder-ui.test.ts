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
      expect(toggles.length).toBe(4);

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
    });
  });
});
