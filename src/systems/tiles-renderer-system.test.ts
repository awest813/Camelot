import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TilesRendererSystem,
  type ITilesRendererHandle,
  type TilesRendererHandleFactory,
} from "./tiles-renderer-system";

// ── Stub helpers ──────────────────────────────────────────────────────────────

function makeHandle(): ITilesRendererHandle & {
  updateCalls: number;
  disposeCalls: number;
} {
  const handle = {
    updateCalls: 0,
    disposeCalls: 0,
    update() { this.updateCalls++; },
    dispose() { this.disposeCalls++; },
  };
  return handle;
}

function makeFactory(handle?: ITilesRendererHandle): {
  factory: TilesRendererHandleFactory;
  lastUrl: () => string | undefined;
  callCount: () => number;
} {
  let lastUrl: string | undefined;
  let callCount = 0;
  const factory: TilesRendererHandleFactory = (url) => {
    lastUrl = url;
    callCount++;
    return handle ?? makeHandle();
  };
  return {
    factory,
    lastUrl: () => lastUrl,
    callCount: () => callCount,
  };
}

const TILESET_URL = "https://example.com/tileset.json";
const TILESET_URL_2 = "https://example.com/other/tileset.json";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TilesRendererSystem", () => {
  let system: TilesRendererSystem;
  let handle: ReturnType<typeof makeHandle>;
  let factory: TilesRendererHandleFactory;

  beforeEach(() => {
    handle = makeHandle();
    ({ factory } = makeFactory(handle));
    system = new TilesRendererSystem(factory);
  });

  // ── Construction ───────────────────────────────────────────────────────────

  it("starts with no tileset loaded", () => {
    expect(system.isLoaded).toBe(false);
    expect(system.activeUrl).toBeNull();
  });

  // ── load() ─────────────────────────────────────────────────────────────────

  it("load() marks the system as loaded", () => {
    system.load(TILESET_URL);
    expect(system.isLoaded).toBe(true);
  });

  it("load() stores the active URL", () => {
    system.load(TILESET_URL);
    expect(system.activeUrl).toBe(TILESET_URL);
  });

  it("load() calls the factory with the provided URL", () => {
    const { factory: f, lastUrl, callCount } = makeFactory(handle);
    const s = new TilesRendererSystem(f);
    s.load(TILESET_URL);
    expect(lastUrl()).toBe(TILESET_URL);
    expect(callCount()).toBe(1);
  });

  it("load() disposes the existing renderer before creating a new one", () => {
    system.load(TILESET_URL);
    system.load(TILESET_URL_2);
    expect(handle.disposeCalls).toBe(1);
  });

  it("load() replaces the active URL when called twice", () => {
    system.load(TILESET_URL);
    system.load(TILESET_URL_2);
    expect(system.activeUrl).toBe(TILESET_URL_2);
  });

  it("load() creates a fresh renderer for the new URL", () => {
    const handles: ReturnType<typeof makeHandle>[] = [];
    const f: TilesRendererHandleFactory = (_url) => {
      const h = makeHandle();
      handles.push(h);
      return h;
    };
    const s = new TilesRendererSystem(f);
    s.load(TILESET_URL);
    s.load(TILESET_URL_2);
    expect(handles).toHaveLength(2);
  });

  // ── update() ───────────────────────────────────────────────────────────────

  it("update() forwards to the renderer handle", () => {
    system.load(TILESET_URL);
    system.update();
    expect(handle.updateCalls).toBe(1);
  });

  it("update() is a no-op when no tileset is loaded", () => {
    expect(() => system.update()).not.toThrow();
  });

  it("update() accumulates across multiple frames", () => {
    system.load(TILESET_URL);
    system.update();
    system.update();
    system.update();
    expect(handle.updateCalls).toBe(3);
  });

  // ── unload() ───────────────────────────────────────────────────────────────

  it("unload() marks the system as not loaded", () => {
    system.load(TILESET_URL);
    system.unload();
    expect(system.isLoaded).toBe(false);
  });

  it("unload() clears the active URL", () => {
    system.load(TILESET_URL);
    system.unload();
    expect(system.activeUrl).toBeNull();
  });

  it("unload() disposes the renderer handle", () => {
    system.load(TILESET_URL);
    system.unload();
    expect(handle.disposeCalls).toBe(1);
  });

  it("unload() is safe when no tileset is loaded", () => {
    expect(() => system.unload()).not.toThrow();
  });

  it("update() is a no-op after unload()", () => {
    system.load(TILESET_URL);
    system.unload();
    expect(() => system.update()).not.toThrow();
    expect(handle.updateCalls).toBe(0);
  });

  it("does not dispose the handle more than once when unload() is called twice", () => {
    system.load(TILESET_URL);
    system.unload();
    system.unload(); // second call is safe
    expect(handle.disposeCalls).toBe(1);
  });

  // ── dispose() ──────────────────────────────────────────────────────────────

  it("dispose() marks the system as not loaded", () => {
    system.load(TILESET_URL);
    system.dispose();
    expect(system.isLoaded).toBe(false);
  });

  it("dispose() clears the active URL", () => {
    system.load(TILESET_URL);
    system.dispose();
    expect(system.activeUrl).toBeNull();
  });

  it("dispose() disposes the renderer handle", () => {
    system.load(TILESET_URL);
    system.dispose();
    expect(handle.disposeCalls).toBe(1);
  });

  it("dispose() is safe when no tileset is loaded", () => {
    expect(() => system.dispose()).not.toThrow();
  });

  // ── Load → unload → reload cycle ──────────────────────────────────────────

  it("supports load → unload → load cycle", () => {
    const handles: ReturnType<typeof makeHandle>[] = [];
    const f: TilesRendererHandleFactory = (_url) => {
      const h = makeHandle();
      handles.push(h);
      return h;
    };
    const s = new TilesRendererSystem(f);

    s.load(TILESET_URL);
    expect(s.isLoaded).toBe(true);

    s.unload();
    expect(s.isLoaded).toBe(false);
    expect(handles[0].disposeCalls).toBe(1);

    s.load(TILESET_URL);
    expect(s.isLoaded).toBe(true);
    expect(handles).toHaveLength(2);
    s.update();
    expect(handles[1].updateCalls).toBe(1);
  });

  // ── State consistency ──────────────────────────────────────────────────────

  it("isLoaded is false before any load call", () => {
    const s = new TilesRendererSystem(factory);
    expect(s.isLoaded).toBe(false);
  });

  it("activeUrl is null before any load call", () => {
    const s = new TilesRendererSystem(factory);
    expect(s.activeUrl).toBeNull();
  });

  it("isLoaded transitions correctly through the full lifecycle", () => {
    expect(system.isLoaded).toBe(false);
    system.load(TILESET_URL);
    expect(system.isLoaded).toBe(true);
    system.unload();
    expect(system.isLoaded).toBe(false);
    system.load(TILESET_URL_2);
    expect(system.isLoaded).toBe(true);
    system.dispose();
    expect(system.isLoaded).toBe(false);
  });
});
