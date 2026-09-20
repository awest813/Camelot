import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GraphicsSettingsUI } from "./graphics-settings-ui";
import type { QualityTier } from "../systems/graphics-system";

// ── GraphicsSettingsUI ────────────────────────────────────────────────────────

describe("GraphicsSettingsUI", () => {
  let ui: GraphicsSettingsUI;

  beforeEach(() => {
    // jsdom provides document in Vitest
    ui = new GraphicsSettingsUI();
  });

  afterEach(() => {
    ui.destroy();
  });

  it("starts hidden", () => {
    expect(ui.isVisible).toBe(false);
  });

  it("show() makes the dialog visible", () => {
    ui.show("high");
    expect(ui.isVisible).toBe(true);
    const root = document.querySelector(".graphics-settings") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root!.style.display).toBe("flex");
  });

  it("hide() hides the dialog", () => {
    ui.show("high");
    ui.hide();
    expect(ui.isVisible).toBe(false);
    const root = document.querySelector(".graphics-settings") as HTMLElement | null;
    expect(root!.style.display).toBe("none");
  });

  it("show() highlights the active tier button", () => {
    ui.show("medium");
    const tierGrid = document.querySelector(".graphics-settings__grid")!;
    const cards = tierGrid.querySelectorAll(".graphics-settings__card");
    const labels = Array.from(cards).map((c) => c.querySelector(".graphics-settings__card-label")!.textContent);
    const activeCards = Array.from(cards).filter((c) => c.classList.contains("is-active"));
    expect(activeCards).toHaveLength(1);
    expect(activeCards[0].querySelector(".graphics-settings__card-label")!.textContent).toBe("Medium");
    // Verify all four tier labels are rendered
    expect(labels).toEqual(expect.arrayContaining(["Low", "Medium", "High", "Ultra"]));
  });

  it("renders four tier cards", () => {
    ui.show("high");
    const tierGrid = document.querySelector(".graphics-settings__grid")!;
    expect(tierGrid.querySelectorAll(".graphics-settings__card")).toHaveLength(4);
  });

  it("calls onTierSelect when a tier card is clicked", () => {
    const spy = vi.fn();
    ui.onTierSelect = spy;
    ui.show("high");
    const tierGrid = document.querySelector(".graphics-settings__grid")!;
    const cards = tierGrid.querySelectorAll<HTMLButtonElement>(".graphics-settings__card");
    // Click the first card (Low)
    cards[0].click();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith("low");
  });

  it("calls onClose when the close button is clicked", () => {
    const spy = vi.fn();
    ui.onClose = spy;
    ui.show("high");
    const closeBtn = document.querySelector<HTMLButtonElement>(".graphics-settings__close")!;
    closeBtn.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", () => {
    const spy = vi.fn();
    ui.onClose = spy;
    ui.show("high");
    const root = document.querySelector<HTMLElement>(".graphics-settings")!;
    root.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("calls onClose and hides dialog when Escape key is pressed", () => {
    const spy = vi.fn();
    ui.onClose = spy;
    ui.show("high");
    const root = document.querySelector<HTMLElement>(".graphics-settings")!;
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(spy).toHaveBeenCalledOnce();
    expect(ui.isVisible).toBe(false);
  });

  it("does not call onTierSelect when clicking backdrop", () => {
    const tierSpy = vi.fn();
    ui.onTierSelect = tierSpy;
    ui.show("high");
    const root = document.querySelector<HTMLElement>(".graphics-settings")!;
    root.click();
    expect(tierSpy).not.toHaveBeenCalled();
  });

  it("destroy() removes the DOM element", () => {
    ui.show("high");
    expect(document.querySelector(".graphics-settings")).not.toBeNull();
    ui.destroy();
    expect(document.querySelector(".graphics-settings")).toBeNull();
    expect(ui.isVisible).toBe(false);
  });

  it("calling show() multiple times reuses the same DOM element", () => {
    ui.show("low");
    ui.show("ultra");
    const roots = document.querySelectorAll(".graphics-settings");
    expect(roots).toHaveLength(1);
  });

  it.each<QualityTier>(["low", "medium", "high", "ultra"])(
    "show('%s') marks only that card as active",
    (tier) => {
      ui.show(tier);
      const tierGrid = document.querySelector(".graphics-settings__grid")!;
      const activeCards = tierGrid.querySelectorAll(".graphics-settings__card.is-active");
      expect(activeCards).toHaveLength(1);
      const active = activeCards[0] as HTMLElement;
      expect(active.querySelector(".graphics-settings__card-label")!.textContent!.toLowerCase()).toBe(tier);
    },
  );

  // ── Difficulty row ──────────────────────────────────────────────────────────

  it("renders three difficulty cards", () => {
    ui.show("high");
    const grids = document.querySelectorAll(".graphics-settings__grid");
    expect(grids.length).toBeGreaterThanOrEqual(2);
    const diffGrid = grids[grids.length - 1]!;
    expect(diffGrid.querySelectorAll(".graphics-settings__card")).toHaveLength(3);
  });

  it("marks the current difficulty active and fires onDifficultySelect on click", () => {
    const spy = vi.fn();
    ui.onDifficultySelect = spy;
    ui.show("high", "hard");
    const grids = document.querySelectorAll(".graphics-settings__grid");
    const diffGrid = grids[grids.length - 1]!;
    const active = diffGrid.querySelectorAll(".graphics-settings__card.is-active");
    expect(active).toHaveLength(1);
    expect(active[0].querySelector(".graphics-settings__card-label")!.textContent).toBe("Hard");

    const cards = diffGrid.querySelectorAll<HTMLButtonElement>(".graphics-settings__card");
    cards[0].click(); // Easy
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith("easy");
  });

  // ── Audio controls ─────────────────────────────────────────────────────────

  it("renders audio mute toggle and volume preset buttons", () => {
    ui.show("high", "normal", false, 0.5);
    const audioRow = document.querySelector(".graphics-settings__audio-row")!;
    expect(audioRow).not.toBeNull();
    const chips = audioRow.querySelectorAll<HTMLButtonElement>(".graphics-settings__chip-btn");
    expect(chips).toHaveLength(5); // 1 mute button + 4 volume presets
    expect(chips[0].textContent).toContain("Mute Audio");
    const activeVol = audioRow.querySelector(".graphics-settings__chip-btn.is-active");
    expect(activeVol?.textContent).toContain("50%");
  });

  it("toggles mute state and calls onAudioMuteToggle callback", () => {
    const spy = vi.fn();
    ui.onAudioMuteToggle = spy;
    ui.show("high", "normal", false, 0.75);

    const audioRow = document.querySelector(".graphics-settings__audio-row")!;
    const muteBtn = audioRow.querySelectorAll<HTMLButtonElement>(".graphics-settings__chip-btn")[0]!;
    muteBtn.click();
    expect(spy).toHaveBeenCalledWith(true);
    expect(muteBtn.textContent).toContain("Unmute Audio");
    expect(muteBtn.classList.contains("is-active")).toBe(true);

    muteBtn.click();
    expect(spy).toHaveBeenCalledWith(false);
    expect(muteBtn.textContent).toContain("Mute Audio");
  });

  it("changes volume and calls onVolumeChange callback", () => {
    const spy = vi.fn();
    ui.onVolumeChange = spy;
    ui.show("high", "normal", false, 0.5);

    const audioRow = document.querySelector(".graphics-settings__audio-row")!;
    const volChips = audioRow.querySelectorAll<HTMLButtonElement>(".graphics-settings__chip-btn");
    // volChips[3] is 75%
    volChips[3].click();
    expect(spy).toHaveBeenCalledWith(0.75);
    expect(volChips[3].classList.contains("is-active")).toBe(true);
  });

  // ── Camera Sensitivity ─────────────────────────────────────────────────────

  it("renders camera sensitivity buttons and highlights active sensitivity", () => {
    ui.show("high", "normal", false, 0.5, "high");
    const sensRow = document.querySelector(".graphics-settings__sens-row")!;
    expect(sensRow).not.toBeNull();
    const sensChips = sensRow.querySelectorAll<HTMLButtonElement>(".graphics-settings__chip-btn");
    expect(sensChips).toHaveLength(3);
    const active = sensRow.querySelector(".graphics-settings__chip-btn.is-active");
    expect(active?.textContent).toContain("High");
  });

  it("calls onCameraSensitivityChange when sensitivity preset is clicked", () => {
    const spy = vi.fn();
    ui.onCameraSensitivityChange = spy;
    ui.show("high", "normal", false, 0.5, "standard");

    const sensRow = document.querySelector(".graphics-settings__sens-row")!;
    const sensChips = sensRow.querySelectorAll<HTMLButtonElement>(".graphics-settings__chip-btn");
    sensChips[0].click(); // low
    expect(spy).toHaveBeenCalledWith("low");
    expect(sensChips[0].classList.contains("is-active")).toBe(true);
  });

  // ── Status Bar ─────────────────────────────────────────────────────────────

  it("displays live status feedback updates", () => {
    ui.show("high");
    const statusEl = document.querySelector(".graphics-settings__status-bar span")!;
    expect(statusEl).not.toBeNull();
    expect(statusEl.textContent).toBe("Ready");

    ui.showStatus("Settings updated successfully");
    expect(statusEl.textContent).toBe("Settings updated successfully");
  });
});

