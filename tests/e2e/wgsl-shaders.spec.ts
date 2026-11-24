/**
 * The game's own shaders in both languages — Playwright
 *
 * Builds the five custom shader pieces (sky, horizon, water, terrain plugin,
 * wind plugin) on a WebGPU engine and checks every one compiles as WGSL,
 * with no shader errors and nothing fetched from another host (Babylon
 * fetches its GLSL→WGSL converters from a CDN only when a shader has no
 * WGSL).  The same page on WebGL2 checks the GLSL versions render.
 *
 * The WebGPU case is opt-in (WEBGPU_E2E=1): headless Chromium's software
 * WebGPU (SwiftShader) loses its device, or crashes, within a few frames
 * here, even for Babylon's own minimal shader material, so compiling there
 * proves nothing.  The WebGL case always runs.  The full game on WebGPU is
 * webgpu.spec.ts.
 *
 * Run: npm run test:e2e -- wgsl-shaders
 */
import { test, expect } from "@playwright/test";

test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader", "--in-process-gpu"],
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  },
});

const PIECES = ["sky", "horizon", "water", "terrain", "wind"];

for (const renderer of ["webgpu", "webgl"] as const) {
  test(`the five custom shaders compile on ${renderer}`, async ({ page, baseURL }) => {
    test.skip(renderer === "webgpu" && !process.env.WEBGPU_E2E, "set WEBGPU_E2E=1 (needs a working WebGPU adapter)");
    test.setTimeout(120_000);
    const origin = new URL(baseURL!).origin;
    const outside: string[] = [];
    const shaderErrors: string[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) outside.push(u);
    });
    page.on("console", (m) => {
      if (m.type() === "error" && /shader|WGSL|GLSL|compil|effect/i.test(m.text())) shaderErrors.push(m.text().slice(0, 400));
    });
    await page.goto(`/tests/e2e/harness/wgsl-shaders.html${renderer === "webgl" ? "?webgl" : ""}`);
    await expect.poll(() => page.evaluate(() => (window as any).__shaders?.()?.checked), { timeout: 60_000 }).toBe(true);
    const compiled = await page.evaluate(() => (window as any).__shaders());
    expect(compiled.ready).toEqual(Object.fromEntries(PIECES.map((p) => [p, true])));
    // Every piece's final WGSL, compiled by the GPU's own compiler: no errors.
    expect(compiled.compileErrors).toEqual({});
    // Pipelines are built when meshes first draw; give it a few frames (on
    // WebGPU the software device may be lost by then, which ends frames).
    await expect.poll(() => page.evaluate(() => (window as any).__shaders().frames), { timeout: 30_000 })
      .toBeGreaterThan(renderer === "webgl" ? 30 : 0);
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => (window as any).__shaders());
    expect(state.webgpu).toBe(renderer === "webgpu");
    expect(state.gpuErrors, state.gpuErrors.join("\n")).toEqual([]);
    expect(shaderErrors, shaderErrors.join("\n")).toEqual([]);
    expect(outside, `fetched from outside:\n${outside.join("\n")}`).toEqual([]);
  });
}
