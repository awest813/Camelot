import { test, expect } from "@playwright/test";

test("a knight can take a lane", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.locator(".select")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("h1")).toHaveText("Camelot Rift");
  await page.locator(".hero-card[data-hero=gawain]").click();
  await page.locator(".lane-btn[data-lane=top]").click();
  await page.locator("button.start").click();
  await expect(page.locator(".hud")).toBeVisible();
  await expect(page.locator(".ability[data-key=Q]")).toBeVisible();
  await expect(page.locator(".stick")).toBeVisible();
  await expect(page.locator(".minimap")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator(".fatal")).toBeHidden();
  expect(errors, errors.join("\n")).toEqual([]);
});
