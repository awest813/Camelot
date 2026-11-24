import { describe, it, expect } from "vitest";
import { DEFAULT_RENDERER, pickRenderer } from "./renderer-choice";

describe("pickRenderer", () => {
  it("uses the default when nothing asks otherwise", () => {
    expect(pickRenderer("", undefined, null)).toBe(DEFAULT_RENDERER);
  });
  it("the URL wins, then a fallback remembered on this machine, then the build setting", () => {
    expect(pickRenderer("?renderer=webgl", "webgpu", null)).toBe("webgl");
    expect(pickRenderer("?renderer=webgpu", undefined, "webgl")).toBe("webgpu");
    expect(pickRenderer("", "webgpu", "webgl"), "WebGPU failed here before").toBe("webgl");
    expect(pickRenderer("", "webgl", null)).toBe("webgl");
  });
  it("ignores values it doesn't know", () => {
    expect(pickRenderer("?renderer=vulkan", "metal", "glide")).toBe(DEFAULT_RENDERER);
  });
});
