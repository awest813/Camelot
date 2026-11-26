/**
 * The map (M): opens over play as a parchment chart with the places known
 * and the player's mark; M or Escape closes it.  Mute moved to F7.
 */
import { test, expect } from "@playwright/test";
import { passTitle } from "./helpers/title";

const OUT = process.env.SHOT_DIR;

test("M opens the map; M and Escape close it; F7 mutes", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(e.message); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await passTitle(page);
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 30_000 });
  const next = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();
  await next.click();
  await root.locator("#world-seed-input").fill("map-kingdom");
  await next.click();
  await root.locator(".character-create__name-input").fill("Tristan");
  await next.click();
  for (let i = 0; i < 2; i++) { await root.locator(".character-create__card").first().click(); await next.click(); }
  await root.locator(".character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.locator("#renderCanvas").click({ force: true });
  await page.waitForTimeout(300);

  const map = page.locator(".map-panel");
  await page.keyboard.press("m");
  await expect(map).toBeVisible({ timeout: 10_000 });
  await expect(map.locator("#map-title")).toHaveText("Map of the Realm");
  await expect(map.locator(".map-panel__me")).toHaveCount(1);
  const places = await map.locator(".map-panel__places-btn").allTextContents();
  expect(places.length, "a new game knows its starting place").toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__camelotGame.audioSystem.isMuted), "M no longer mutes").toBe(false);
  // Something is drawn on the chart.
  const inked = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>(".map-panel__canvas")!;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++;
    return n;
  });
  expect(inked).toBeGreaterThan(50);
  if (OUT) await page.screenshot({ path: `${OUT}/map.png` });

  await page.keyboard.press("m");
  await expect(map).toHaveCount(0);
  await page.keyboard.press("m");
  await expect(map).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(map).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__camelotGame.isPaused), "Escape closed the map, not into the pause menu").toBe(false);

  await page.keyboard.press("F7");
  expect(await page.evaluate(() => (window as any).__camelotGame.audioSystem.isMuted), "F7 mutes").toBe(true);
  expect(errors).toEqual([]);
});
