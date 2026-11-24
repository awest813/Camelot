// @vitest-environment node
import { describe, it, expect } from "vitest";
import { wgslError } from "./wgsl-validate";

describe("wgslError (naga)", () => {
  it("accepts valid WGSL and reports syntax and type errors", () => {
    expect(wgslError("@fragment fn main() -> @location(0) vec4f { let g = vec3f(0.2); return vec4f(g, 1.0); }")).toBeNull();
    expect(wgslError("@fragment fn main() -> @location(0) vec4f { let g = vec3f(0.2) +; return vec4f(g, 1.0); }")).toMatch(/./);
    expect(wgslError("@fragment fn main() -> @location(0) vec4f { let g = vec3f(0.2) + vec2f(1.0); return vec4f(g, 1.0); }")).toMatch(/./);
  });
});
