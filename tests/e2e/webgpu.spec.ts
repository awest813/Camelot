/**
 * WebGPU — Playwright
 *
 * Boots the game on the WebGPU engine (headless Chromium's software adapter)
 * and checks it runs: the engine really is WebGPU, the world renders, no
 * shader fails, and nothing is fetched from another host. Babylon fetches its
 * GLSL→WGSL converters from a CDN only when a GLSL shader has to run under
 * WebGPU, so "no outside requests" means every shader in use has WGSL.
 *
 * Opt-in (WEBGPU_E2E=1): headless Chromium's software WebGPU (SwiftShader)
 * loses its device within a few frames here, even for Babylon's own minimal
 * shader material, so this needs a real GPU (or a sturdier software one).
 *
 * Run: WEBGPU_E2E=1 npm run test:e2e -- webgpu
 */
import { test, expect, Page } from "@playwright/test";

test.skip(!process.env.WEBGPU_E2E, "set WEBGPU_E2E=1 (needs a working WebGPU adapter)");

test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader", "--in-process-gpu"],
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
  },
});

async function completeCharacterCreation(page: Page) {
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 120_000 });
  const continueBtn = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();
  await continueBtn.click();
  await continueBtn.click();
  await root.locator(".character-create__name-input").fill("Gpu");
  await continueBtn.click();
  for (let i = 0; i < 2; i++) {
    await root.locator(".character-create__cards .character-create__card").first().click();
    await continueBtn.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 60_000 });
}

test("the game runs on WebGPU with every shader in WGSL", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  const origin = new URL(baseURL!).origin;
  const outside: string[] = [];
  const problems: string[] = [];
  page.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) outside.push(r.url()); });
  page.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) problems.push(`pageerror: ${e.message}`); });
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/Failed to load resource/.test(t)) problems.push(`error: ${t.slice(0, 300)}`);
    if (/shader|WGSL|glslang|twgsl|compil/i.test(t) && (m.type() === "error" || m.type() === "warning")) problems.push(`${m.type()}: ${t.slice(0, 300)}`);
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?renderer=webgpu", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);

  const engine = await page.evaluate(() => {
    const scene = (window as any).__camelotScene;
    return { webgpu: !!scene?.getEngine().isWebGPU, name: scene?.getEngine().name as string };
  });
  expect(engine.webgpu, `engine: ${engine.name}`).toBe(true);

  // Let the world stream in and render for a while.
  await expect.poll(() => page.evaluate(() => (window as any).__camelotScene.getActiveMeshes().length), { timeout: 90_000 })
    .toBeGreaterThan(20);
  await page.waitForTimeout(8000);
  const frames = await page.evaluate(() => (window as any).__camelotScene.getEngine().frameId as number);
  expect(frames, "frames rendered").toBeGreaterThan(50);

  expect(problems, problems.join("\n")).toEqual([]);
  expect(outside, `fetched from outside:\n${outside.join("\n")}`).toEqual([]);
});
