// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { CharacterSheetUI } from "./character-sheet-ui";
import type { CharacterSheetData } from "./character-sheet-ui";
import type { ProgressionSkill } from "../systems/skill-progression-system";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeSkills(): ProgressionSkill[] {
  return [
    { id: "blade",       name: "Blade",       level: 30, xp: 20, xpToNext: 410 },
    { id: "destruction", name: "Destruction", level: 45, xp: 80, xpToNext: 590 },
    { id: "sneak",       name: "Sneak",       level: 20, xp:  0, xpToNext: 290 },
    { id: "alchemy",     name: "Alchemy",     level: 15, xp: 10, xpToNext: 230 },
  ] as ProgressionSkill[];
}

function makeData(overrides: Partial<CharacterSheetData> = {}): CharacterSheetData {
  return {
    name:           "Aldric the Bold",
    level:          5,
    raceName:       "Nord",
    className:      "Warrior",
    birthsignName:  "The Warrior",
    specialization: "Combat",
    attributes: {
      strength:     55,
      endurance:    50,
      intelligence: 40,
      agility:      45,
      willpower:    35,
      speed:        40,
      luck:         40,
    },
    skills:       makeSkills(),
    maxHealth:    200,
    maxMagicka:   115,
    maxStamina:   152,
    carryWeight:  375,
    fame:         120,
    infamy:        10,
    fameLabel:    "Known Hero",
    infamyLabel:  "Minor Thug",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("CharacterSheetUI", () => {
  let ui: CharacterSheetUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new CharacterSheetUI();
  });

  // ── show() / hide() ──────────────────────────────────────────────────────────

  describe("show()", () => {
    it("creates the root DOM element", () => {
      ui.show();
      expect(document.querySelector(".character-sheet-ui")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.show();
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display flex", () => {
      ui.show();
      const root = document.querySelector(".character-sheet-ui") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.show();
      ui.show();
      expect(document.querySelectorAll(".character-sheet-ui").length).toBe(1);
    });

    it("root has role=dialog", () => {
      ui.show();
      const root = document.querySelector(".character-sheet-ui");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.show();
      const root = document.querySelector(".character-sheet-ui");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });
  });

  describe("hide()", () => {
    it("sets isVisible to false", () => {
      ui.show();
      ui.hide();
      expect(ui.isVisible).toBe(false);
    });

    it("hides the root element", () => {
      ui.show();
      ui.hide();
      const root = document.querySelector(".character-sheet-ui") as HTMLElement;
      expect(root.style.display).toBe("none");
    });
  });

  // ── close button ──────────────────────────────────────────────────────────────

  describe("close button", () => {
    it("hides the panel when clicked", () => {
      ui.show();
      const closeBtn = document.querySelector<HTMLButtonElement>(".character-sheet-ui__close");
      closeBtn?.click();
      expect(ui.isVisible).toBe(false);
    });

    it("has an aria-label", () => {
      ui.show();
      const closeBtn = document.querySelector(".character-sheet-ui__close");
      expect(closeBtn?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── update() — identity ───────────────────────────────────────────────────────

  describe("update() — identity section", () => {
    it("displays the character name", () => {
      ui.show();
      ui.update(makeData());
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__identity-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("Aldric the Bold");
    });

    it("displays the character level", () => {
      ui.show();
      ui.update(makeData({ level: 7 }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__identity-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("7");
    });

    it("displays the race name", () => {
      ui.show();
      ui.update(makeData({ raceName: "Breton" }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__identity-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("Breton");
    });

    it("displays the class name", () => {
      ui.show();
      ui.update(makeData({ className: "Mage" }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__identity-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("Mage");
    });

    it("displays the birthsign name", () => {
      ui.show();
      ui.update(makeData({ birthsignName: "The Mage" }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__identity-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("The Mage");
    });

    it("displays the class specialization", () => {
      ui.show();
      ui.update(makeData({ specialization: "Stealth" }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__identity-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("Stealth");
    });

    it("shows a dash for undefined identity fields", () => {
      ui.show();
      ui.update({});
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__identity-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values.every((v) => v === "—")).toBe(true);
    });
  });

  // ── update() — attributes ─────────────────────────────────────────────────────

  describe("update() — attributes section", () => {
    it("renders an 'Attributes' heading", () => {
      ui.show();
      ui.update(makeData());
      const headings = Array.from(
        document.querySelectorAll(".character-sheet-ui__section-title"),
      ).map((el) => el.textContent);
      expect(headings).toContain("Attributes");
    });

    it("renders a row for each of the 7 attributes", () => {
      ui.show();
      ui.update(makeData());
      const rows = document.querySelectorAll(".character-sheet-ui__attr-row");
      expect(rows.length).toBe(7);
    });

    it("displays attribute values", () => {
      ui.show();
      ui.update(makeData());
      const strengthRow = document.querySelector("[data-attribute='strength']");
      const valueEl = strengthRow?.querySelector(".character-sheet-ui__row-value");
      expect(valueEl?.textContent).toBe("55");
    });

    it("shows dashes for missing attribute values", () => {
      ui.show();
      ui.update(makeData({ attributes: undefined }));
      const rows = document.querySelectorAll(".character-sheet-ui__attr-row");
      const values = Array.from(rows).map(
        (r) => r.querySelector(".character-sheet-ui__row-value")?.textContent,
      );
      expect(values.every((v) => v === "—")).toBe(true);
    });

    it("each attribute row has a data-attribute on the correct key", () => {
      ui.show();
      ui.update(makeData());
      const keys = ["strength", "endurance", "intelligence", "agility", "willpower", "speed", "luck"];
      for (const key of keys) {
        expect(document.querySelector(`[data-attribute='${key}']`)).not.toBeNull();
      }
    });
  });

  // ── update() — skills ─────────────────────────────────────────────────────────

  describe("update() — skills section", () => {
    it("renders a 'Skills' heading", () => {
      ui.show();
      ui.update(makeData());
      const headings = Array.from(
        document.querySelectorAll(".character-sheet-ui__section-title"),
      ).map((el) => el.textContent);
      expect(headings).toContain("Skills");
    });

    it("renders a row for each skill", () => {
      ui.show();
      ui.update(makeData());
      const rows = document.querySelectorAll(".character-sheet-ui__skill-row");
      expect(rows.length).toBe(4);
    });

    it("displays skill levels", () => {
      ui.show();
      ui.update(makeData());
      const bladeRow = document.querySelector("[data-skill-id='blade']");
      const valueEl = bladeRow?.querySelector(".character-sheet-ui__row-value");
      expect(valueEl?.textContent).toBe("30");
    });

    it("shows xp progress percentage on each skill row", () => {
      ui.show();
      ui.update(makeData());
      const xpEls = document.querySelectorAll(".character-sheet-ui__skill-xp");
      expect(xpEls.length).toBe(4);
    });

    it("skill xp element has aria-label", () => {
      ui.show();
      ui.update(makeData());
      const xpEls = document.querySelectorAll(".character-sheet-ui__skill-xp");
      xpEls.forEach((el) =>
        expect(el.getAttribute("aria-label")).toBeTruthy(),
      );
    });

    it("shows an empty message when no skills are provided", () => {
      ui.show();
      ui.update(makeData({ skills: [] }));
      const empty = document.querySelector(".character-sheet-ui__empty");
      expect(empty).not.toBeNull();
    });
  });

  // ── update() — derived stats ──────────────────────────────────────────────────

  describe("update() — derived stats section", () => {
    it("renders a 'Derived Stats' heading", () => {
      ui.show();
      ui.update(makeData());
      const headings = Array.from(
        document.querySelectorAll(".character-sheet-ui__section-title"),
      ).map((el) => el.textContent);
      expect(headings).toContain("Derived Stats");
    });

    it("displays max health", () => {
      ui.show();
      ui.update(makeData({ maxHealth: 220 }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__derived-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("220");
    });

    it("displays max magicka", () => {
      ui.show();
      ui.update(makeData({ maxMagicka: 130 }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__derived-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("130");
    });

    it("displays max stamina", () => {
      ui.show();
      ui.update(makeData({ maxStamina: 160 }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__derived-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("160");
    });

    it("displays carry weight", () => {
      ui.show();
      ui.update(makeData({ carryWeight: 400 }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__derived-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("400");
    });
  });

  // ── update() — reputation ─────────────────────────────────────────────────────

  describe("update() — reputation section", () => {
    it("renders a 'Reputation' heading", () => {
      ui.show();
      ui.update(makeData());
      const headings = Array.from(
        document.querySelectorAll(".character-sheet-ui__section-title"),
      ).map((el) => el.textContent);
      expect(headings).toContain("Reputation");
    });

    it("displays fame score", () => {
      ui.show();
      ui.update(makeData({ fame: 200 }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__rep-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("200");
    });

    it("displays infamy score", () => {
      ui.show();
      ui.update(makeData({ infamy: 50 }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__rep-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("50");
    });

    it("shows fame label when provided", () => {
      ui.show();
      ui.update(makeData({ fameLabel: "Champion" }));
      const labels = Array.from(
        document.querySelectorAll(".character-sheet-ui__rep-label"),
      ).map((el) => el.textContent);
      expect(labels).toContain("Champion");
    });

    it("shows infamy label when provided", () => {
      ui.show();
      ui.update(makeData({ infamyLabel: "Outlaw" }));
      const labels = Array.from(
        document.querySelectorAll(".character-sheet-ui__rep-label"),
      ).map((el) => el.textContent);
      expect(labels).toContain("Outlaw");
    });

    it("omits reputation labels when not provided", () => {
      ui.show();
      ui.update(makeData({ fameLabel: undefined, infamyLabel: undefined }));
      const labels = document.querySelectorAll(".character-sheet-ui__rep-label");
      expect(labels.length).toBe(0);
    });
  });

  // ── re-render on subsequent update() calls ────────────────────────────────────

  describe("re-renders on update()", () => {
    it("updates character name on second call", () => {
      ui.show();
      ui.update(makeData({ name: "First" }));
      ui.update(makeData({ name: "Second" }));
      const values = Array.from(
        document.querySelectorAll(".character-sheet-ui__identity-row .character-sheet-ui__row-value"),
      ).map((el) => el.textContent);
      expect(values).toContain("Second");
      expect(values).not.toContain("First");
    });

    it("updates attribute values on second call", () => {
      ui.show();
      ui.update(makeData({ attributes: { strength: 40 } }));
      ui.update(makeData({ attributes: { strength: 70 } }));
      const row = document.querySelector("[data-attribute='strength']");
      expect(row?.querySelector(".character-sheet-ui__row-value")?.textContent).toBe("70");
    });

    it("does not duplicate DOM sections on repeated update()", () => {
      ui.show();
      ui.update(makeData());
      ui.update(makeData());
      expect(document.querySelectorAll(".character-sheet-ui__identity").length).toBe(1);
    });
  });

  // ── accessibility ─────────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("identity section has aria-label", () => {
      ui.show();
      const section = document.querySelector(".character-sheet-ui__identity");
      expect(section?.getAttribute("aria-label")).toBeTruthy();
    });

    it("attributes section has aria-label", () => {
      ui.show();
      const section = document.querySelector(".character-sheet-ui__attributes");
      expect(section?.getAttribute("aria-label")).toBeTruthy();
    });

    it("skills section has aria-label", () => {
      ui.show();
      const section = document.querySelector(".character-sheet-ui__skills");
      expect(section?.getAttribute("aria-label")).toBeTruthy();
    });

    it("derived stats section has aria-label", () => {
      ui.show();
      const section = document.querySelector(".character-sheet-ui__derived");
      expect(section?.getAttribute("aria-label")).toBeTruthy();
    });

    it("reputation section has aria-label", () => {
      ui.show();
      const section = document.querySelector(".character-sheet-ui__reputation");
      expect(section?.getAttribute("aria-label")).toBeTruthy();
    });
  });

  // ── destroy() ─────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root element from the DOM", () => {
      ui.show();
      ui.destroy();
      expect(document.querySelector(".character-sheet-ui")).toBeNull();
    });

    it("sets isVisible to false", () => {
      ui.show();
      ui.destroy();
      expect(ui.isVisible).toBe(false);
    });

    it("does not throw when called before show()", () => {
      expect(() => ui.destroy()).not.toThrow();
    });
  });
});
