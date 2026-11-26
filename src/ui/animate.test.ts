import { describe, it, expect, vi } from "vitest";
import { animateEl } from "./animate";

describe("animateEl", () => {
  it("maps y and scale to the individual translate/scale properties, seconds to ms", async () => {
    const el = document.createElement("div");
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    (el as unknown as { animate: unknown }).animate = animate;
    await animateEl(el, { opacity: [0, 1], y: [10, 0], scale: [0.97, 1] }, { duration: 0.22, delay: 0.04, ease: [0.22, 1, 0.36, 1] });
    expect(animate).toHaveBeenCalledWith(
      [{ opacity: 0, translate: "0 10px", scale: "0.97" }, { opacity: 1, translate: "0 0px", scale: "1" }],
      expect.objectContaining({ duration: 220, delay: 40, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }),
    );
  });

  it("resolves at once where the Web Animations API is missing", async () => {
    const el = document.createElement("div");
    (el as unknown as { animate: unknown }).animate = undefined;
    await expect(animateEl(el, { opacity: [0, 1] }, { duration: 1 })).resolves.toBeUndefined();
  });
});
