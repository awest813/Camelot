/**
 * Editor tools smoke test: every tool the Editor Hub offers opens (and the
 * map editor toggles) in the running game without errors, and the asset
 * browser starts out seeded.  The editors live in the editor app
 * (editor.html, engine overhaul Phase 9); the game page has none.
 */
import { test, expect, Page } from "@playwright/test";
import { passTitle } from "./helpers/title";

async function completeCharacterCreation(page: Page) {
  await passTitle(page);
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
  await page.goto("/editor.html", { waitUntil: "domcontentloaded", timeout: 60_000 });
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
      mapEditorOn: g.mapEditorActive,
      assetsSeeded: g.editors.assetBrowserSystem.size as number,
    };
  }, TOOLS as unknown as string[]);

  expect(result.out).toEqual(Object.fromEntries(TOOLS.map((t) => [t, "ok"])));
  expect(result.mapEditorOn, "the map editor toggled on").toBe(true);
  expect(result.assetsSeeded, "the asset browser opens seeded with base content").toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test("editor and tool chords reach their handlers", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(`${e.name}: ${e.message}`); });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/editor.html", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);
  const canvas = page.locator("#renderCanvas");
  const g = <T>(fn: string) => page.evaluate((src) => new Function("g", `return (${src})`)((window as any).__camelotGame), fn) as Promise<T>;

  // Ctrl+Shift+M (global): the Mod Manifest editor, not Mark.
  await canvas.click({ force: true });
  await page.keyboard.press("Control+Shift+M");
  expect(await g<boolean>("g.editors.modManifestUI.isVisible"), "Ctrl+Shift+M opens the mod manifest").toBe(true);
  expect(await g<boolean>("!!g.markRecallSystem.markedPosition"), "and does not mark").toBe(false);
  await page.evaluate(() => (window as any).__camelotGame.editors.modManifestUI.close());

  // In gameplay, F7 mutes (M is the map).
  await canvas.click({ force: true });
  const muted = await g<boolean>("g.audioSystem.isMuted");
  await page.keyboard.press("F7");
  expect(await g<boolean>("g.audioSystem.isMuted")).toBe(!muted);

  // F2: the map editor. T cycles the placement type; Ctrl+M toggles Scene Notes.
  await page.keyboard.press("F2");
  expect(await g<boolean>("g.editors.mapEditorSystem.isEnabled")).toBe(true);
  const before = await g<string>("g.editors.mapEditorSystem.currentPlacementType");
  await page.keyboard.press("t");
  expect(await g<string>("g.editors.mapEditorSystem.currentPlacementType"), "T cycles the placement type").not.toBe(before);
  const notes = await g<boolean>("g.editors.editorLayout.getPanelState('notes')?.isVisible ?? false");
  const mutedBefore = await g<boolean>("g.audioSystem.isMuted");
  await page.keyboard.press("Control+m");
  expect(await g<boolean>("g.editors.editorLayout.getPanelState('notes')?.isVisible ?? false"), "Ctrl+M toggles Scene Notes").toBe(!notes);
  expect(await g<boolean>("g.audioSystem.isMuted"), "Ctrl+M does not mute").toBe(mutedBefore);

  // N places an entity at the crosshair; Ctrl+Z takes it back; Ctrl+Y redoes it.
  const count0 = await g<number>("g.editors.mapEditorSystem.entityCount");
  await page.keyboard.press("n");
  expect(await g<number>("g.editors.mapEditorSystem.entityCount"), "N places").toBe(count0 + 1);
  await page.keyboard.press("Control+z");
  expect(await g<number>("g.editors.mapEditorSystem.entityCount"), "Ctrl+Z undoes").toBe(count0);
  await page.keyboard.press("Control+y");
  expect(await g<number>("g.editors.mapEditorSystem.entityCount"), "Ctrl+Y redoes").toBe(count0 + 1);

  // A tool opened and closed inside the editor leaves the editor holding input.
  await page.keyboard.press("Shift+F12");
  expect(await g<boolean>("g.editors.itemCreatorUI.isVisible")).toBe(true);
  await page.evaluate(() => (window as any).__camelotGame.editors.itemCreatorUI.close());
  expect(await g<boolean>("g._focus.holds('editor') && !g._focus.holds('menu') && g.interactionSystem.isBlocked"), "the editor still holds input").toBe(true);
  await canvas.focus();

  // Gameplay keys do nothing in the editor.
  await page.keyboard.press("j");
  expect(await g<boolean>("g.questSystem.isLogOpen"), "J in the editor").toBe(false);
  await page.keyboard.press("F2");
  expect(await g<boolean>("g.editors.mapEditorSystem.isEnabled")).toBe(false);
  expect(await g<boolean>("!g._focus.held && !g.interactionSystem.isBlocked"), "leaving the editor gives play its input back").toBe(true);

  // Shift+F12: the Item Creator, from play; the same chord closes it.
  await canvas.click({ force: true });
  await page.keyboard.press("Shift+F12");
  expect(await g<boolean>("g.editors.itemCreatorUI.isVisible"), "Shift+F12 opens the item creator").toBe(true);
  await page.evaluate(() => (window as any).__camelotGame.editors.itemCreatorUI.close());

  // Tab: the character sheet (the closed tool left focus on its panel).
  await canvas.click({ force: true });
  await canvas.focus();
  await page.keyboard.press("Tab");
  expect(await g<boolean>("g.characterSheetUI.isVisible"), "Tab opens the character sheet").toBe(true);
  await page.keyboard.press("Tab");
  expect(await g<boolean>("g.characterSheetUI.isVisible")).toBe(false);
  expect(errors).toEqual([]);
});

test("the game page has no editors; F2 does nothing there", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(`${e.name}: ${e.message}`); });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);
  await page.locator("#renderCanvas").click({ force: true });
  await page.keyboard.press("F2");
  await page.keyboard.press("F11");
  const state = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    return { editors: g.editors, mapEditor: g.mapEditorActive, title: document.title };
  });
  expect(state.editors).toBeNull();
  expect(state.mapEditor).toBe(false);
  expect(state.title).not.toMatch(/Editor/);
  expect(errors).toEqual([]);
});
