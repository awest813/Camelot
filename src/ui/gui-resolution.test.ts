import { describe, it, expect } from "vitest";
import type { AdvancedDynamicTexture } from "@babylonjs/gui/2D";
import { keepGuiAtCssResolution } from "./gui-resolution";

function makeEngine(level: number) {
  const listeners: Array<() => void> = [];
  return {
    level,
    getHardwareScalingLevel() { return this.level; },
    onResizeObservable: { add: (cb: () => void) => listeners.push(cb) },
    resize() { listeners.forEach((cb) => cb()); },
  };
}

describe("keepGuiAtCssResolution", () => {
  it("matches renderScale to a >1 hardware scaling level (low tier 0.75x render)", () => {
    const ui = { renderScale: 1 } as AdvancedDynamicTexture;
    keepGuiAtCssResolution(ui, makeEngine(1 / 0.75));
    expect(ui.renderScale).toBeCloseTo(1.3333, 3);
  });

  it("stays at 1 for native rendering", () => {
    const ui = { renderScale: 1 } as AdvancedDynamicTexture;
    keepGuiAtCssResolution(ui, makeEngine(1));
    expect(ui.renderScale).toBe(1);
  });

  it("follows tier changes delivered through engine resize", () => {
    const ui = { renderScale: 1 } as AdvancedDynamicTexture;
    const engine = makeEngine(1);
    keepGuiAtCssResolution(ui, engine);
    engine.level = 2;
    engine.resize();
    expect(ui.renderScale).toBe(2);
    engine.level = 1;
    engine.resize();
    expect(ui.renderScale).toBe(1);
  });

  it("is a no-op without an engine (test mocks)", () => {
    const ui = { renderScale: 1 } as AdvancedDynamicTexture;
    expect(() => keepGuiAtCssResolution(ui, undefined)).not.toThrow();
    expect(ui.renderScale).toBe(1);
  });
});
