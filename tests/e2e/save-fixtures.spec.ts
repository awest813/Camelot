/**
 * Save-fixture corpus (engine overhaul, Phase 0).
 *
 * Every fixture in tests/fixtures/saves/ is a real save written by an older
 * build, plus a summary of what it must restore.  Each one is loaded into a
 * fresh game and the restored state is compared with that summary, so
 * changes to the save format (Phase 5 replaces it with per-feature codecs)
 * have to keep old saves loading.
 *
 * Capture a new fixture from the current build (writes v<SAVE_VERSION>-midgame.json):
 *   SAVE_FIXTURE_CAPTURE=1 npx playwright test save-fixtures
 */
import { test, expect, Page } from "@playwright/test";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../fixtures/saves/", import.meta.url));

interface Fixture {
  description: string;
  saveVersion: number;
  capturedAt: string;
  save: unknown;
  expect: Summary;
}

async function createCharacter(page: Page, seed: string) {
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 90_000 });
  const next = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();
  await next.click();
  await root.locator("#world-seed-input").fill(seed);
  await next.click();
  await root.locator(".character-create__name-input").fill("Fixture");
  await next.click();
  for (let i = 0; i < 2; i++) {
    await root.locator(".character-create__cards .character-create__card").first().click();
    await next.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

/** What a save must restore, read from the live game (installed in the page). */
function installSummary(): void {
  (window as any).__fixtureSummary = () => {
    const g = (window as any).__camelotGame;
    return {
      playerName: g.player.name as string,
      level: g.playerLevelSystem.characterLevel as number,
      gold: g._pack.gold() as number,
      items: g.inventorySystem.items.map((i: any) => `${i.id}×${i.quantity}`).sort() as string[],
      hour: Math.floor(g.timeSystem.hour) as number,
      activeJobs: g.jobs.rules.getActive().map((j: any) => `${j.boardId}:${j.templateId}:${j.progress}`).sort() as string[],
      discovered: (g.fastTravelSystem.discoveredLocations ?? []).map((l: any) => l.id).sort() as string[],
      activeQuests: g.questSystem.getQuests().filter((q: any) => q.isActive).map((q: any) => q.id).sort() as string[],
    };
  };
}

type Summary = {
  playerName: string; level: number; gold: number; items: string[]; hour: number;
  activeJobs: string[]; discovered: string[]; activeQuests: string[];
};


test.describe("save fixtures", () => {
  test.skip(!!process.env.SAVE_FIXTURE_CAPTURE, "capturing instead");

  let files: string[] = [];
  try { files = readdirSync(DIR).filter((f) => f.endsWith(".json")); } catch { /* none yet */ }

  for (const file of files) {
    test(`loads ${file}`, async ({ page }) => {
      test.setTimeout(180_000);
      const fixture = JSON.parse(readFileSync(DIR + file, "utf8")) as Fixture;
      const errors: string[] = [];
      page.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(e.message); });
      await page.addInitScript(() => localStorage.clear());
      await page.addInitScript(installSummary);
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await createCharacter(page, "fixture-check");

      // Load and read the restored state in the same tick: game time runs
      // fast (and hourly events can grant gold), so no frames in between.
      const { loaded, summary } = await page.evaluate((save) => {
        const g = (window as any).__camelotGame;
        localStorage.setItem("camelot_save", JSON.stringify(save));
        const ok = g.saveSystem.load();
        return { loaded: ok as boolean, summary: (window as any).__fixtureSummary() };
      }, fixture.save);
      expect(loaded, `${file} loads`).toBe(true);
      expect(summary, `${file}: restored state`).toEqual(fixture.expect);
      // …and the game keeps running cleanly afterwards.
      await page.waitForTimeout(1500);
      expect(errors, `${file}: page errors`).toEqual([]);
    });
  }
});

test("capture a fixture from this build", async ({ page }) => {
  test.skip(!process.env.SAVE_FIXTURE_CAPTURE, "set SAVE_FIXTURE_CAPTURE=1 to capture");
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.clear());
  await page.addInitScript(installSummary);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await createCharacter(page, "fixture-capture");

  // A short scripted mid-game: gold and goods, a discovered village with a
  // job taken there, a level-up's worth of XP, and the clock moved on.
  await page.evaluate(async () => {
    const g = (window as any).__camelotGame;
    g.inventorySystem.addItem({ id: "gold_coins", name: "Gold Coins", description: "", stackable: true, quantity: 250, weight: 0 });
    g.inventorySystem.addItem({ id: "iron_ingot", name: "Iron Ingot", description: "", stackable: true, quantity: 3, weight: 1 });
    g.inventorySystem.addItem({ id: "potion_hp_01", name: "Health Potion", description: "", stackable: true, quantity: 2, weight: 0.5 });
    for (let r = 3; r < 40; r++) for (let cx = -r; cx <= r; cx++) for (const cz of [-r, r]) {
      const p = g.villages.planFor(cx, cz);
      if (p) { g.player.camera.position.set(p.center.x, 3, p.center.z); r = 99; cx = 99; break; }
    }
  });
  await expect.poll(() => page.evaluate(() => (window as any).__camelotGame.villages.loaded().size), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const [key, plan] = [...g.villages.loaded().entries()][0];
    const [cx, cz] = key.split(",").map(Number);
    g.jobs.open({ boardId: `inn_${cx}_${cz}`, placeName: plan.name });
    (document.querySelector(".job-board__btn--primary") as HTMLButtonElement)?.click();
    g.jobs.window.hide(); g.jobs.window.onClose?.();
    g.timeSystem.advanceHours(5);
  });
  // Let the hour change's world events (rewards, caches) settle, then save
  // and read the summary in the same tick so they agree.
  await page.waitForTimeout(3000);
  const expected = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    g.saveSystem.save(true);
    return (window as any).__fixtureSummary();
  }) as Summary;

  const saveVersion = await page.evaluate(() => JSON.parse(localStorage.getItem("camelot_save")!).version as number);
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem("camelot_save")!));
  expect(expected.activeJobs.length, "the capture took a job").toBe(1);
  expect(expected.discovered.length, "the capture discovered the village").toBeGreaterThan(0);

  mkdirSync(DIR, { recursive: true });
  const fixture: Fixture = {
    description: "Mid-game: 250 gold, iron and potions, a discovered village with an active job, clock advanced 5 h.",
    saveVersion,
    capturedAt: new Date().toISOString().slice(0, 10),
    save,
    expect: expected,
  };
  writeFileSync(`${DIR}v${saveVersion}-midgame.json`, JSON.stringify(fixture, null, 2) + "\n");
});
