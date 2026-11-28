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

const panel = () => ({ isVisible: false, close: vi.fn(), open() { this.isVisible = true; } });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("LazyPanel.openWith", () => {
  it("counts as open while loading; a second open does nothing", async () => {
    const load = vi.fn(async () => panel());
    const lp = new LazyPanel(load);
    const show = vi.fn((p: ReturnType<typeof panel>) => p.open());
    lp.openWith(show);
    expect(lp.isVisible).toBe(true);
    lp.openWith(show);
    await tick();
    expect(show).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledOnce();
  });

  it("closing while it loads calls the open off and releases", async () => {
    const lp = new LazyPanel(async () => panel());
    const show = vi.fn(), release = vi.fn();
    lp.openWith(show, release);
    lp.close();
    await tick();
    expect(show).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
    expect(lp.isVisible).toBe(false);
  });

  it("a load that fails releases, and the next open tries again", async () => {
    let fail = true;
    const lp = new LazyPanel(async () => { if (fail) throw new Error("chunk 404"); return panel(); });
    const release = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    lp.openWith(vi.fn(), release);
    await tick();
    expect(release).toHaveBeenCalledWith(expect.any(Error));
    fail = false;
    const show = vi.fn();
    lp.openWith(show, release);
    await tick();
    expect(show).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("LazyPanel: an open called off while loading", () => {
  it("reads as closed at once, and a second open puts it back on", async () => {
    let resolve!: (p: { isVisible: boolean; close(): void }) => void;
    const panel = { isVisible: false, close() { this.isVisible = false; } };
    const lazy = new LazyPanel(() => new Promise<typeof panel>((r) => { resolve = r; }));
    const show = vi.fn((p: typeof panel) => { p.isVisible = true; });
    lazy.openWith(show);
    expect(lazy.isVisible).toBe(true);
    lazy.close();
    expect(lazy.isVisible, "the toggle that closed it sees it closed").toBe(false);
    lazy.openWith(show);
    expect(lazy.isVisible).toBe(true);
    resolve(panel);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(show).toHaveBeenCalledOnce();
    expect(lazy.isVisible).toBe(true);
  });
});

describe("LazyPanel: a called-off open releases at once", () => {
  it("releases when called off, not again when the code arrives", async () => {
    let resolve!: (p: { isVisible: boolean; close(): void }) => void;
    const lazy = new LazyPanel(() => new Promise<{ isVisible: boolean; close(): void }>((r) => { resolve = r; }));
    const show = vi.fn(), release = vi.fn();
    lazy.openWith(show, release);
    lazy.close();
    expect(release, "at once").toHaveBeenCalledOnce();
    lazy.close();
    resolve({ isVisible: false, close() {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(release, "not again later").toHaveBeenCalledOnce();
    expect(show).not.toHaveBeenCalled();
  });
});
