import { expect, type Page } from "@playwright/test";

/**
 * The game opens on the title screen (except in replay mode, which goes
 * straight to the character creator).  Choose New Game when it is there.
 */
export async function passTitle(page: Page): Promise<void> {
  const title = page.locator(".title-screen");
  await expect(title.or(page.locator(".character-create")).or(page.locator(".app-fatal-error")).first()).toBeVisible({ timeout: 90_000 });
  if (await title.isVisible()) {
    await title.locator(".title-screen__item", { hasText: "New Game" }).click();
    await expect(title).toHaveCount(0);
  }
}
