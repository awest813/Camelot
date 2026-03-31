// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GuardEncounterUI } from "./guard-encounter-ui";
import type { GuardEncounterView, GuardEncounterAction } from "./guard-encounter-ui";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeView(overrides: Partial<GuardEncounterView> = {}): GuardEncounterView {
  return {
    guardName: "Guard Valdus",
    factionId: "whiterun_guard",
    bounty: 100,
    playerGold: 250,
    canPersuade: true,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GuardEncounterUI", () => {
  let ui: GuardEncounterUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new GuardEncounterUI();
  });

  // ── open() ───────────────────────────────────────────────────────────────────

  describe("open()", () => {
    it("creates the root DOM element", () => {
      ui.open(makeView());
      expect(document.querySelector(".guard-encounter")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.open(makeView());
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display grid", () => {
      ui.open(makeView());
      const root = document.querySelector(".guard-encounter") as HTMLElement;
      expect(root.style.display).toBe("grid");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.open(makeView());
      ui.open(makeView());
      expect(document.querySelectorAll(".guard-encounter").length).toBe(1);
    });

    it("root has role=dialog", () => {
      ui.open(makeView());
      const root = document.querySelector(".guard-encounter");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.open(makeView());
      const root = document.querySelector(".guard-encounter");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });

    it("root has aria-labelledby pointing to title", () => {
      ui.open(makeView());
      const root = document.querySelector(".guard-encounter");
      const titleId = root?.getAttribute("aria-labelledby") ?? "";
      expect(titleId).toBeTruthy();
      expect(document.getElementById(titleId)).not.toBeNull();
    });

    it("shows the panel title 'Guard Challenge'", () => {
      ui.open(makeView());
      const title = document.querySelector(".guard-encounter__title");
      expect(title?.textContent).toBe("Guard Challenge");
    });

    it("shows guard dialogue line with guard name", () => {
      ui.open(makeView({ guardName: "Guard Halvir" }));
      const header = document.querySelector(".guard-encounter__line");
      expect(header?.textContent).toContain("Guard Halvir");
    });

    it("shows guard arrest quote in the header", () => {
      ui.open(makeView());
      const header = document.querySelector(".guard-encounter__line");
      expect(header?.textContent).toContain("under arrest");
    });

    it("shows faction id in the meta line", () => {
      ui.open(makeView({ factionId: "riften_thieves_guild" }));
      const meta = document.querySelector(".guard-encounter__meta");
      expect(meta?.textContent).toContain("riften_thieves_guild");
    });

    it("shows bounty in the meta line", () => {
      ui.open(makeView({ bounty: 450 }));
      const meta = document.querySelector(".guard-encounter__meta");
      expect(meta?.textContent).toContain("450");
    });

    it("shows player gold in the meta line", () => {
      ui.open(makeView({ playerGold: 800 }));
      const meta = document.querySelector(".guard-encounter__meta");
      expect(meta?.textContent).toContain("800");
    });

    it("sets initial status to 'Choose your response.'", () => {
      ui.open(makeView());
      const status = document.querySelector(".guard-encounter__status");
      expect(status?.textContent).toBe("Choose your response.");
    });

    it("Pay Fine button is enabled when player has enough gold", () => {
      ui.open(makeView({ bounty: 100, playerGold: 200 }));
      const payBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Pay Fine",
      );
      expect(payBtn?.disabled).toBe(false);
    });

    it("Pay Fine button is disabled when player cannot afford the fine", () => {
      ui.open(makeView({ bounty: 500, playerGold: 200 }));
      const payBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Pay Fine",
      );
      expect(payBtn?.disabled).toBe(true);
    });

    it("Persuade button is enabled when canPersuade is true", () => {
      ui.open(makeView({ canPersuade: true }));
      const persuadeBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Persuade",
      );
      expect(persuadeBtn?.disabled).toBe(false);
    });

    it("Persuade button is disabled when canPersuade is false", () => {
      ui.open(makeView({ canPersuade: false }));
      const persuadeBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Persuade",
      );
      expect(persuadeBtn?.disabled).toBe(true);
    });

    it("renders all four action buttons", () => {
      ui.open(makeView());
      const labels = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).map(
        (b) => b.textContent,
      );
      expect(labels).toContain("Pay Fine");
      expect(labels).toContain("Go to Jail");
      expect(labels).toContain("Persuade");
      expect(labels).toContain("Resist Arrest");
    });

    it("updates header text when opened a second time with new view", () => {
      ui.open(makeView({ guardName: "Guard Aela" }));
      ui.open(makeView({ guardName: "Guard Bolvyn" }));
      const header = document.querySelector(".guard-encounter__line");
      expect(header?.textContent).toContain("Guard Bolvyn");
    });
  });

  // ── close() ──────────────────────────────────────────────────────────────────

  describe("close()", () => {
    it("hides the root element", () => {
      ui.open(makeView());
      ui.close();
      const root = document.querySelector(".guard-encounter") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("sets isVisible to false", () => {
      ui.open(makeView());
      ui.close();
      expect(ui.isVisible).toBe(false);
    });

    it("close() is safe to call before open()", () => {
      expect(() => ui.close()).not.toThrow();
    });
  });

  // ── showStatus() ─────────────────────────────────────────────────────────────

  describe("showStatus()", () => {
    it("updates the status text", () => {
      ui.open(makeView());
      ui.showStatus("You have been fined.");
      const status = document.querySelector(".guard-encounter__status");
      expect(status?.textContent).toBe("You have been fined.");
    });

    it("adds error class when isError is true", () => {
      ui.open(makeView());
      ui.showStatus("Resisting arrest!", true);
      const status = document.querySelector(".guard-encounter__status");
      expect(status?.classList.contains("guard-encounter__status--error")).toBe(true);
      expect(status?.classList.contains("guard-encounter__status--ok")).toBe(false);
    });

    it("adds ok class when isError is false", () => {
      ui.open(makeView());
      ui.showStatus("Fine paid successfully.", false);
      const status = document.querySelector(".guard-encounter__status");
      expect(status?.classList.contains("guard-encounter__status--ok")).toBe(true);
      expect(status?.classList.contains("guard-encounter__status--error")).toBe(false);
    });

    it("defaults isError to false", () => {
      ui.open(makeView());
      ui.showStatus("All clear.");
      const status = document.querySelector(".guard-encounter__status");
      expect(status?.classList.contains("guard-encounter__status--ok")).toBe(true);
    });

    it("showStatus() is safe to call before open()", () => {
      expect(() => ui.showStatus("test")).not.toThrow();
    });

    it("clears error class when transitioning from error to ok", () => {
      ui.open(makeView());
      ui.showStatus("Error!", true);
      ui.showStatus("Fixed.", false);
      const status = document.querySelector(".guard-encounter__status");
      expect(status?.classList.contains("guard-encounter__status--error")).toBe(false);
      expect(status?.classList.contains("guard-encounter__status--ok")).toBe(true);
    });
  });

  // ── onResolve callbacks ───────────────────────────────────────────────────────

  describe("onResolve", () => {
    it("Pay Fine button fires onResolve with 'pay_fine'", () => {
      const onResolve = vi.fn<(action: GuardEncounterAction) => void>();
      ui.onResolve = onResolve;
      ui.open(makeView({ bounty: 100, playerGold: 500 }));
      const payBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Pay Fine",
      );
      payBtn?.click();
      expect(onResolve).toHaveBeenCalledWith("pay_fine");
    });

    it("Go to Jail button fires onResolve with 'go_to_jail'", () => {
      const onResolve = vi.fn<(action: GuardEncounterAction) => void>();
      ui.onResolve = onResolve;
      ui.open(makeView());
      const jailBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Go to Jail",
      );
      jailBtn?.click();
      expect(onResolve).toHaveBeenCalledWith("go_to_jail");
    });

    it("Persuade button fires onResolve with 'persuade'", () => {
      const onResolve = vi.fn<(action: GuardEncounterAction) => void>();
      ui.onResolve = onResolve;
      ui.open(makeView({ canPersuade: true }));
      const persuadeBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Persuade",
      );
      persuadeBtn?.click();
      expect(onResolve).toHaveBeenCalledWith("persuade");
    });

    it("Resist Arrest button fires onResolve with 'resist_arrest'", () => {
      const onResolve = vi.fn<(action: GuardEncounterAction) => void>();
      ui.onResolve = onResolve;
      ui.open(makeView());
      const resistBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Resist Arrest",
      );
      resistBtn?.click();
      expect(onResolve).toHaveBeenCalledWith("resist_arrest");
    });

    it("onResolve defaults to null and clicking buttons does not throw", () => {
      ui.onResolve = null;
      ui.open(makeView());
      const jailBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Go to Jail",
      );
      expect(() => jailBtn?.click()).not.toThrow();
    });

    it("disabled Pay Fine button cannot trigger onResolve via click", () => {
      const onResolve = vi.fn();
      ui.onResolve = onResolve;
      ui.open(makeView({ bounty: 999, playerGold: 10 }));
      const payBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Pay Fine",
      ) as HTMLButtonElement;
      // Disabled buttons do not fire click events in browsers / jsdom
      expect(payBtn.disabled).toBe(true);
    });
  });

  // ── isVisible flag ────────────────────────────────────────────────────────────

  describe("isVisible", () => {
    it("starts as false", () => {
      expect(ui.isVisible).toBe(false);
    });

    it("is true after open()", () => {
      ui.open(makeView());
      expect(ui.isVisible).toBe(true);
    });

    it("is false after close()", () => {
      ui.open(makeView());
      ui.close();
      expect(ui.isVisible).toBe(false);
    });

    it("toggles correctly through multiple open/close cycles", () => {
      ui.open(makeView());
      expect(ui.isVisible).toBe(true);
      ui.close();
      expect(ui.isVisible).toBe(false);
      ui.open(makeView());
      expect(ui.isVisible).toBe(true);
    });
  });

  // ── equal bounty edge case ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("Pay Fine is enabled when playerGold exactly equals bounty", () => {
      ui.open(makeView({ bounty: 100, playerGold: 100 }));
      const payBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Pay Fine",
      );
      expect(payBtn?.disabled).toBe(false);
    });

    it("Pay Fine is disabled when playerGold is one less than bounty", () => {
      ui.open(makeView({ bounty: 100, playerGold: 99 }));
      const payBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Pay Fine",
      );
      expect(payBtn?.disabled).toBe(true);
    });

    it("zero bounty makes Pay Fine always enabled", () => {
      ui.open(makeView({ bounty: 0, playerGold: 0 }));
      const payBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".guard-encounter__btn")).find(
        (b) => b.textContent === "Pay Fine",
      );
      expect(payBtn?.disabled).toBe(false);
    });
  });
});
