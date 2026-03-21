// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { ActiveEffectHUD, formatDuration } from "./active-effect-hud";
import type { ActiveEffect } from "../systems/active-effects-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEffect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
  return {
    id:            "test_effect_01",
    name:          "Health Restore",
    effectType:    "health_restore",
    magnitude:     5,
    duration:      10,
    totalDuration: 10,
    ...overrides,
  };
}

// ── formatDuration ────────────────────────────────────────────────────────────

describe("formatDuration()", () => {
  it("shows seconds for durations under one minute", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("rounds fractional seconds up", () => {
    expect(formatDuration(3.2)).toBe("4s");
  });

  it("formats whole minutes without leftover seconds", () => {
    expect(formatDuration(120)).toBe("2m");
  });

  it("formats minutes and leftover seconds", () => {
    expect(formatDuration(90)).toBe("1m 30s");
  });

  it("shows ∞ for infinite duration", () => {
    expect(formatDuration(Infinity)).toBe("∞");
  });
});

// ── ActiveEffectHUD ───────────────────────────────────────────────────────────

describe("ActiveEffectHUD", () => {
  let hud: ActiveEffectHUD;

  beforeEach(() => {
    document.body.innerHTML = "";
    hud = new ActiveEffectHUD();
  });

  // ── show() / hide() ───────────────────────────────────────────────────────

  describe("show() / hide()", () => {
    it("is not visible before show()", () => {
      expect(hud.isVisible).toBe(false);
    });

    it("becomes visible after show()", () => {
      hud.show();
      expect(hud.isVisible).toBe(true);
    });

    it("creates the .active-effect-hud element in DOM", () => {
      hud.show();
      expect(document.querySelector(".active-effect-hud")).not.toBeNull();
    });

    it("sets display:flex on show()", () => {
      hud.show();
      const root = document.querySelector(".active-effect-hud") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("hides the element after hide()", () => {
      hud.show();
      hud.hide();
      expect(hud.isVisible).toBe(false);
      const root = document.querySelector(".active-effect-hud") as HTMLElement;
      expect(root.style.display).toBe("none");
    });

    it("creates the root only once on repeated show() calls", () => {
      hud.show();
      hud.show();
      const roots = document.querySelectorAll(".active-effect-hud");
      expect(roots.length).toBe(1);
    });

    it("has role=status on the root element", () => {
      hud.show();
      const root = document.querySelector(".active-effect-hud");
      expect(root?.getAttribute("role")).toBe("status");
    });

    it("has aria-live=polite on the root element", () => {
      hud.show();
      const root = document.querySelector(".active-effect-hud");
      expect(root?.getAttribute("aria-live")).toBe("polite");
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────

  describe("update()", () => {
    beforeEach(() => hud.show());

    it("is a no-op before show() is called (no DOM yet)", () => {
      const hud2 = new ActiveEffectHUD();
      expect(() => hud2.update([makeEffect()])).not.toThrow();
    });

    it("creates a pill for a new effect", () => {
      hud.update([makeEffect()]);
      const pill = document.querySelector(".active-effect-hud__pill");
      expect(pill).not.toBeNull();
    });

    it("adds data-effect-id attribute to the pill", () => {
      hud.update([makeEffect({ id: "fx_01" })]);
      const pill = document.querySelector("[data-effect-id='fx_01']");
      expect(pill).not.toBeNull();
    });

    it("shows the effect name in the pill", () => {
      hud.update([makeEffect({ name: "Burning" })]);
      const name = document.querySelector(".active-effect-hud__name");
      expect(name?.textContent).toBe("Burning");
    });

    it("renders a countdown label", () => {
      hud.update([makeEffect({ duration: 30, totalDuration: 60 })]);
      const cd = document.querySelector(".active-effect-hud__countdown");
      expect(cd?.textContent).toBe("30s");
    });

    it("renders a progress bar element", () => {
      hud.update([makeEffect()]);
      const bar = document.querySelector(".active-effect-hud__bar");
      expect(bar).not.toBeNull();
    });

    it("sets the bar role=progressbar", () => {
      hud.update([makeEffect()]);
      const bar = document.querySelector(".active-effect-hud__bar");
      expect(bar?.getAttribute("role")).toBe("progressbar");
    });

    it("sets bar width to 100% when time is full", () => {
      hud.update([makeEffect({ duration: 10, totalDuration: 10 })]);
      const bar = document.querySelector(".active-effect-hud__bar") as HTMLElement;
      expect(bar.style.width).toBe("100%");
    });

    it("sets bar width proportionally for partial duration", () => {
      hud.update([makeEffect({ duration: 5, totalDuration: 10 })]);
      const bar = document.querySelector(".active-effect-hud__bar") as HTMLElement;
      expect(bar.style.width).toBe("50%");
    });

    it("sets bar width to 100% for infinite duration", () => {
      hud.update([makeEffect({ duration: Infinity, totalDuration: Infinity })]);
      const bar = document.querySelector(".active-effect-hud__bar") as HTMLElement;
      expect(bar.style.width).toBe("100%");
    });

    it("clamps bar width to 0% minimum", () => {
      hud.update([makeEffect({ duration: -1, totalDuration: 10 })]);
      const bar = document.querySelector(".active-effect-hud__bar") as HTMLElement;
      expect(bar.style.width).toBe("0%");
    });

    it("removes pill when effect is no longer in the list", () => {
      hud.update([makeEffect({ id: "fx_01" })]);
      hud.update([]); // effect gone
      const pill = document.querySelector("[data-effect-id='fx_01']");
      expect(pill).toBeNull();
    });

    it("updates countdown for an existing effect", () => {
      hud.update([makeEffect({ id: "fx_01", duration: 30, totalDuration: 30 })]);
      hud.update([makeEffect({ id: "fx_01", duration: 15, totalDuration: 30 })]);
      const cd = document.querySelector(".active-effect-hud__countdown");
      expect(cd?.textContent).toBe("15s");
    });

    it("renders multiple effects as separate pills", () => {
      hud.update([
        makeEffect({ id: "fx_01", name: "Health Restore" }),
        makeEffect({ id: "fx_02", name: "Fire Damage", effectType: "fire_damage" }),
      ]);
      const pills = document.querySelectorAll(".active-effect-hud__pill");
      expect(pills.length).toBe(2);
    });

    it("applies the correct color key class for each effect type", () => {
      hud.update([makeEffect({ effectType: "fire_damage" })]);
      const pill = document.querySelector(".active-effect-hud__pill--harm");
      expect(pill).not.toBeNull();
    });

    it("applies heal color key for health_restore", () => {
      hud.update([makeEffect({ effectType: "health_restore" })]);
      const pill = document.querySelector(".active-effect-hud__pill--heal");
      expect(pill).not.toBeNull();
    });

    it("applies fortify color key for fortify_strength", () => {
      hud.update([makeEffect({ effectType: "fortify_strength" })]);
      const pill = document.querySelector(".active-effect-hud__pill--fortify");
      expect(pill).not.toBeNull();
    });

    it("shows the effect icon in an aria-hidden span", () => {
      hud.update([makeEffect({ effectType: "health_restore" })]);
      const icon = document.querySelector(".active-effect-hud__icon");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      expect(icon?.textContent).toBe("❤");
    });

    it("shows ∞ in countdown for infinite duration", () => {
      hud.update([makeEffect({ duration: Infinity, totalDuration: Infinity })]);
      const cd = document.querySelector(".active-effect-hud__countdown");
      expect(cd?.textContent).toBe("∞");
    });

    it("renders an empty strip when passed an empty list", () => {
      hud.update([]);
      const pills = document.querySelectorAll(".active-effect-hud__pill");
      expect(pills.length).toBe(0);
    });
  });

  // ── destroy() ─────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root element from the DOM", () => {
      hud.show();
      hud.update([makeEffect()]);
      hud.destroy();
      expect(document.querySelector(".active-effect-hud")).toBeNull();
    });

    it("resets isVisible to false", () => {
      hud.show();
      hud.destroy();
      expect(hud.isVisible).toBe(false);
    });
  });
});
