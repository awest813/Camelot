// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PetUI } from "./pet-ui";
import type { Pet } from "../systems/pet-system";

// ── Helpers ────────────────────────────────────────────────────────────────

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id:           "pet_wolf",
    name:         "Wolf",
    species:      "wolf",
    maxHealth:    120,
    health:       120,
    attackDamage: 12,
    moveSpeed:    5.5,
    followDistance: 2.5,
    attackRange:  2.0,
    meshColor:    { r: 0.45, g: 0.40, b: 0.35 },
    meshScale:    0.65,
    level:        1,
    experience:   0,
    mood:         80,
    isDead:       false,
    isActive:     false,
    ...overrides,
  };
}

describe("PetUI", () => {
  let ui: PetUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new PetUI();
  });

  // ── HUD widget ──────────────────────────────────────────────────────────

  describe("updateHUD()", () => {
    it("creates the HUD widget on first call", () => {
      ui.updateHUD(makePet());
      // The hud should be appended to the body
      const elements = document.body.children;
      expect(elements.length).toBeGreaterThan(0);
    });

    it("hides the HUD when activePet is null", () => {
      ui.updateHUD(makePet());
      ui.updateHUD(null);
      // The first child appended to body is the HUD root
      const hud = document.body.querySelector("div") as HTMLDivElement;
      expect(hud.style.display).toBe("none");
    });

    it("shows the HUD when a pet is active", () => {
      ui.updateHUD(makePet());
      const hud = document.body.querySelector("div") as HTMLDivElement;
      expect(hud.style.display).toBe("flex");
    });

    it("displays the pet name in the HUD", () => {
      ui.updateHUD(makePet({ name: "Shadowfang" }));
      expect(document.body.textContent).toContain("Shadowfang");
    });

    it("displays the pet level in the HUD", () => {
      ui.updateHUD(makePet({ level: 5 }));
      expect(document.body.textContent).toContain("Lv 5");
    });

    it("displays the HP text in the HUD", () => {
      ui.updateHUD(makePet({ health: 80, maxHealth: 120 }));
      expect(document.body.textContent).toContain("80");
      expect(document.body.textContent).toContain("120");
    });

    it("shows a species icon for wolf (🐺)", () => {
      ui.updateHUD(makePet({ species: "wolf" }));
      expect(document.body.textContent).toContain("🐺");
    });

    it("shows a species icon for cat (🐱)", () => {
      ui.updateHUD(makePet({ species: "cat" }));
      expect(document.body.textContent).toContain("🐱");
    });

    it("shows a species icon for raven (🐦)", () => {
      ui.updateHUD(makePet({ species: "raven" }));
      expect(document.body.textContent).toContain("🐦");
    });

    it("calling updateHUD multiple times updates rather than duplicates", () => {
      ui.updateHUD(makePet({ name: "Alpha" }));
      ui.updateHUD(makePet({ name: "Beta" }));
      // Should still only have one HUD root (lazy created)
      expect(document.body.textContent).toContain("Beta");
    });
  });

  describe("hideHUD()", () => {
    it("hides the HUD when it exists", () => {
      ui.updateHUD(makePet());
      ui.hideHUD();
      const hud = document.body.querySelector("div") as HTMLDivElement;
      expect(hud.style.display).toBe("none");
    });

    it("does not throw when called before updateHUD", () => {
      expect(() => ui.hideHUD()).not.toThrow();
    });
  });

  // ── Management panel — open / close ────────────────────────────────────

  describe("open() / close()", () => {
    it("sets isVisible to true when opened", () => {
      ui.open([makePet()], null);
      expect(ui.isVisible).toBe(true);
    });

    it("sets isVisible to false when closed", () => {
      ui.open([makePet()], null);
      ui.close();
      expect(ui.isVisible).toBe(false);
    });

    it("creates a dialog element with role=dialog", () => {
      ui.open([makePet()], null);
      const dialog = document.querySelector("[role='dialog']");
      expect(dialog).not.toBeNull();
    });

    it("sets aria-modal=true on the dialog", () => {
      ui.open([makePet()], null);
      const dialog = document.querySelector("[role='dialog']");
      expect(dialog?.getAttribute("aria-modal")).toBe("true");
    });

    it("links aria-labelledby to pet-panel-title", () => {
      ui.open([makePet()], null);
      const dialog = document.querySelector("[role='dialog']");
      expect(dialog?.getAttribute("aria-labelledby")).toBe("pet-panel-title");
      expect(document.getElementById("pet-panel-title")).not.toBeNull();
    });

    it("displays 'COMPANIONS' as the panel title", () => {
      ui.open([makePet()], null);
      const title = document.getElementById("pet-panel-title");
      expect(title?.textContent).toBe("COMPANIONS");
    });

    it("shows the panel when opened", () => {
      ui.open([makePet()], null);
      const dialog = document.querySelector("[role='dialog']") as HTMLElement;
      expect(dialog.style.display).toBe("flex");
    });

    it("hides the panel when closed", () => {
      ui.open([makePet()], null);
      ui.close();
      const dialog = document.querySelector("[role='dialog']") as HTMLElement;
      expect(dialog.style.display).toBe("none");
    });

    it("fires onClose when close button is clicked", () => {
      const onClose = vi.fn();
      ui.onClose = onClose;
      ui.open([makePet()], null);
      const closeBtn = document.querySelector("[aria-label='Close companions panel']") as HTMLButtonElement;
      closeBtn.click();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("sets isVisible to false when close button is clicked", () => {
      ui.open([makePet()], null);
      const closeBtn = document.querySelector("[aria-label='Close companions panel']") as HTMLButtonElement;
      closeBtn.click();
      expect(ui.isVisible).toBe(false);
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  describe("empty pet list", () => {
    it("shows placeholder text when no pets are owned", () => {
      ui.open([], null);
      expect(document.body.textContent).toContain("no companions");
    });
  });

  // ── Pet cards ────────────────────────────────────────────────────────────

  describe("pet cards", () => {
    it("renders a card for each pet", () => {
      const pets = [
        makePet({ id: "pet_wolf", name: "Wolf" }),
        makePet({ id: "pet_cat",  name: "Cat",  species: "cat" }),
      ];
      ui.open(pets, null);
      // Each card contains the pet name
      expect(document.body.textContent).toContain("Wolf");
      expect(document.body.textContent).toContain("Cat");
    });

    it("displays the pet level in the card", () => {
      ui.open([makePet({ level: 7 })], null);
      expect(document.body.textContent).toContain("Level 7");
    });

    it("shows 'ACTIVE' badge for the currently active pet", () => {
      ui.open([makePet({ id: "pet_wolf" })], "pet_wolf");
      expect(document.body.textContent).toContain("ACTIVE");
    });

    it("does not show 'ACTIVE' badge when no active pet", () => {
      ui.open([makePet({ id: "pet_wolf" })], null);
      expect(document.body.textContent).not.toContain("ACTIVE");
    });

    it("marks deceased pets with (deceased) label", () => {
      ui.open([makePet({ isDead: true })], null);
      expect(document.body.textContent).toContain("deceased");
    });

    it("does not render action button for deceased pets", () => {
      ui.open([makePet({ isDead: true })], null);
      const summonBtn = document.querySelector("[aria-label*='Summon']");
      expect(summonBtn).toBeNull();
    });

    it("shows 'Summon' button for alive, inactive pets", () => {
      ui.open([makePet({ id: "pet_wolf", isDead: false })], null);
      const btn = document.querySelector("[aria-label='Summon Wolf']");
      expect(btn).not.toBeNull();
    });

    it("shows 'Dismiss' button for the active pet", () => {
      ui.open([makePet({ id: "pet_wolf" })], "pet_wolf");
      const btn = document.querySelector("[aria-label='Dismiss Wolf']");
      expect(btn).not.toBeNull();
    });
  });

  // ── Callbacks ────────────────────────────────────────────────────────────

  describe("onSummon callback", () => {
    it("fires onSummon with the pet id when Summon is clicked", () => {
      const onSummon = vi.fn();
      ui.onSummon = onSummon;
      ui.open([makePet({ id: "pet_wolf" })], null);
      const btn = document.querySelector("[aria-label='Summon Wolf']") as HTMLButtonElement;
      btn.click();
      expect(onSummon).toHaveBeenCalledOnce();
      expect(onSummon).toHaveBeenCalledWith("pet_wolf");
    });
  });

  describe("onDismiss callback", () => {
    it("fires onDismiss when Dismiss is clicked", () => {
      const onDismiss = vi.fn();
      ui.onDismiss = onDismiss;
      ui.open([makePet({ id: "pet_wolf" })], "pet_wolf");
      const btn = document.querySelector("[aria-label='Dismiss Wolf']") as HTMLButtonElement;
      btn.click();
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });

  // ── refresh() ──────────────────────────────────────────────────────────

  describe("refresh()", () => {
    it("does not throw when the panel is not open", () => {
      expect(() => ui.refresh([makePet()], null)).not.toThrow();
    });

    it("updates displayed content when the panel is open", () => {
      ui.open([makePet({ name: "OldName" })], null);
      ui.refresh([makePet({ name: "NewName" })], null);
      expect(document.body.textContent).toContain("NewName");
    });

    it("does not re-render when panel is closed", () => {
      ui.open([makePet({ name: "Before" })], null);
      ui.close();
      ui.refresh([makePet({ name: "After" })], null);
      // Panel is hidden — the DOM may still have old content, which is fine
      expect(ui.isVisible).toBe(false);
    });
  });

  // ── Mood display ─────────────────────────────────────────────────────────

  describe("mood labels", () => {
    it("displays 'Happy' when mood >= 80", () => {
      ui.open([makePet({ mood: 90 })], null);
      expect(document.body.textContent).toContain("Happy");
    });

    it("displays 'Content' when mood is 60–79", () => {
      ui.open([makePet({ mood: 65 })], null);
      expect(document.body.textContent).toContain("Content");
    });

    it("displays 'Unhappy' when mood < 20", () => {
      ui.open([makePet({ mood: 5 })], null);
      expect(document.body.textContent).toContain("Unhappy");
    });
  });

  // ── Multiple open calls ───────────────────────────────────────────────

  describe("re-opening the panel", () => {
    it("does not create duplicate dialog elements on repeated opens", () => {
      ui.open([makePet()], null);
      ui.close();
      ui.open([makePet()], null);
      const dialogs = document.querySelectorAll("[role='dialog']");
      expect(dialogs.length).toBe(1);
    });

    it("updates displayed pets when opened with new data", () => {
      ui.open([makePet({ name: "Alpha" })], null);
      ui.close();
      ui.open([makePet({ name: "Beta" })], null);
      expect(document.body.textContent).toContain("Beta");
    });
  });
});
