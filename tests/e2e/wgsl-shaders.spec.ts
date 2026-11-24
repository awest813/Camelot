/**
 * The game's own shaders in both languages — Playwright
 *
 * Builds the five custom shader pieces (sky, horizon, water, terrain plugin,
 * wind plugin) on a WebGPU engine and validates the exact WGSL Babylon
 * generates for each with naga (wgpu's shader compiler), with nothing
 * fetched from another host (Babylon fetches its GLSL→WGSL converters from
 * a CDN only when a shader has no WGSL).  The same page on WebGL2 checks
 * the GLSL versions render.
 *
 * Nothing is drawn on WebGPU: headless Chromium's software WebGPU
 * (SwiftShader) loses its device within a few frames of drawing, even for
 * Babylon's own minimal shader material.  Building the effects is enough
 * to get their sources.  The full game on WebGPU is the opt-in
 * webgpu.spec.ts.
 *
 * Run: npm run test:e2e -- wgsl-shaders
 */
import { test, expect } from "@playwright/test";
import { wgslError } from "../../src/testing/wgsl-validate";

test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader", "--in-process-gpu"],
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  },
});

const PIECES = ["sky", "horizon", "water", "terrain", "wind"];

for (const renderer of ["webgpu", "webgl"] as const) {
  test(`the five custom shaders compile on ${renderer}`, async ({ page, baseURL }) => {
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
    const state = await page.evaluate(() => (window as any).__shaders());
    expect(state.webgpu).toBe(renderer === "webgpu");
    expect(state.ready).toEqual(Object.fromEntries(PIECES.map((p) => [p, true])));
    if (renderer === "webgpu") {
      // The exact WGSL Babylon generated for each piece, validated by naga.
      for (const piece of PIECES) {
        for (const stage of ["vertex", "fragment"] as const) {
          const code = state.sources[piece]?.[stage];
          expect(code, `${piece} ${stage} source`).toBeTruthy();
          expect(wgslError(code), `${piece} ${stage}`).toBeNull();
        }
      }
    } else {
      await expect.poll(() => page.evaluate(() => (window as any).__shaders().frames), { timeout: 30_000 }).toBeGreaterThan(30);
    }
    expect(shaderErrors, shaderErrors.join("\n")).toEqual([]);
    expect(outside, `fetched from outside:\n${outside.join("\n")}`).toEqual([]);
  });
}
