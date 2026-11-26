// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeathVeil } from "./death-veil";

describe("DeathVeil", () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ""; });

  it("shows the words, then lifts and is gone", () => {
    vi.useFakeTimers();
    const v = new DeathVeil();
    v.show();
    const el = document.querySelector(".death-veil");
    expect(el?.getAttribute("role")).toBe("alert");
    expect(el?.textContent).toContain("You have fallen");
    expect(v.isShown).toBe(true);
    v.hide();
    expect(v.isShown).toBe(false);
    vi.advanceTimersByTime(900);
    expect(document.querySelector(".death-veil")).toBeNull();
  });

  it("a second fall replaces the first veil; hiding twice is harmless", () => {
    const v = new DeathVeil();
    v.show();
    v.show();
    expect(document.querySelectorAll(".death-veil")).toHaveLength(1);
    v.hide();
    v.hide();
    expect(v.isShown).toBe(false);
  });
});
