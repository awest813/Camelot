import { describe, expect, it, vi } from "vitest";
import { LazyPanel } from "./lazy-panel";

describe("LazyPanel", () => {
  it("is closed until loaded, loads once, then forwards", async () => {
    const panel = { isVisible: true, close: vi.fn() };
    const load = vi.fn(async () => panel);
    const lazy = new LazyPanel(load);
    expect(lazy.isVisible).toBe(false);
    lazy.close(); // nothing to close yet
    expect(lazy.current).toBeNull();
    const [a, b] = await Promise.all([lazy.get(), lazy.get()]);
    expect(a).toBe(panel);
    expect(b).toBe(panel);
    expect(load).toHaveBeenCalledOnce();
    expect(lazy.isVisible).toBe(true);
    lazy.close();
    expect(panel.close).toHaveBeenCalledOnce();
  });
});
