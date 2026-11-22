/**
 * Editor tools smoke test: every tool the Editor Hub offers opens (and the
 * map editor toggles) in the running game without errors, and the asset
 * browser starts out seeded.  Guards the EditorSuite move out of game.ts
 * (engine overhaul, Phase 1) until the editor app has its own suite (Phase 9).
 */
import { test, expect, Page } from "@playwright/test";

async function completeCharacterCreation(page: Page) {
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 90_000 });
  const next = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();
  await next.click();
  await next.click();
  await root.locator(".character-create__name-input").fill("Editor");
  await next.click();
  for (let i = 0; i < 2; i++) {
    await root.locator(".character-create__cards .character-create__card").first().click();
    await next.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

const TOOLS = ["map", "quest", "dialogue", "npc", "item", "faction", "lootTable", "spawn",
  "worldBuilder", "bundle", "assets", "merge", "modManifest"] as const;

test("every editor tool opens without errors", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(`${e.name}: ${e.message}`); });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);

  const result = await page.evaluate(async (tools) => {
    const g = (window as any).__camelotGame;
    const out: Record<string, string> = {};
    for (const tool of tools) {
      try {
        g.editors.openTool(tool);
        await new Promise((r) => setTimeout(r, 150));
        out[tool] = "ok";
      } catch (err) {
        out[tool] = String(err);
      }
    }
    return {
      out,
      mapEditorOn: g.mapEditorSystem.isEnabled,
      assetsSeeded: g.editors.assetBrowserSystem.size as number,
      sameObject: g.mapEditorSystem === g.editors.mapEditorSystem,
    };
  }, TOOLS as unknown as string[]);

  expect(result.out).toEqual(Object.fromEntries(TOOLS.map((t) => [t, "ok"])));
  expect(result.mapEditorOn, "the map editor toggled on").toBe(true);
  expect(result.sameObject, "game getters forward to the editor suite").toBe(true);
  expect(result.assetsSeeded, "the asset browser opens seeded with base content").toBeGreaterThan(10);
  expect(errors).toEqual([]);
});
