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
  // Every model loads (they are meshopt-compressed with WebP textures).
  const loadFailures: string[] = [];
  page.on("console", (m) => { if (/failed to load|Unable to load/i.test(m.text())) loadFailures.push(m.text().slice(0, 300)); });
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
          const p = g.villages.planFor(cx, cz);
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

  // The light budget (checked again at night below): the same few always-on
  // point lights from the fire light pool, whatever is loaded.
  const pointLights = () => page.evaluate((v) => {
    const g = (window as any).__camelotGame;
    const on = g.scene.lights.filter((l: any) => l.getClassName() === "PointLight" && l.isEnabled());
    return { names: on.map((l: any) => l.name) as string[],
      litNear: on.filter((l: any) => l.intensity > 0 && Math.hypot(l.position.x - v!.x, l.position.z - v!.z) < 45).length };
  }, v);
  const dayLights = await pointLights();
  expect(dayLights.names.every((n) => /^fireLight_\d+$/.test(n)), `only the pool's lights are on: ${dayLights.names}`).toBe(true);

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

  // ── The navmesh: built in its worker from the ground and the village walls ──
  await expect.poll(() => page.evaluate(() => (window as any).__camelotGame.navigationSystem.isReady), {
    timeout: 60_000, message: "the navmesh loads",
  }).toBe(true);
  const nav = await page.evaluate((v) => {
    const g = (window as any).__camelotGame;
    const ns = g.navigationSystem;
    const V = g.player.camera.position.constructor;
    const path = ns.findPath(new V(v!.x - 18, 0, v!.z - 18), new V(v!.x + 18, 0, v!.z + 18));
    return {
      inWorker: !!ns._worker,
      walls: ns.collectInputMeshes().filter((m: any) => m.name.startsWith("bldg_wall_")).length,
      waypoints: path.length,
    };
  }, v);
  expect(nav.inWorker, "built off the main thread").toBe(true);
  expect(nav.walls, "the village walls are in it").toBeGreaterThan(10);
  expect(nav.waypoints, "a route across the village").toBeGreaterThan(1);

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
    g.eventBus.emit("dialogue:action", { eventId: "jobs:ask", npcName: g._currentDialogueNpcName });
    // Not yet: the window waits for the conversation to close…
    const waited = !g.jobs.window.isVisible;
    g.eventBus.emit("dialogue:closed", {});
    const opened = waited && g.jobs.window.isVisible;
    click("Accept");
    const active = g.jobs.rules.getActive()[0];
    const questId = g.jobs.questIdOf(active.boardId);
    const questOf = () => g.questSystem.getQuests().find((q: any) => q.id === questId);
    const t = g.jobs.rules.constructor.template(active.templateId);
    const handInEnabledEarly = !document.querySelector<HTMLButtonElement>(".job-board__btn--primary")!.disabled;
    // Fulfil it (supply: stock the bag; bounty: fake the kills) and collect.
    if (t.kind === "supply") {
      g.inventorySystem.addItem({ id: t.target, name: t.target, description: "", stackable: true, quantity: t.required, weight: 0 });
    } else {
      for (let i = 0; i < t.required; i++) g._quests.apply("kill", g._quests.targetId(`${t.target}_${i}`));
    }
    // The job is a radiant quest: done-but-unpaid, it stays open until it's handed in.
    g._quests.apply("kill", "Nobody");
    const before = questOf();
    const openBeforeHandIn = !!before && !before.isCompleted && before.isActive;
    g.saveSystem.save(true);
    const saved = JSON.parse(localStorage.getItem("camelot_save")!).villageJobs;
    const goldBefore = g._pack.gold();
    g.jobs.open({ boardId: active.boardId, placeName: active.placeName }); // re-render with the goods in hand
    click("Hand in");
    click("Close");
    return {
      opened, handInEnabledEarly, closed: !g.jobs.window.isVisible, openBeforeHandIn,
      template: t.id, place: active.placeName, questName: before?.name,
      savedActive: saved.active.length, paid: g._pack.gold() - goldBefore,
      reward: t.rewardGold, questDone: questOf()?.isCompleted, left: g.jobs.rules.getActive().length,
    };
  });
  expect(job.opened, "the job window opens").toBe(true);
  expect(job.handInEnabledEarly, "can't hand in before the work is done").toBe(false);
  expect(job.closed).toBe(true);
  expect(job.openBeforeHandIn, "a finished job isn't completed until it's paid").toBe(true);
  expect(job.place).toBe(v!.name);
  expect(job.questName).toContain(v!.name);
  expect(job.savedActive).toBe(1);
  expect(job.paid).toBe(job.reward);
  expect(job.questDone).toBe(true);
  expect(job.left).toBe(0);

  // ── The notice board in the square: press E to open the window, then abandon ──
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const p = [...g.villages.loaded().values()][0];
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
    const before = g.jobs.rules.getActive().length;
    g.interactionSystem.interact();
    const opened = g.jobs.window.isVisible;
    btn("Accept").click();
    const taken = g.jobs.rules.getActive().length;
    const questId = g.jobs.questIdOf(g.jobs.rules.getActive()[0]?.boardId);
    const logged = g.questSystem.getQuests().some((q: any) => q.id === questId && !q.isCompleted);
    btn("Abandon").click();
    const inLog = g.questSystem.getQuests().some((q: any) => q.id === questId);
    btn("Close").click();
    return { before, opened, taken, logged, after: g.jobs.rules.getActive().length, inLog, closed: !g.jobs.window.isVisible };
  });
  expect(boardJob, "the notice board opens the job window; jobs can be taken and abandoned")
    .toEqual({ before: 0, opened: true, taken: 1, logged: true, after: 0, inLog: false, closed: true });

  // ── Talking: the camera turns to the speaker's face and zooms in, then eases back ──
  const talk = await page.evaluate(async () => {
    const g = (window as any).__camelotGame; const c = g.player.camera;
    const plan = [...g.villages.loaded().values()][0];
    const npc = g.scheduleSystem.npcs.find((n: any) => /^(Innkeeper|Barkeeper|Villager)_/.test(n.mesh.name)
      && n.mesh.isEnabled() && Math.hypot(n.mesh.position.x - plan.center.x, n.mesh.position.z - plan.center.z) < 25);
    const p = npc.mesh.position;
    const dx = plan.center.x - p.x, dz = plan.center.z - p.z, l = Math.hypot(dx, dz) || 1;
    // Stand 2.5 m away on the square side, looking away from them.
    c.position.set(p.x + dx / l * 2.5, p.y + 0.7, p.z + dz / l * 2.5);
    c.rotation.set(0, Math.atan2(dx, dz), 0);
    const baseFov = c.fov;
    g.dialogueSystem.startDialogue(npc);
    await new Promise((r) => setTimeout(r, 1500));
    // Where the face lands on screen (0..1, y down).
    const eng = g.scene.getEngine();
    const face = new c.position.constructor(p.x, p.y + 0.62, p.z);
    const vp = c.viewport.toGlobal(eng.getRenderWidth(), eng.getRenderHeight());
    const proj = (c.position.constructor as any).Project(face, (g.scene.getTransformMatrix() as any).constructor.IdentityReadOnly, g.scene.getTransformMatrix(), vp);
    const during = {
      fov: c.fov, sx: proj.x / eng.getRenderWidth(), sy: proj.y / eng.getRenderHeight(),
      hotbarHidden: getComputedStyle(document.querySelector(".quickslot-hud") ?? document.body).display === "none"
        || !document.querySelector(".quickslot-hud"),
      npcStill: npc.mesh.position.clone(),
    };
    g.dialogueSystem.endDialogue();
    await new Promise((r) => setTimeout(r, 1500));
    return { baseFov, during: { ...during, npcStill: undefined }, after: { fov: c.fov, inDialogue: document.body.classList.contains("is-in-dialogue") } };
  });
  expect(talk.during.fov, "zooms in on the speaker").toBeLessThan(talk.baseFov * 0.8);
  expect(Math.abs(talk.during.sx - 0.5), "face centred horizontally").toBeLessThan(0.08);
  expect(talk.during.sy, "face in the upper part of the frame, above the dialogue panel").toBeGreaterThan(0.15);
  expect(talk.during.sy).toBeLessThan(0.5);
  expect(talk.during.hotbarHidden, "quick-slot bar hidden while talking").toBe(true);
  expect(talk.after.fov, "zoom eases back out").toBeCloseTo(talk.baseFov, 3);
  expect(talk.after.inDialogue).toBe(false);

  // ── A bandit raid: raiders march in up the road, townsfolk hide; beat them for a reward ──
  const raid = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const key = [...g.villages.loaded().keys()][0];
    const plan = g.villages.loaded().get(key);
    g.player.camera.position.set(plan.center.x + 2, 2, plan.center.z + 2);
    const raiders = g.raids.start(key, plan);
    (window as any).__raiders = raiders;
    const d = (n: any) => Math.hypot(n.mesh.position.x - plan.center.x, n.mesh.position.z - plan.center.z);
    const townsfolk = g.scheduleSystem.npcs.filter((n: any) => /^Villager_/.test(n.mesh.name) && d(n) < 30);
    return {
      raiders: raiders.length, startDist: Math.min(...raiders.map(d)),
      active: !!g.raids.rules.active, hidden: townsfolk.filter((n: any) => !n.mesh.isEnabled()).length,
      townsfolk: townsfolk.length,
    };
  });
  expect(raid.raiders).toBeGreaterThanOrEqual(2);
  expect(raid.active).toBe(true);
  expect(raid.hidden, "townsfolk run indoors").toBe(raid.townsfolk);
  // They come up the road toward the square.
  await expect.poll(() => page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const plan = [...g.villages.loaded().values()][0];
    return Math.min(...(window as any).__raiders.map((n: any) =>
      Math.hypot(n.mesh.position.x - plan.center.x, n.mesh.position.z - plan.center.z)));
  }), { timeout: 30_000, message: "raiders advance on the square" }).toBeLessThan(raid.startDist - 5);
  const raidEnd = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const gold = g._pack.gold();
    for (const r of (window as any).__raiders) {
      r.takeDamage(1e6);
      g.eventBus.emit("npc:killed", { npcName: r.mesh.name, xp: r.xpReward, npc: r });
    }
    return { paid: g._pack.gold() - gold, active: !!g.raids.rules.active };
  });
  expect(raidEnd.active).toBe(false);
  expect(raidEnd.paid, "beating the raid pays").toBe(35 * raid.raiders);
  await expect.poll(() => page.evaluate(() => {
    const g = (window as any).__camelotGame;
    return g.scheduleSystem.npcs.filter((n: any) => /^Villager_/.test(n.mesh.name) && !n.mesh.isEnabled()).length;
  }), { timeout: 5_000, message: "townsfolk come back out" }).toBe(0);

  // ── An abandoned raid: the raiders leave and the townsfolk come back out ──
  const abandoned = await page.evaluate(async () => {
    const g = (window as any).__camelotGame;
    const key = [...g.villages.loaded().keys()][0];
    const plan = g.villages.loaded().get(key);
    const raiders = g.raids.start(key, plan);
    const c = g.player.camera.position;
    c.set(plan.center.x + 90, 3, plan.center.z);
    // The raid watch checks twice a second of game time; under load frames
    // are slow, so wait for it rather than a fixed delay.
    for (let t = 0; t < 40 && g.raids.rules.active; t++) await new Promise((r) => setTimeout(r, 250));
    const out = {
      raiders: raiders.length,
      active: !!g.raids.rules.active,
      gone: raiders.every((r: any) => r.mesh.isDisposed()),
      inSchedule: raiders.filter((r: any) => g.scheduleSystem.npcs.includes(r)).length,
    };
    c.set(plan.center.x + 2, 3, plan.center.z + 2);
    return out;
  });
  expect(abandoned.raiders).toBeGreaterThan(0);
  expect(abandoned, "leaving ends the raid and sends the raiders off").toEqual({ raiders: abandoned.raiders, active: false, gone: true, inSchedule: 0 });
  await expect.poll(() => page.evaluate(() => {
    const g = (window as any).__camelotGame;
    return g.scheduleSystem.npcs.filter((n: any) => /^Villager_/.test(n.mesh.name) && !n.mesh.isEnabled() && g.scheduleSystem.behaviorOf(n) !== "sleep").length;
  }), { timeout: 5_000, message: "townsfolk come back out after an abandoned raid" }).toBe(0);

  // ── Buildings are walled, not solid: the doorway leads into an open interior ──
  const interior = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const plan = [...g.villages.loaded().values()][0];
    const b = plan.buildings.find((x: any) => x.role === "inn");
    const s = Math.sin(b.rot), co = Math.cos(b.rot);
    const at = (x: number, z: number) => ({ x: b.x + x * co + z * s, z: b.z - x * s + z * co });
    const depth = b.kind === "inn" ? 8 : 6;
    // Through the doorway from 2 m outside to the centre of the floor.
    const from = at(0, depth / 2 + 2), to = at(0, 0);
    const V = g.player.camera.position.constructor;
    const ray = (a: { x: number; z: number }, b2: { x: number; z: number }) => {
      const hit = g.scene.getPhysicsEngine().raycast(new V(a.x, 1.2, a.z), new V(b2.x, 1.2, b2.z));
      return hit.hasHit && /^bldg_/.test(hit.body?.transformNode?.name ?? "");
    };
    const width = b.kind === "inn" ? 6 : 4;
    return {
      doorway: ray(from, to),
      // Sanity check that the probe sees colliders at all: a side wall blocks.
      sideWall: ray(at(width / 2 + 2, 0), to),
    };
  });
  expect(interior, "the doorway leads into an open interior; the walls are solid")
    .toEqual({ doorway: false, sideWall: true });

  // ── Bedtime: villagers walk to their doors and go inside; they're back by morning ──
  const villagerState = () => page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const vs = g.scheduleSystem.npcs.filter((n: any) => /^Villager_/.test(n.mesh.name));
    return { total: vs.length, hidden: vs.filter((n: any) => !n.mesh.isEnabled()).length };
  });
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    g.timeSystem.advanceHours((23 - g.timeSystem.hour + 24) % 24);
  });
  await expect.poll(async () => (await villagerState()).hidden, { timeout: 150_000, message: "villagers go indoors at night (the game clock runs slow under load)" })
    .toBeGreaterThan(0);
  // At night the candle stands are lit by the pool, and the count of enabled
  // point lights is unchanged (no shader variants for a changing light count).
  await expect.poll(async () => (await pointLights()).litNear, { timeout: 10_000, message: "candles lit at night" }).toBeGreaterThan(0);
  expect((await pointLights()).names).toEqual(dayLights.names);

  // The inn stays open: the barkeeper keeps the night shift.
  const barkeep = await page.evaluate(() => {
    const g = (window as any).__camelotGame; const c = g.player.camera.position;
    const b = g.scheduleSystem.npcs.find((n: any) => /^Barkeeper_/.test(n.mesh.name)
      && Math.hypot(n.mesh.position.x - c.x, n.mesh.position.z - c.z) < 40);
    return { found: !!b, visible: !!b?.mesh.isEnabled(), talks: !!b?.mesh.metadata && !b.isAsleep };
  });
  expect(barkeep, "the barkeeper is up and serving at 23:00").toEqual({ found: true, visible: true, talks: true });
  const onWatch = await page.evaluate(() => {
    const g = (window as any).__camelotGame; const c = g.player.camera.position;
    return g.scheduleSystem.npcs.filter((n: any) => /^Town Guard_|^Guard_/.test(n.mesh.name)
      && Math.hypot(n.mesh.position.x - c.x, n.mesh.position.z - c.z) < 40
      && n.mesh.isEnabled() && g.scheduleSystem.behaviorOf(n) === "patrol").length;
  });
  expect(onWatch, "a guard keeps the night watch").toBe(1);
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    g.timeSystem.advanceHours((9 - g.timeSystem.hour + 24) % 24);
  });
  await expect.poll(async () => (await villagerState()).hidden, { timeout: 10_000, message: "and come out in the morning" })
    .toBe(0);

  // Character LODs: from 70 m the villagers draw their reduced models
  // (public/model/*.lod1.glb, bound to each rig's skeleton).
  await page.evaluate((v) => { (window as any).__camelotGame.player.camera.position.set(v!.x + 70, 6, v!.z); }, v);
  await expect.poll(() => page.evaluate(() => {
    const rigs = [...(window as any).__camelotGame._npcVisuals._rigs.values()];
    return rigs.filter((r: any) => r.detail === 1 && r.lodMeshes?.some((m: any) => m.isEnabled(false))
      && r.meshes.every((m: any) => m.getTotalVertices() === 0 || !m.isEnabled(false))).length;
  }), { timeout: 30_000, message: "distant rigs switch to their LOD" }).toBeGreaterThan(2);

  expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(loadFailures, `models that failed to load:\n${loadFailures.join("\n")}`).toEqual([]);
});
