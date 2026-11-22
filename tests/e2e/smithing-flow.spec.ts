/**
 * Smithing Flow — Playwright
 *
 * Drives the smithing / gear-wear loop in the real game through the dev-only
 * `window.__camelotGame` handle (the e2e server runs Vite in dev mode):
 *
 *   1. Away from any forge the panel is in field-smithing mode (no station);
 *      at the starting forge it is bound to "forge".
 *   2. The Village Smith's "use your forge" dialogue event opens the panel
 *      once the dialogue closes.
 *   3. Two copies of the same sword wear independently, and barter shows each
 *      copy's condition, prices the worn one lower, and sells the exact copy
 *      that was clicked.
 *
 * Run: npm run test:e2e -- smithing-flow
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
  await root.locator(".character-create__name-input").fill("Smith Tester");
  await continueBtn.click();
  for (let i = 0; i < 2; i++) {
    await root.locator(".character-create__cards .character-create__card").first().click();
    await continueBtn.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

test("forge stations, smith dialogue, and condition-aware barter", async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => {
    if (!/pointer\s*lock|pointerlock/i.test(err.message)) pageErrors.push(`${err.name}: ${err.message}`);
  });

  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);
  await expect(page.locator("#display-fps")).toContainText(/fps/, { timeout: 60_000 });
  await page.locator("#renderCanvas").click({ force: true });

  const forge = page.locator(".crafting-ui");

  // ── 1. Field smithing far from any forge ─────────────────────────────────
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    g.player.camera.position.set(400, 6, -400);
  });
  await page.keyboard.press("Shift+B");
  await expect(forge).toBeVisible();
  await expect(forge).not.toHaveAttribute("data-active-station", /.+/);
  await forge.locator('[data-recipe-id="smith_steel_sword"]').click();
  await expect(forge.locator(".crafting-ui__craft-blocker")).toContainText(/Forge/);
  await forge.locator(".crafting-ui__close").click();
  await expect(forge).toBeHidden();

  // ── 2. The smith's dialogue opens the forge after the dialogue closes ────
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    g.player.camera.position.set(0, 6, 0); // back to the starting forge
    g._handleDialogueHostEvent("smithing:open");
    g.dialogueSystem.onDialogueClosed?.();
  });
  await expect(forge).toBeVisible();
  await expect(forge).toHaveAttribute("data-active-station", "forge");
  await forge.locator(".crafting-ui__close").click();
  await expect(forge).toBeHidden();

  // ── 3. Two swords, one worn: barter tells them apart ─────────────────────
  const ids = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const base = { id: "iron_sword", name: "Iron Sword", description: "", stackable: false, quantity: 1, slot: "mainHand", weight: 3, stats: { damage: 10, value: 80 } };
    g.inventorySystem.addItem({ ...base, stats: { ...base.stats } });
    g.inventorySystem.addItem({ ...base, stats: { ...base.stats } });
    const copies = g.inventorySystem.items.filter((i: any) => i.id === "iron_sword");
    // Equip the second copy, batter it to 60%, and put it back in the bag.
    g.equipmentSystem.handleItemClick(copies[1]);
    for (let i = 0; i < 40; i++) g.smithing.onWeaponHit(true);
    const worn = g.equipmentSystem.getEquipped().get("mainHand");
    g.equipmentSystem.unequip("mainHand");
    // Shops keep hours: move the clock to 10:00.
    const h = g.timeSystem.hour;
    g.timeSystem.advanceHours((24 + 10 - h) % 24);
    g._handleDialogueHostEvent("barter:open", { merchantId: "merchant_armor_01" });
    g.dialogueSystem.onDialogueClosed?.();
    return { wornId: worn.instanceId as string, condition: g.smithing.getItemCondition(worn) as number };
  });
  expect(ids.condition).toBe(60);

  const playerList = page.locator("[aria-label='Player inventory']");
  await expect(playerList).toBeVisible();
  const wornRow = playerList.locator(`[data-instance-id="${ids.wornId}"]`);
  await expect(wornRow.locator(".barter-ui__item-tag")).toHaveText("60%");
  const freshRow = playerList.locator('[data-item-id="iron_sword"]:not([data-instance-id])');
  await expect(freshRow).toHaveCount(1);

  const price = async (row: typeof wornRow) =>
    Number((await row.locator(".barter-ui__item-price").textContent())!.replace(/\D/g, ""));
  expect(await price(wornRow)).toBeLessThan(await price(freshRow));

  await wornRow.locator(".barter-ui__action-btn--sell").click();
  const left = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    return g.inventorySystem.items.filter((i: any) => i.id === "iron_sword").map((i: any) => i.instanceId ?? null);
  });
  expect(left, "the worn copy was sold, the fresh one kept").toEqual([null]);

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
});
