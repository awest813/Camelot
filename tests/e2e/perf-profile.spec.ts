/**
 * Perf Profile — Playwright (opt-in)
 *
 * Boots the real game, walks forward for a few seconds and records a CPU
 * profile of the main thread via the DevTools protocol, then prints the
 * hottest functions by self time and per-frame render stats.
 *
 * Run: PERF_PROFILE=1 npx playwright test perf-profile
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

interface ProfileNode { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] }
interface Profile { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] }

test.skip(!process.env.PERF_PROFILE, "set PERF_PROFILE=1 to profile");

test("profile gameplay CPU", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript((tier) => {
    localStorage.clear();
    localStorage.setItem("camelot_graphics_tier", tier);
    localStorage.setItem("camelot_adaptive_res", "0");
  }, process.env.VISUAL_TIER ?? "high");
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);
  await expect(page.locator("#display-fps")).toContainText(/fps/, { timeout: 60_000 });
  await page.waitForTimeout(8_000);
  await page.locator("#renderCanvas").click({ force: true });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
  await page.keyboard.down("w");
  await page.waitForTimeout(6_000);
  await page.keyboard.up("w");
  const { profile } = (await cdp.send("Profiler.stop")) as unknown as { profile: Profile };

  const self = new Map<number, number>();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const byFn = new Map<string, number>();
  for (const node of profile.nodes) {
    const t = self.get(node.id) ?? 0;
    if (!t) continue;
    const f = node.callFrame;
    const file = f.url.split("/").pop()?.split("?")[0] ?? "";
    const key = `${f.functionName || "(anon)"} ${file}:${f.lineNumber + 1}`;
    byFn.set(key, (byFn.get(key) ?? 0) + t);
  }
  const top = [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.PERF_TOP ?? 40));
  console.log(`total sampled: ${(total / 1000).toFixed(0)} ms`);
  for (const [k, t] of top) console.log(`${((t / total) * 100).toFixed(1).padStart(5)}%  ${(t / 1000).toFixed(0).padStart(6)} ms  ${k}`);
});
