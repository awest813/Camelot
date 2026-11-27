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
 *   7. Nothing is fetched from another host (no CDN at runtime).
 *
 * Run: npm run test:e2e -- boot-smoke
 */

import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import { passTitle } from "./helpers/title";

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
  await passTitle(page);
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

test("game boots, plays, saves, and loads without errors", async ({ page, baseURL }) => {
  test.setTimeout(240_000);

  // Nothing at runtime comes from another host (no CDN): every asset,
  // shader and worker ships with the game.
  const origin = new URL(baseURL!).origin;
  const outsideRequests: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) outsideRequests.push(u);
  });

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

  // The starting forge is within reach of the spawn point: the forge panel
  // opens bound to it, so steel recipes are station-eligible here.
  await page.keyboard.press("Shift+B");
  await expect(page.locator(".crafting-ui")).toHaveAttribute("data-active-station", "forge");
  await page.locator(".crafting-ui__close").click();
  await page.locator("#renderCanvas").click({ force: true });

  // Walk forward. The camera's first collision query needs Babylon's collision
  // coordinator side-effect import; without it the query throws inside the
  // render loop and Babylon never queues another frame (the game froze on the
  // first step while idle boot looked fine).
  await page.keyboard.down("w");
  await page.waitForTimeout(1_500);
  await page.keyboard.up("w");
  expect(pageErrors, `walking threw inside the render loop:\n${pageErrors.join("\n")}`).toEqual([]);

  // Shift+B — the smithing forge opens, crafts from the starter kit, and closes.
  await page.keyboard.press("Shift+B");
  const forge = page.locator(".crafting-ui");
  await expect(forge).toBeVisible();
  await expect(forge.locator(".crafting-ui__title")).toHaveText("Smithing Forge");
  await forge.locator('[data-recipe-id="smith_iron_sword"]').click();
  await expect(forge.locator(".crafting-ui__mat-name").first()).toHaveText("Iron Ingot");
  await forge.locator(".crafting-ui__craft-btn").click();
  await expect(forge.locator('[data-recipe-id="smith_iron_sword"] .crafting-ui__craft-count')).toHaveText("×1");
  await forge.locator(".crafting-ui__close").click();
  await expect(forge).toBeHidden();
  await page.locator("#renderCanvas").click({ force: true });

  // P — the companion panel; summon the starter wolf, then put it away.
  await page.keyboard.press("p");
  const pets = await page.evaluate(async () => {
    const g = (window as any).__camelotGame;
    const panelOpen = g.petUI.isVisible as boolean;
    g.petUI.onSummon("pet_wolf");
    await new Promise((r) => setTimeout(r, 500));
    const body = g.scene.getMeshByName("pet_pet_wolf");
    const out = { panelOpen, spawned: !!body, physics: !!body?.physicsBody, same: g.petSystem === g.pets.pets };
    g.petUI.onDismiss();
    return { ...out, gone: !g.scene.getMeshByName("pet_pet_wolf") };
  });
  expect(pets, "companion panel, summon and dismiss").toEqual({ panelOpen: true, spawned: true, physics: true, same: true, gone: true });
  await page.keyboard.press("p");
  await page.locator("#renderCanvas").click({ force: true });

  // G — the follower panel opens and closes.
  await page.keyboard.press("g");
  expect(await page.evaluate(() => (window as any).__camelotGame.followerUI.isVisible), "follower panel open").toBe(true);
  await page.keyboard.press("g");
  expect(await page.evaluate(() => (window as any).__camelotGame.followerUI.isVisible), "follower panel closed").toBe(false);
  await page.locator("#renderCanvas").click({ force: true });

  // N — the shouts panel; Shift+N with nothing equipped says so.
  await page.keyboard.press("n");
  expect(await page.evaluate(() => (window as any).__camelotGame.shoutUI.isVisible), "shouts panel open").toBe(true);
  // Escape closes it (it used to pause the game underneath instead).
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    return { open: g.shoutUI.isVisible, paused: g.isPaused };
  })).toEqual({ open: false, paused: false });
  await page.locator("#renderCanvas").click({ force: true });
  expect(await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    g.shouts.use();
    return g.shoutUI.isVisible === false && g.oldTongueSystem === g.shouts.shouts;
  }), "shout used without errors").toBe(true);

  // Y — the travel menu; travel home; the open world is never a destination.
  await page.keyboard.press("y");
  expect(await page.evaluate(() => (window as any).__camelotGame.fastTravelUI.isVisible), "travel menu open").toBe(true);
  const travel = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const before = g.timeSystem.elapsedGameTime;
    // Not a combat test: a stray swing may have provoked someone nearby.
    const host = g.kernel.services.get({ name: "travel-host" });
    const inCombat = host.inCombat;
    host.inCombat = () => false;
    g.fastTravelUI.onTravel("start_village");
    host.inCombat = inCombat;
    return {
      why: { combat: g.scheduleSystem.npcs.some((n: any) => n.isAggressive && !n.isDead), crouch: g.stealthSystem.isCrouching, enc: g.player.isEncumbered },
      open: g.fastTravelUI.isVisible,
      timePassed: g.timeSystem.elapsedGameTime >= before,
      places: g.fastTravelSystem.discoveredLocations.map((l: { id: string }) => l.id),
    };
  });
  expect(travel.open, JSON.stringify(travel)).toBe(false);
  expect(travel.timePassed).toBe(true);
  expect(travel.places).toContain("start_village");
  expect(travel.places).not.toContain("exterior");
  await page.locator("#renderCanvas").click({ force: true });

  // Death: fall at 0 health, wake a few seconds later at half health.
  await page.evaluate(() => { (window as any).__camelotGame.player.health = 0; });
  // While down, the death shot has the camera and play has no input.
  await expect.poll(
    () => page.evaluate(() => { const g = (window as any).__camelotGame; return `${g._camera.current}/${g._focus.holds("fallen")}`; }),
    { timeout: 20_000, message: "the fall takes the camera" },
  ).toBe("death/true");
  await expect.poll(
    () => page.evaluate(() => (window as any).__camelotGame.player.health),
    { timeout: 45_000, message: "the player wakes (game-clock seconds run slow under load)" },
  ).toBeGreaterThan(0);
  // Back on their feet: the view eases upright and input returns.
  await expect.poll(
    () => page.evaluate(() => { const g = (window as any).__camelotGame; return `${g._camera.current}/${g._focus.holds("fallen")}/${Math.abs(g.player.camera.rotation.z) < 0.01}`; }),
    { timeout: 20_000, message: "getting up gives the camera back" },
  ).toBe("gameplay/false/true");

  // Pickpocket picker on a peaceful NPC (they carry a coin purse); Escape closes it.
  expect(await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const mark = g.scheduleSystem.npcs.find((n: any) => !n.isDead && !n.isAggressive && g.pickpocketSystem.getNpcInventory(n.mesh.name)?.length);
    if (!mark) return "no mark";
    g.eventBus.emit("interact:pickpocket", { npc: mark });
    return g.pickpocketUI.isVisible ? "open" : "closed";
  })).toBe("open");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as any).__camelotGame.pickpocketUI.isVisible)).toBe(false);
  await page.locator("#renderCanvas").click({ force: true });

  // A kill with a loot table leaves pickups where the NPC fell.
  expect(await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const loot = () => g.scene.meshes.filter((m: any) => m.metadata?.type === "loot").length;
    const victim = g.scheduleSystem.npcs.find((n: any) => !n.isDead);
    const before = loot();
    const table = victim.lootTableId;
    victim.lootTableId = "boss_loot";
    g.eventBus.emit("npc:killed", { npcName: victim.mesh.name, xp: 1, npc: victim });
    victim.lootTableId = table;
    return loot() > before;
  }), "the kill dropped loot").toBe(true);

  // Fast travel into the Old Cave: the outdoors is hidden and the room is
  // dressed (rock, torchlight); then travel back out.
  const cave = await page.evaluate(async () => {
    const g = (window as any).__camelotGame;
    const travel = g.kernel.services.get({ name: "travel" });
    const host = g.kernel.services.get({ name: "travel-host" });
    host.inCombat = () => false;
    const said: string[] = [];
    const orig = g.ui.showNotification.bind(g.ui);
    g.ui.showNotification = (t: string, ms?: number) => { said.push(t); return orig(t, ms); };
    // Where walking in leaves you (the room's spawn), as a real visit records it.
    g.fastTravelSystem.discoverLocation("cave_01", "Old Cave", { x: 0, y: 1.5, z: 3 });
    // The trip fades out and in; wait for it (slow under load).
    const until = async (ok: () => boolean) => {
      for (let t = 0; t < 300 && !ok(); t++) await new Promise((r) => setTimeout(r, 100));
    };
    travel.travel("cave_01");
    await until(() => g.cellManager.currentCell?.type === "interior" && !g.ui.isScreenFadeActive);
    await new Promise((r) => setTimeout(r, 200));
    const inside = {
      cell: g.cellManager.currentCell?.type,
      outdoorsShown: g.world.visible,
      torch: !!g.scene.getMeshByName("intTorch_cave_01_-5.7"),
      dressed: !!g.scene.materials.find((m: any) => m.name === "intWall_cave_01")?.metadata?.dressed,
    };
    travel.travel("start_village");
    await until(() => g.cellManager.currentCell?.type === "exterior" && g.world.visible && !g.ui.isScreenFadeActive);
    g.ui.showNotification = orig;
    return { inside, back: g.cellManager.currentCell?.type, outdoorsShown: g.world.visible, said };
  });
  expect({ ...cave, said: undefined }, cave.said.join(" | ")).toEqual({ inside: { cell: "interior", outdoorsShown: false, torch: true, dressed: true }, back: "exterior", outdoorsShown: true, said: undefined });

  // The gear button opens the settings; Escape closes them, play resumes.
  // (The canvas holds the pointer lock, so click the button itself.)
  await page.evaluate(() => (document.querySelector(".graphics-settings-btn") as HTMLButtonElement).click());
  // (The dialog loads on first use.)
  await expect.poll(() => page.evaluate(() => (window as any).__camelotGame.graphicsSettingsUI.isVisible), { message: "settings open" }).toBe(true);
  // Interface size 150%: the HUD grows, the 3D view keeps its resolution.
  const scaled = await page.evaluate(() => {
    const eng = (window as any).__camelotGame.scene.getEngine();
    const size = () => ({ bar: document.querySelector(".hud-bar")!.getBoundingClientRect().width, render: eng.getRenderWidth() });
    const before = size();
    const chip = Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-label="Interface size"] button')).find((b) => b.textContent === "150% Size")!;
    chip.click();
    eng.resize();
    const after = size();
    Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-label="Interface size"] button')).find((b) => b.textContent === "100% Size")!.click();
    return { ratio: after.bar / before.bar, sameRender: after.render === before.render, kept: localStorage.getItem("camelot.accessibility") };
  });
  expect(scaled.ratio, "the HUD scales with the interface size").toBeCloseTo(1.5, 2);
  expect(scaled.sameRender, "the 3D view keeps its resolution").toBe(true);
  expect(scaled.kept, "the choice is kept").toContain('"uiScale":1');
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    return { open: g.graphicsSettingsUI.isVisible, paused: g.isPaused };
  })).toEqual({ open: false, paused: false });
  await page.locator("#renderCanvas").click({ force: true });

  // A character level-up: ten major-skill raises open the dialog; picking
  // three attributes and confirming levels up and gives play back (it used
  // to soft-lock: the dialog shown had lost its confirm).
  const before = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const major = g.classSystem.chosenClass.majorSkills[0];
    for (let i = 0; i < 10; i++) g.playerLevelSystem.handleSkillLevelUp(major);
    return g.playerLevelSystem.characterLevel as number;
  });
  await expect(page.locator(".level-up")).toBeVisible();
  const attrs = page.locator(".level-up__attr-btn");
  for (let i = 0; i < 3; i++) await attrs.nth(i).click();
  await page.locator(".level-up__confirm-btn").click();
  expect(await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    return { level: g.playerLevelSystem.characterLevel, open: g.levelUpUI.isVisible, blocked: g.interactionSystem.isBlocked };
  })).toEqual({ level: before + 1, open: false, blocked: false });
  await page.locator("#renderCanvas").click({ force: true });

  // Combat input: a left click swings, Q casts.
  await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const calls: string[] = ((window as any).__combatCalls = []);
    const c = g.combatSystem, sp = g.spellSystem;
    const melee = c.meleeAttack.bind(c), cast = sp.castSpell.bind(sp);
    c.meleeAttack = () => { calls.push("melee"); return melee(); };
    sp.castSpell = () => { calls.push("cast"); return cast(); };
  });
  await page.locator("#renderCanvas").click({ force: true });
  await page.keyboard.press("q");
  expect(await page.evaluate(() => (window as any).__combatCalls)).toEqual(expect.arrayContaining(["melee", "cast"]));

  // Each panel key opens its panel and closes it again.
  for (const [key, open] of [
    ["i", "g.inventorySystem.isOpen"], ["j", "g.questSystem.isLogOpen"], ["k", "g.skillTreeSystem.isOpen"],
    ["u", "g.ui.isAttributePanelOpen"], ["t", "g.ui.isWaitDialogOpen"],
  ] as const) {
    const isOpen = () => page.evaluate((src) => new Function("g", `return ${src}`)((window as any).__camelotGame), open) as Promise<boolean>;
    await page.locator("#renderCanvas").focus();
    await page.keyboard.press(key);
    await expect.poll(isOpen, { message: `${key} opens (the panel loads on first use)` }).toBe(true);
    await page.keyboard.press(key);
    expect(await isOpen(), `${key} closes`).toBe(false);
  }
  // The pause menu (Preact): Escape pauses, Escape inside it resumes, and so does Resume.
  const paused = () => page.evaluate(() => (window as any).__camelotGame.isPaused) as Promise<boolean>;
  await page.locator("#renderCanvas").focus();
  await page.keyboard.press("Escape");
  expect(await paused(), "Escape pauses").toBe(true);
  await expect(page.locator("#pause-title")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await paused(), "Escape in the menu resumes").toBe(false);
  await expect(page.locator("#pause-title")).toHaveCount(0);
  await page.locator("#renderCanvas").focus();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Resume", exact: true }).first().click();
  expect(await paused(), "Resume resumes").toBe(false);

  // The crafting panels (Preact, on the DOM layer) open by key; Escape closes them.
  for (const [key, open, title] of [
    ["l", "g.alchemyUI.isVisible", "#alchemy-title"], ["b", "g.enchantingUI.isVisible", "#enchanting-title"],
  ] as const) {
    const isOpen = () => page.evaluate((src) => new Function("g", `return ${src}`)((window as any).__camelotGame), open) as Promise<boolean>;
    await page.locator("#renderCanvas").focus();
    await page.keyboard.press(key);
    await expect.poll(isOpen, { message: `${key} opens (the panel loads on first use)` }).toBe(true);
    await expect(page.locator(title)).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await isOpen(), `Escape closes the ${key} panel`).toBe(false);
    expect(await page.evaluate(() => (window as any).__camelotGame.isPaused), "that Escape doesn't also pause").toBe(false);
    await expect(page.locator(title)).toHaveCount(0);
  }
  await page.locator("#renderCanvas").click({ force: true });

  // The credits (the first Preact panel) open, and Escape closes them.
  await page.evaluate(() => (window as any).__camelotGame.kernel.services.get({ name: "settings" }).openCredits());
  await expect(page.locator("#credits-title")).toHaveText("Credits");
  await page.keyboard.press("Escape");
  await expect(page.locator("#credits-title")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__camelotGame.isPaused), "Escape closed the credits, not paused").toBe(false);
  await page.locator("#renderCanvas").click({ force: true });

  // A guard stops the player for a bounty; Escape resists arrest.
  const arrest = await page.evaluate(() => {
    const g = (window as any).__camelotGame;
    const guard = g.scheduleSystem.npcs.find((n: any) => !n.isDead);
    if (!guard) return { skipped: true };
    g.crimeSystem.setBounty("town", 40);
    g.crimeSystem.onGuardChallenge(guard, "town", 40);
    return { skipped: false, open: g.guardEncounterUI.isVisible as boolean };
  });
  expect(arrest.skipped, "an NPC to play the guard").toBe(false);
  {
    expect(arrest.open, "the arrest panel opens").toBe(true);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => {
      const g = (window as any).__camelotGame;
      return { open: g.guardEncounterUI.isVisible, bounty: g.crimeSystem.getBounty("town") };
    })).toEqual({ open: false, bounty: 50 });
    await page.evaluate(() => (window as any).__camelotGame.crimeSystem.clearBounty("town"));
    await page.locator("#renderCanvas").click({ force: true });
  }

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
  expect(save.crafting?.recipeSnapshots, "smithing state persists").toContainEqual({ id: "smith_iron_sword", craftCount: 1 });
  expect(save.itemCondition, "gear condition persists").toBeDefined();
  const forged = save.inventory.find((i: { id: string }) => i.id.startsWith("iron_sword"));
  expect(forged, "forged sword is in the bag").toBeDefined();
  expect(forged.instanceId, "forged gear has its own instance").toBeTruthy();
  expect(save.itemCondition.conditions[forged.instanceId], "forged gear starts pristine").toBe(100);

  // F9 — load the save back into the live game without crashing.
  await page.keyboard.press("F9");
  await page.waitForTimeout(3_000);
  await expect(page.locator(".app-fatal-error")).toHaveCount(0);
  await expect(fps).toContainText(/fps/);

  // Error hygiene across the whole run.
  expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(outsideRequests, `fetched from another host:\n${outsideRequests.join("\n")}`).toEqual([]);
  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});
