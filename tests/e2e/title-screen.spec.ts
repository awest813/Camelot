/**
 * The title screen: a fresh start offers New Game; with a save it offers
 * Continue, which loads the hero back into their own world (seed and
 * position) without the character creator.
 */
import { test, expect, type Page } from "@playwright/test";

async function newCharacter(page: Page, seed: string) {
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 30_000 });
  const next = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();
  await next.click();
  await root.locator("#world-seed-input").fill(seed);
  await next.click();
  await root.locator(".character-create__name-input").fill("Percival");
  await next.click();
  for (let i = 0; i < 2; i++) {
    await root.locator(".character-create__cards .character-create__card").first().click();
    await next.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

const OUT = process.env.SHOT_DIR;

test("title: New Game on a fresh start; Continue loads the hero back into their world", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(e.message); });
  // Clear storage once, not on the reload.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("title-test")) { localStorage.clear(); sessionStorage.setItem("title-test", "1"); }
  });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });

  const title = page.locator(".title-screen");
  await expect(title).toBeVisible({ timeout: 90_000 });
  const labels = () => title.locator(".title-screen__label").allTextContents();
  expect(await labels()).toEqual(["New Game", "Settings", "Credits"]);
  expect(await page.evaluate(() => (window as any).__camelotGame.isPaused), "play waits behind the title").toBe(true);
  if (OUT) await page.screenshot({ path: `${OUT}/title-fresh.png` });
  // Enter on the focused first line: New Game.
  await page.keyboard.press("Enter");
  await expect(title).toHaveCount(0);
  await newCharacter(page, "title-kingdom");

  // Walk a little, then save.
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    g.player.camera.position.x += 3;
    g.saveSystem.save(true);
    return { seed: g.world.seed?.seedString, x: g.player.camera.position.x, z: g.player.camera.position.z };
  });
  expect(saved.seed).toBe("title-kingdom");

  // A new session: Continue is offered, with the hero's name.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(title).toBeVisible({ timeout: 90_000 });
  expect(await labels()).toEqual(["Continue", "New Game", "Settings", "Credits"]);
  await expect(title.locator(".title-screen__detail")).toHaveText(/^Percival · Level 1 · saved (just now|1 minute ago)$/);
  if (OUT) await page.screenshot({ path: `${OUT}/title-continue.png` });
  await title.locator(".title-screen__item", { hasText: "Continue" }).click();
  await expect(title).toHaveCount(0);
  await expect(page.locator(".character-create"), "no character creator on Continue").toHaveCount(0);
  const loaded = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    return { seed: g.world.seed?.seedString, x: g.player.camera.position.x, z: g.player.camera.position.z, paused: g.isPaused, name: g.player.name };
  });
  expect(loaded.seed, "the saved world, not a fresh one").toBe("title-kingdom");
  expect(loaded.name).toBe("Percival");
  expect(loaded.paused).toBe(false);
  expect(Math.hypot(loaded.x - saved.x, loaded.z - saved.z)).toBeLessThan(0.5);
  expect(errors).toEqual([]);
});
