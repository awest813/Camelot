import { afterEach, describe, expect, it } from "vitest";
import { applyPrefs, loadPrefs, reducedMotion, savePrefs, uiScale } from "./accessibility";

describe("accessibility preferences", () => {
  afterEach(() => {
    localStorage.clear();
    applyPrefs({ uiScale: 1, reduceMotion: false });
  });

  it("defaults to normal scale, and motion as the system has it", () => {
    expect(loadPrefs()).toEqual({ uiScale: 1, reduceMotion: false });
  });

  it("round-trips through storage and ignores invalid values", () => {
    savePrefs({ uiScale: 1.25, reduceMotion: true });
    expect(loadPrefs()).toEqual({ uiScale: 1.25, reduceMotion: true });
    localStorage.setItem("camelot.accessibility", JSON.stringify({ uiScale: 7, reduceMotion: "yes" }));
    expect(loadPrefs()).toEqual({ uiScale: 1, reduceMotion: false });
    localStorage.setItem("camelot.accessibility", "{not json");
    expect(loadPrefs()).toEqual({ uiScale: 1, reduceMotion: false });
  });

  it("applies the scale and the reduce-motion class to the page", () => {
    applyPrefs({ uiScale: 1.5, reduceMotion: true });
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.5");
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(true);
    expect(uiScale()).toBe(1.5);
    expect(reducedMotion()).toBe(true);
    applyPrefs({ uiScale: 1, reduceMotion: false });
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(false);
  });
});
