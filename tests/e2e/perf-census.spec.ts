/**
 * Perf census — Playwright (opt-in)
 *
 * Records scene statistics (meshes, active meshes, draw calls, materials,
 * textures, skeletons, animation groups, shadow casters) at the start and in a
 * village, then CPU-profiles the village scene.
 *
 * Run: PERF_CENSUS=1 npx playwright test perf-census
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
  await root.locator(".character-create__name-input").fill("Profiler");
  await continueBtn.click();
  for (let i = 0; i < 2; i++) {
    await root.locator(".character-create__cards .character-create__card").first().click();
    await continueBtn.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

interface ProfileNode { id: number; callFrame: { functionName: string; url: string; lineNumber: number } }
interface Profile { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] }

async function stats(page: Page, label: string) {
  const s = await page.evaluate(() => {
    const g = (window as any).__camelotGame; const sc = g.scene; const eng = sc.getEngine();
    const active = sc.getActiveMeshes();
    let activeVerts = 0; for (let i = 0; i < active.length; i++) activeVerts += active.data[i].getTotalVertices?.() ?? 0;
    const sg = g.shadowGenerator; const casters = sg?.getShadowMap()?.renderList?.length ?? 0;
    const byPrefix = new Map<string, number>();
    for (let i = 0; i < active.length; i++) { const n = active.data[i].name.replace(/[_\d.]+.*$/, "").slice(0, 24); byPrefix.set(n, (byPrefix.get(n) ?? 0) + 1); }
    return {
      meshes: sc.meshes.length, active: active.length, activeVerts,
      drawCalls: eng._drawCalls?.current ?? -1,
      materials: sc.materials.length, textures: sc.textures.length,
      skeletons: sc.skeletons.length, animGroupsPlaying: sc.animationGroups.filter((a: any) => a.isPlaying).length,
      animGroups: sc.animationGroups.length, lights: sc.lights.length, shadowCasters: casters,
      shadowMapSize: sg?.getShadowMap()?.getSize()?.width, npcs: g.scheduleSystem.npcs.length,
      particleSystems: sc.particleSystems.length,
      topActive: [...byPrefix.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14),
    };
  });
  console.log(`== ${label}: ${JSON.stringify(s)}`);
}

async function profile(page: Page, label: string, ms: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
  await page.waitForTimeout(ms);
  const { profile } = (await cdp.send("Profiler.stop")) as unknown as { profile: Profile };
  const self = new Map<number, number>();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const byFn = new Map<string, number>();
  for (const node of profile.nodes) {
    const t = self.get(node.id) ?? 0; if (!t) continue;
    const f = node.callFrame; const file = f.url.split("/").pop()?.split("?")[0] ?? "";
    const key = `${f.functionName || "(anon)"} ${file}:${f.lineNumber + 1}`;
    byFn.set(key, (byFn.get(key) ?? 0) + t);
  }
  console.log(`== profile ${label}: total ${(total / 1000).toFixed(0)} ms`);
  for (const [k, t] of [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${((t / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
}

test.skip(!process.env.PERF_CENSUS, "set PERF_CENSUS=1 to run");

test("perf census", async ({ page }) => {
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("camelot_graphics_tier", "high"); localStorage.setItem("camelot_adaptive_res", "0"); });
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);
  await page.waitForTimeout(10_000);
  await stats(page, "start");
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    for (let r = 3; r < 40; r++) for (let cx = -r; cx <= r; cx++) for (const cz of [-r, r]) {
      const p = g._villagePlanFor(cx, cz);
      if (p) { const c = g.player.camera; c.position.set(p.center.x + 6, 2, p.center.z + 6); c.setTarget(new c.position.constructor(p.center.x, 1.5, p.center.z)); return; }
    }
  });
  await page.waitForTimeout(12_000);
  await stats(page, "village");
  await profile(page, "village idle", 8000);
});
