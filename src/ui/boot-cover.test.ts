// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { dismissBootCover } from "./boot-cover";

describe("dismissBootCover", () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ""; });

  it("fades the cover, then removes it", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="boot-cover" aria-live="polite"></div>`;
    dismissBootCover();
    const cover = document.getElementById("boot-cover");
    expect(cover?.classList.contains("is-gone")).toBe(true);
    expect(cover?.hasAttribute("aria-live")).toBe(false);
    vi.advanceTimersByTime(800);
    expect(document.getElementById("boot-cover")).toBeNull();
  });

  it("does nothing without a cover (the editor, tests)", () => {
    expect(() => dismissBootCover()).not.toThrow();
  });
});
