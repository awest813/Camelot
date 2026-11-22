/**
 * Performance budgets (engine overhaul, Phase 0).
 *
 * Boots a fixed world seed so the scenes are the same every run, then
 * measures CPU-side render counts (draw calls per frame, active meshes, scene
 * meshes, materials, textures) at the start area and in the first village,
 * and fails when a scene exceeds tests/e2e/perf-budgets.json.
 *
 * Headless CI renders with software GL, so frame *times* mean nothing here;
 * the counts are what this guards.  Budgets ratchet down as the overhaul
 * lands (docs/engine-overhaul-plan.md).
 *
 * Re-baseline after a deliberate change:
 *   PERF_BUDGET_UPDATE=1 npx playwright test perf-budget
 */
import { test, expect, Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BUDGET_FILE = fileURLToPath(new URL("./perf-budgets.json", import.meta.url));
const SEED = "camelot-perf-1";
/** Budgets sit this far above the measured baseline (scenes animate a little). */
const HEADROOM = 1.15;

type Metrics = {
  drawCalls: number;
  activeMeshes: number;
  meshes: number;
  materials: number;
  textures: number;
};

async function createCharacterWithSeed(page: Page, seed: string) {
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 90_000 });
  const next = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();
  await next.click();                                   // welcome → world
  await root.locator("#world-seed-input").fill(seed);
  await next.click();                                   // world → name
  await root.locator(".character-create__name-input").fill("Budget");
  await next.click();
  for (let i = 0; i < 2; i++) {                         // race, birthsign
    await root.locator(".character-create__cards .character-create__card").first().click();
    await next.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

async function measure(page: Page): Promise<Metrics> {
  // The engine's draw-call counter only grows: diff two consecutive frames.
  const drawCalls = await page.evaluate(() => new Promise<number>((resolve) => {
    const sc = (window as any).__camelotGame.scene; const eng = sc.getEngine();
    let first = -1;
    const obs = sc.onAfterRenderObservable.add(() => {
      const now = eng._drawCalls.current;
      if (first < 0) { first = now; return; }
      sc.onAfterRenderObservable.remove(obs);
      resolve(now - first);
    });
  }));
  const rest = await page.evaluate(() => {
    const sc = (window as any).__camelotGame.scene;
    return {
      activeMeshes: sc.getActiveMeshes().length,
      meshes: sc.meshes.length,
      materials: sc.materials.length,
      textures: sc.textures.length,
    };
  });
  return { drawCalls, ...rest };
}

test("render counts stay within budget", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("camelot_graphics_tier", "high");
    localStorage.setItem("camelot_adaptive_res", "0");
  });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await createCharacterWithSeed(page, SEED);

  const scenes: Record<string, Metrics> = {};

  // Start area: fixed spot and view, noon.
  await page.evaluate(() => {
    const g = (window as any).__camelotGame; const c = g.player.camera;
    g.timeSystem.advanceHours((12 - g.timeSystem.hour + 24) % 24);
    c.position.set(0, 3, 0);
    c.setTarget(new c.position.constructor(30, 2, 40));
  });
  await page.waitForTimeout(10_000);
  scenes.start = await measure(page);

  // First village of the seed, looking across the square.
  const found = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    for (let r = 3; r < 40; r++) for (let cx = -r; cx <= r; cx++) for (const cz of [-r, r]) {
      const p = g._villagePlanFor(cx, cz);
      if (p) {
        const c = g.player.camera;
        c.position.set(p.center.x + 6, 2, p.center.z + 6);
        c.setTarget(new c.position.constructor(p.center.x, 1.5, p.center.z));
        return true;
      }
    }
    return false;
  });
  expect(found, "the perf seed has a village").toBe(true);
  await page.waitForTimeout(12_000);
  scenes.village = await measure(page);

  console.log("perf budget measurements:", JSON.stringify(scenes));

  if (process.env.PERF_BUDGET_UPDATE) {
    const budgets = Object.fromEntries(Object.entries(scenes).map(([name, m]) => [
      name,
      Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.ceil(v * HEADROOM)])),
    ]));
    writeFileSync(BUDGET_FILE, JSON.stringify({ seed: SEED, headroom: HEADROOM, budgets }, null, 2) + "\n");
    return;
  }

  const { budgets } = JSON.parse(readFileSync(BUDGET_FILE, "utf8")) as { budgets: Record<string, Metrics> };
  const over: string[] = [];
  for (const [name, m] of Object.entries(scenes)) {
    for (const [k, v] of Object.entries(m) as Array<[keyof Metrics, number]>) {
      const max = budgets[name]?.[k];
      if (max !== undefined && v > max) over.push(`${name}.${k}: ${v} > ${max}`);
    }
  }
  expect(over, "scenes over their render budgets").toEqual([]);
});
