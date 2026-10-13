/**
 * Visual Shots — Playwright
 *
 * Boots the real game, completes character creation, and writes screenshots
 * of the world to `test-results/visual-shots/` for eyeballing rendering
 * changes. Not an assertion suite; skipped unless VISUAL_SHOTS=1.
 *
 * Run: VISUAL_SHOTS=1 npx playwright test visual-shots
 */

import { test, expect, Page } from "@playwright/test";

async function completeCharacterCreation(page: Page) {
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 90_000 });
  const continueBtn = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();
  await continueBtn.click();
  await continueBtn.click();
  await root.locator(".character-create__name-input").fill("Shots");
  await continueBtn.click();
  for (let i = 0; i < 2; i++) {
    const card = root.locator(".character-create__cards .character-create__card").first();
    await card.click();
    await continueBtn.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

test.skip(!process.env.VISUAL_SHOTS, "set VISUAL_SHOTS=1 to capture screenshots");

test("capture world screenshots", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.text()); });
  await page.addInitScript((tier) => {
    localStorage.clear();
    if (tier) localStorage.setItem("camelot_graphics_tier", tier);
    localStorage.setItem("camelot_adaptive_res", "0");
  }, process.env.VISUAL_TIER ?? "high");
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);
  await expect(page.locator("#display-fps")).toContainText(/fps/, { timeout: 60_000 });
  await page.waitForTimeout(8_000);
  const dir = "test-results/visual-shots";
  const canvas = page.locator("#renderCanvas");
  await canvas.click({ force: true });
  await page.evaluate(() => {
    const cam = (window as any).__camelotScene?.activeCamera;
    if (cam?.rotation) cam.rotation.x = 0.12;
  });
  await page.waitForTimeout(1_500);
  let errorsBeforeEval = errors.length;
  if (process.env.VISUAL_EVAL) {
    errorsBeforeEval = errors.length;
    const out = await page.evaluate(process.env.VISUAL_EVAL);
    console.log("EVAL:", JSON.stringify(out, null, 1));
    await page.waitForTimeout(1_500);
  }
  await page.screenshot({ path: `${dir}/01-spawn.png` });
  if (process.env.VISUAL_QUICK) {
    console.log("errors after eval:", errors.length - errorsBeforeEval);
    console.log("errors:", errors.filter((e) => !/TUNNEL|GPU stall|AudioContext|FantasyAssetLoader/.test(e)).slice(0, 20));
    return;
  }
  // Pan the camera around with synthetic mouse movement.
  const yaws = [400, 400, 400];
  for (let i = 0; i < yaws.length; i++) {
    await page.evaluate((dx) => {
      const cam = (window as any).__camelotScene?.activeCamera;
      if (cam?.rotation) { cam.rotation.y += dx / 400; cam.rotation.x = 0.12; }
    }, yaws[i]);
    await page.waitForTimeout(2_500);
    await page.screenshot({ path: `${dir}/0${i + 2}-view.png` });
  }
  await page.keyboard.down("w");
  await page.waitForTimeout(3_000);
  await page.keyboard.up("w");
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: `${dir}/05-walked.png` });
  const fps = await page.locator("#display-fps").textContent();
  console.log("FPS:", fps, "errors:", errors.slice(0, 10));
});
