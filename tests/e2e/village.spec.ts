/**
 * Village settlements — Playwright
 *
 * Finds the nearest planned village (dev-only `window.__camelotGame`), walks
 * into it, and checks the settlement is really there: six buildings around
 * the square, its residents (innkeeper, smith, guards…), a working forge,
 * and that entering the square discovers it as a fast-travel destination.
 *
 * Run: npm run test:e2e -- village
 */
import { test, expect, Page } from "@playwright/test";

async function completeCharacterCreation(page: Page) {
  const root = page.locator(".character-create");
  await expect(root).toBeVisible({ timeout: 90_000 });
  const cont = root.locator(".character-create__actions button", { hasText: /Continue|Begin/i });
  const skip = root.locator(".character-create__checkbox-row input[type=checkbox]");
  if (await skip.count()) await skip.first().check();
  await cont.click();
  await cont.click();
  await root.locator(".character-create__name-input").fill("Wanderer");
  await cont.click();
  for (let i = 0; i < 2; i++) {
    await root.locator(".character-create__cards .character-create__card").first().click();
    await cont.click();
  }
  await root.locator(".character-create__cards .character-create__card").first().click();
  await root.locator(".character-create__actions button", { hasText: /Begin/i }).click();
  await expect(root).toHaveCount(0, { timeout: 30_000 });
}

test("a village is built, populated and discovered on entry", async ({ page }) => {
  test.setTimeout(300_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => {
    if (!/pointer\s*lock|pointerlock/i.test(err.message)) pageErrors.push(`${err.name}: ${err.message}`);
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await completeCharacterCreation(page);

  const v = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    for (let r = 3; r < 40; r++) {
      for (let cx = -r; cx <= r; cx++) {
        for (const cz of [-r, r]) {
          const p = g._villagePlanFor(cx, cz);
          if (p) return { id: p.id, name: p.name, x: p.center.x, z: p.center.z };
        }
      }
    }
    return null;
  });
  expect(v, "a village exists within 40 chunks of the start").not.toBeNull();

  await page.evaluate((v) => { (window as any).__camelotGame.player.camera.position.set(v!.x, 3, v!.z); }, v);

  // Discovery fires within a moment of standing in the square.
  await expect.poll(
    () => page.evaluate((id) => (window as any).__camelotGame.fastTravelSystem.isDiscovered(id), v!.id),
    { timeout: 60_000 },
  ).toBe(true);

  // Buildings stream in as their models load.
  await expect.poll(
    () => page.evaluate((v) => (window as any).__camelotGame.scene.meshes.filter((m: any) =>
      /^fantasy_vRoof/.test(m.name) && Math.hypot(m.position.x - v!.x, m.position.z - v!.z) < 25).length, v),
    { timeout: 90_000 },
  ).toBe(6);

  const state = await page.evaluate((v) => {
    const g = (window as any).__camelotGame;
    const near = (x: number, z: number, r: number) => Math.hypot(x - v!.x, z - v!.z) < r;
    return {
      npcs: g.scheduleSystem.npcs.filter((n: any) => near(n.mesh.position.x, n.mesh.position.z, 22))
        .map((n: any) => n.mesh.name.replace(/_\d+$/, "")),
      roofs: g.scene.meshes.filter((m: any) => /^fantasy_vRoof/.test(m.name) && near(m.position.x, m.position.z, 25)).length,
      forge: g.forges.stationAt(v!.x, v!.z, 25) ?? null,
      calm: g.scheduleSystem.npcs.filter((n: any) => near(n.mesh.position.x, n.mesh.position.z, 22)).every((n: any) => !n.isAggressive),
    };
  }, v);
  expect(state.roofs).toBe(6);
  expect(state.forge).toBe("forge");
  for (const who of ["Innkeeper", "Barkeeper", "Village Smith", "Town Guard"]) {
    expect(state.npcs, `${who} lives in ${v!.name}`).toContain(who);
  }
  expect(state.calm, "villagers don't attack a visitor").toBe(true);

  // ── The innkeeper offers work in the job window; it lands in the quest log and the save ──
  const job = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const click = (label: string) => {
      const btn = Array.from(document.querySelectorAll<HTMLButtonElement>(".job-board__btn")).find((b) => b.textContent === label);
      if (!btn) throw new Error(`no "${label}" button`);
      btn.click();
      return !btn.disabled;
    };
    const inn = g.scheduleSystem.npcs.find((n: any) => /^Innkeeper_/.test(n.mesh.name)
      && Math.hypot(n.mesh.position.x - g.player.camera.position.x, n.mesh.position.z - g.player.camera.position.z) < 25);
    g._currentDialogueNpcName = inn.mesh.name;
    g._handleDialogueHostEvent("jobs:ask");
    // The window opens once the dialogue closes.
    const pending = g._pendingJobBoard;
    g._askForWork(pending);
    g._pendingJobBoard = null;
    const opened = g.jobBoardUI.isVisible;
    click("Accept");
    const active = g.villageJobs.getActive()[0];
    const quest = g.questSystem.getQuests().find((q: any) => q.id === g._jobQuestId(active.boardId));
    const t = g.villageJobs.constructor.template(active.templateId);
    const handInEnabledEarly = !document.querySelector<HTMLButtonElement>(".job-board__btn--primary")!.disabled;
    // Fulfil it (supply: stock the bag; bounty: fake the kills) and collect.
    if (t.kind === "supply") {
      g.inventorySystem.addItem({ id: t.target, name: t.target, description: "", stackable: true, quantity: t.required, weight: 0 });
    } else {
      for (let i = 0; i < t.required; i++) g.villageJobs.onKill(`${t.target}_${i}`);
    }
    g.saveSystem.save(true);
    const saved = JSON.parse(localStorage.getItem("camelot_save")!).villageJobs;
    const goldBefore = g._getInventoryGold();
    g._askForWork(pending); // re-render with the goods in hand
    click("Hand in");
    click("Close");
    return {
      opened: !!pending && opened, handInEnabledEarly, closed: !g.jobBoardUI.isVisible,
      template: t.id, place: active.placeName, questName: quest?.name,
      savedActive: saved.active.length, paid: g._getInventoryGold() - goldBefore,
      reward: t.rewardGold, questDone: quest?.isCompleted, left: g.villageJobs.getActive().length,
    };
  });
  expect(job.opened, "the job window opens").toBe(true);
  expect(job.handInEnabledEarly, "can't hand in before the work is done").toBe(false);
  expect(job.closed).toBe(true);
  expect(job.place).toBe(v!.name);
  expect(job.questName).toContain(v!.name);
  expect(job.savedActive).toBe(1);
  expect(job.paid).toBe(job.reward);
  expect(job.questDone).toBe(true);
  expect(job.left).toBe(0);

  // ── The notice board in the square: press E to open the window, then abandon ──
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const p = g._villagePlans.get([...g._loadedVillages.keys()][0]);
    const nb = p.noticeBoard; const c = g.player.camera;
    c.position.set(nb.x + Math.sin(nb.rot) * 1.8, 1.6, nb.z + Math.cos(nb.rot) * 1.8);
    c.setTarget(new c.position.constructor(nb.x, 1.45, nb.z));
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/village-notice-board.png" });
  const boardJob = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const btn = (label: string) =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".job-board__btn")).find((b) => b.textContent === label)!;
    const before = g.villageJobs.getActive().length;
    g.interactionSystem.interact();
    const opened = g.jobBoardUI.isVisible;
    btn("Accept").click();
    const taken = g.villageJobs.getActive().length;
    const questId = g._jobQuestId(g.villageJobs.getActive()[0]?.boardId);
    const logged = g.questSystem.getQuests().some((q: any) => q.id === questId && !q.isCompleted);
    btn("Abandon").click();
    const inLog = g.questSystem.getQuests().some((q: any) => q.id === questId);
    btn("Close").click();
    return { before, opened, taken, logged, after: g.villageJobs.getActive().length, inLog, closed: !g.jobBoardUI.isVisible };
  });
  expect(boardJob, "the notice board opens the job window; jobs can be taken and abandoned")
    .toEqual({ before: 0, opened: true, taken: 1, logged: true, after: 0, inLog: false, closed: true });

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
});
