/**
 * Boot Smoke — Playwright
 *
 * Boots the REAL game (index.html → app.ts → BabylonJS + Havok + the full
 * Game wiring), drives the character-creation wizard, and verifies the
 * post-Phases 0–5 runtime:
 *
 *   1. Engine + physics initialise (no fatal-error banner).
 *   2. Character creation completes and tears down.
 *   3. The render loop reaches steady state (FPS element updates).
 *   4. The full save graph round-trips through localStorage (F5), including
 *      the newly wired survival / flavor-event state.
 *   5. A save load (F9) does not crash the running game.
 *   6. No uncaught page errors and no unexpected console errors accumulate.
 *
 * Run: npm run test:e2e -- boot-smoke
 */

import { test, expect, Page, ConsoleMessage } from "@playwright/test";

/** Errors that are benign in a headless browser and filtered from assertions. */
function isBenignConsoleError(msg: ConsoleMessage): boolean {
  const text = msg.text();
  // External resource noise (Google Fonts, favicon) — network availability is
  // not under test; same-origin script failures break boot and are caught by
  // the functional assertions below instead.
  if (text.startsWith("Failed to load resource")) return true;
  // Software-GL driver chatter on headless Chromium.
  if (/swiftshader|gpu stall|WebGL|ANGLE/i.test(text)) return true;
  return false;
}

function isBenignPageError(err: Error): boolean {
  // Pointer lock without a real display is harmless for smoke purposes.
  return /pointer\s*lock|pointerlock/i.test(err.message);
}

/** Drive the character-creation wizard: Welcome → World → Name → Race → Birthsign → Class. */
async function completeCharacterCreation(page: Page) {
  // Fail fast if engine init aborts before the wizard mounts (e.g. Game.init throw).
  const root = page.locator(".character-create");
  const fatal = page.locator(".app-fatal-error");
  await expect(root.or(fatal)).toBeVisible({ timeout: 90_000 });
  if (await fatal.count()) {
    throw new Error(`Game failed to boot: ${await fatal.textContent()}`);
  }

  const continueBtn = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });

  // Welcome — opt out of the onboarding tutorial so its banner can't interfere.
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();

  // Welcome → World
  await continueBtn.click();
  // World → Name
  await continueBtn.click();

  // Name — entry is required to proceed.
  await root.locator(".character-create__name-input").fill("Smoke Tester");
  await continueBtn.click();

  // Race / Birthsign — no default selection; pick the first card each time.
  for (const step of ["race", "birthsign"] as const) {
    const card = root.locator(".character-create__cards .character-create__card").first();
    await expect(card).toBeVisible();
    await card.click();
    await continueBtn.click();
  }

  // Class → "Begin adventure" resolves creation and enters the world.
  const card = root.locator(".character-create__cards .character-create__card").first();
  await expect(card).toBeVisible();
  await card.click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();

  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

test("game boots, plays, saves, and loads without errors", async ({ page }) => {
  test.setTimeout(240_000);

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isBenignConsoleError(msg)) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    if (!isBenignPageError(err)) pageErrors.push(`${err.name}: ${err.message}`);
  });

  // Fresh session — no stale save or onboarding preferences.
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });

  await completeCharacterCreation(page);

  // Engine fatal errors surface as a DOM banner.
  await expect(page.locator(".app-fatal-error")).toHaveCount(0);

  // The render loop reaches steady state — app.ts writes the FPS element
  // (throttled to 2 Hz) only while scene.render() is running.
  const fps = page.locator("#display-fps");
  await expect(fps).toBeVisible({ timeout: 60_000 });
  await expect(fps).toContainText(/fps/, { timeout: 30_000 });

  // Let the world simulate for a few seconds (chunks stream, systems tick).
  await page.waitForTimeout(4_000);

  // Babylon keyboard input requires canvas focus — click it so F5/F9 reach the game.
  await page.locator("#renderCanvas").click({ force: true });

  // F5 — manual save.  Assert the full game-state graph serialised.
  await page.keyboard.press("F5");
  const saveRaw = await page.evaluate(() => localStorage.getItem("camelot_save"));
  expect(saveRaw, "manual save writes localStorage").toBeTruthy();
  const save = JSON.parse(saveRaw!);
  expect(save.version).toBeGreaterThan(20);
  expect(save.player.health).toBeGreaterThan(0);
  expect(save.survival, "survival state persists").toBeDefined();
  expect(save.travelEvents, "travel event cooldowns persist").toBeDefined();
  expect(save.ambientEvents, "ambient event cooldowns persist").toBeDefined();

  // F9 — load the save back into the live game without crashing.
  await page.keyboard.press("F9");
  await page.waitForTimeout(3_000);
  await expect(page.locator(".app-fatal-error")).toHaveCount(0);
  await expect(fps).toContainText(/fps/);

  // Error hygiene across the whole run.
  expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});
