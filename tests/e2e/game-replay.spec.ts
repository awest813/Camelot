/**
 * Whole-game replay: record a session with real input (keyboard and mouse
 * through Playwright) in `?replay=record`, play the log back on a fresh
 * page in `?replay=play`, and require the same end state: the player, the
 * clock, the bag, the quests, every NPC and the random streams.  The
 * session walks, jumps, opens the inventory, then fights a bandit (spawned
 * and aimed at with logged replay commands): its AI, steering, the hits
 * and the combat rolls all have to come out the same.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

async function createCharacter(page: Page, seed: string) {
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 90_000 });
  const next = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skipTips = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skipTips.count()) await skipTips.first().check();
  await next.click();
  await root.locator("#world-seed-input").fill(seed);
  await next.click();
  await root.locator(".character-create__name-input").fill("Replay");
  await next.click();
  for (let i = 0; i < 2; i++) {
    await root.locator(".character-create__cards .character-create__card").first().click();
    await next.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

/** The first place two digests differ (path: a ≠ b), or null. */
function digestDiff(a: unknown, b: unknown, path = ""): string | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = digestDiff((a as any)[k], (b as any)[k], path ? `${path}.${k}` : k);
      if (d) return d;
    }
  }
  return `${path || "(root)"}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}

const frame = (page: Page) => page.evaluate(() => (window as any).__camelotReplay.frame as number);
async function waitFrames(page: Page, n: number) {
  const until = (await frame(page)) + n;
  await expect.poll(() => frame(page), { timeout: 60_000 }).toBeGreaterThanOrEqual(until);
}

test("a recorded session replays to the same state on a fresh page", async ({ browser }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];

  // ── Record ──
  const rec = await browser.newPage();
  rec.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(e.message); });
  await rec.addInitScript(() => localStorage.clear());
  await rec.goto("/?replay=record", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await createCharacter(rec, "replay-check");
  await expect.poll(() => rec.evaluate(() => (window as any).__camelotReplay?.frame ?? 0), { timeout: 60_000 }).toBeGreaterThan(5);
  await waitFrames(rec, 30);
  const start = await rec.evaluate(() => (window as any).__camelotReplay.digest().player.position as number[]);

  // Walk, strafe, sprint, jump, swing, open and close the inventory.
  const box = (await rec.locator("#renderCanvas").boundingBox())!;
  await rec.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await waitFrames(rec, 5); // the game takes focus on the click's frame
  await rec.keyboard.down("w"); await waitFrames(rec, 40);
  await rec.keyboard.down("d"); await waitFrames(rec, 15); await rec.keyboard.up("d");
  // (The state just after the strafe: the negative check below stops here.)
  const afterStrafe = await rec.evaluate(() => (window as any).__camelotReplay.checkpoint());
  await rec.keyboard.down("Shift"); await waitFrames(rec, 20); await rec.keyboard.up("Shift");
  await rec.keyboard.press("Space"); await waitFrames(rec, 20);
  await rec.keyboard.up("w");
  for (let i = 0; i < 3; i++) {
    await rec.mouse.down(); await waitFrames(rec, 3); await rec.mouse.up(); await waitFrames(rec, 20);
  }
  await rec.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 10, { steps: 4 });
  await rec.keyboard.press("i"); await waitFrames(rec, 10);
  await rec.keyboard.press("i"); await waitFrames(rec, 30);

  // A fight: a bandit appears in front of the player (a logged command),
  // spots them, closes in and attacks; the player turns to it ("aim", a
  // scripted mouse look, which needs pointer lock otherwise) and swings.
  const before = await rec.evaluate(() => (window as any).__camelotReplay.digest());
  await rec.evaluate(() => (window as any).__camelotReplay.command("spawn", { archetype: "archetype_bandit", ahead: 5 }));
  await waitFrames(rec, 2);
  const fresh = await rec.evaluate(() => (window as any).__camelotReplay.digest().npcs);
  await waitFrames(rec, 38);
  for (let i = 0; i < 12; i++) {
    await rec.evaluate(() => (window as any).__camelotReplay.command("aim", {})); await waitFrames(rec, 1);
    await rec.mouse.down(); await waitFrames(rec, 3); await rec.mouse.up(); await waitFrames(rec, 22);
  }

  const recorded = await rec.evaluate(() => {
    const r = (window as any).__camelotReplay;
    const log = r.stop();
    return { log, digest: r.digest() };
  });
  await rec.close();
  // The fight happened: one bandit came, and the player's blows told.
  const newcomers = recorded.digest.npcs.filter((n: any) => !before.npcs.some((b: any) => b.key === n.key));
  expect(newcomers.map((n: any) => n.key.split("_")[0]), "the spawned bandit").toEqual(["Bandit"]);
  const spawnedHealth = fresh.find((n: any) => n.key === newcomers[0].key).health;
  expect(newcomers[0].health, "the bandit took hits").toBeLessThan(spawnedHealth * 0.6);
  expect(recorded.log.inputs.length, "the session's input was recorded").toBeGreaterThan(20);
  const moved = Math.hypot(recorded.digest.player.position[0] - start[0], recorded.digest.player.position[2] - start[2]);
  expect(moved, "the player walked").toBeGreaterThan(1);

  // ── Play back on a fresh page ──
  const replayed = await playBack(browser, recorded.log, errors);
  expect(replayed.frame).toBe(recorded.log.frames);
  const diff = digestDiff(recorded.digest, replayed.digest);
  expect(diff, "the replay ends in the recorded state").toBeNull();
  expect(errors).toEqual([]);

  // ── The check can fail: without the strafe to the right, the state differs ──
  // (Played up to the checkpoint just after the strafe, to keep it short.)
  const edited = {
    ...recorded.log, frames: afterStrafe.frame,
    inputs: recorded.log.inputs.filter((o: any) => o.init?.key !== "d" && o.f < afterStrafe.frame),
  };
  expect(edited.inputs.length).toBeLessThan(recorded.log.inputs.filter((o: any) => o.f < afterStrafe.frame).length);
  const other = await playBack(browser, edited, errors);
  expect(other.frame).toBe(afterStrafe.frame);
  expect(digestDiff(afterStrafe.digest, other.digest), "a different input log ends elsewhere").not.toBeNull();
});

/** Play `log` on a fresh page; its frame count and end state. */
async function playBack(browser: import("@playwright/test").Browser, log: unknown, errors: string[]) {
  const play = await browser.newPage();
  play.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(e.message); });
  await play.addInitScript((raw) => {
    localStorage.clear();
    localStorage.setItem("camelot_replay_log", raw);
  }, JSON.stringify(log));
  await play.goto("/?replay=play", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect.poll(() => play.evaluate(() => !!(window as any).__camelotReplay), { timeout: 90_000 }).toBe(true);
  const out = await play.evaluate(async () => {
    const r = (window as any).__camelotReplay;
    await r.done;
    return { frame: r.frame as number, digest: r.digest() };
  });
  await play.close();
  return out;
}

test("a session that loads a save (F9) replays from the storage it started with", async ({ browser }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/saves/v29-midgame.json", import.meta.url)), "utf8"));

  const rec = await browser.newPage();
  rec.on("pageerror", (e) => { if (!/pointer\s*lock/i.test(e.message)) errors.push(e.message); });
  await rec.addInitScript((save) => {
    localStorage.clear();
    localStorage.setItem("camelot_save", save);
  }, JSON.stringify(fixture.save));
  await rec.goto("/?replay=record", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await createCharacter(rec, "replay-load");
  await expect.poll(() => rec.evaluate(() => (window as any).__camelotReplay?.frame ?? 0), { timeout: 60_000 }).toBeGreaterThan(5);
  await waitFrames(rec, 20);
  const box = (await rec.locator("#renderCanvas").boundingBox())!;
  await rec.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await waitFrames(rec, 5);
  const fresh = await rec.evaluate(() => (window as any).__camelotReplay.digest().gold as number);
  await rec.keyboard.press("F9");
  await waitFrames(rec, 20);
  const loaded = await rec.evaluate(() => (window as any).__camelotReplay.digest().gold as number);
  await rec.keyboard.down("w"); await waitFrames(rec, 40); await rec.keyboard.up("w");
  await rec.keyboard.down("a"); await waitFrames(rec, 20); await rec.keyboard.up("a");
  for (let i = 0; i < 2; i++) { await rec.mouse.down(); await waitFrames(rec, 3); await rec.mouse.up(); await waitFrames(rec, 20); }
  const recorded = await rec.evaluate(() => {
    const r = (window as any).__camelotReplay;
    return { log: r.stop(), digest: r.digest() };
  });
  await rec.close();
  expect(loaded, "F9 loaded the mid-game save (its gold, not the new character's)").not.toBe(fresh);
  expect(loaded).toBeGreaterThanOrEqual(250);
  expect(Object.keys(recorded.log.storage), "the log keeps the save it started with").toContain("camelot_save");

  // Playback starts from empty storage: the log brings the save back.
  const replayed = await playBack(browser, recorded.log, errors);
  expect(replayed.frame).toBe(recorded.log.frames);
  expect(digestDiff(recorded.digest, replayed.digest), "the replay ends in the recorded state").toBeNull();
  expect(errors).toEqual([]);
});
