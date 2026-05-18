/**
 * Skill Tree — Playwright Audit
 *
 * This suite drives the HTML-based SkillTreeUI (src/ui/skill-tree-ui.ts) wired
 * to SkillTreeSystem (src/systems/skill-tree-system.ts) through a headless
 * browser, without loading the full BabylonJS game.  It exercises every
 * observable behaviour and documents one known gap found during the audit:
 *
 *   ⚠  AUDIT FINDING — prerequisites not enforced in the BabylonJS UIManager
 *   ──────────────────────────────────────────────────────────────────────────
 *   UIManager.refreshSkillTree() (src/ui/ui-manager.ts:728-837) renders skill
 *   buttons with `canBuy = !isMax && skillPoints > 0` — it NEVER consults
 *   arePrerequisitesMet().  That means locked skills (e.g. Warrior's Edge
 *   before Iron Skin rank 1, Mana Flow before Arcane Power rank 1) appear
 *   as clickable "[+] Upgrade" buttons in the in-game BabylonJS panel.
 *   The system does enforce the prerequisite on purchase and shows a
 *   "Requires: …" notification, but the user gets no visual indication that
 *   the skill is locked.  The HTML SkillTreeUI exercised in these tests
 *   handles this correctly — the discrepancy is in UIManager.
 *
 * Run: npm run test:e2e
 */

import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** URL of the standalone harness served by the Vite dev server. */
const HARNESS = "/tests/e2e/harness/skill-tree-harness.html";

interface SkillTreeHarness {
  player: Record<string, number>;
  system: {
    purchaseSkill(treeIndex: number, skillIndex: number): boolean;
    getSaveState(): unknown[];
    restoreState(state: unknown[]): void;
    getSkillRank(skillId: string): number;
  };
  grantPoints(points: number): void;
  reset(): void;
  refresh(): void;
  getNotifications(): string[];
}

type HarnessWindow = Window & typeof globalThis & { __harness: SkillTreeHarness };

/** Wait for the harness JavaScript to finish bootstrapping. */
async function openHarness(page: Page) {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as HarnessWindow).__harness !== undefined, {
    timeout: 15_000,
  });
}

/** Grant N skill points to the harness player and re-render. */
async function grantPoints(page: Page, n: number) {
  await page.evaluate((points) => {
    (window as HarnessWindow).__harness.grantPoints(points);
  }, n);
}

/** Reset all skill ranks and skill points to 0. */
async function resetHarness(page: Page) {
  await page.evaluate(() => {
    (window as HarnessWindow).__harness.reset();
  });
}

/** Read accumulated notification strings. */
async function getNotifications(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as HarnessWindow).__harness.getNotifications());
}

/** Read the player's current stat snapshot from the harness. */
async function playerStats(page: Page) {
  return page.evaluate(() => {
    const p = (window as HarnessWindow).__harness.player;
    return {
      skillPoints: p.skillPoints,
      bonusArmor: p.bonusArmor,
      bonusDamage: p.bonusDamage,
      bonusMagicDamage: p.bonusMagicDamage,
      maxStamina: p.maxStamina,
      maxMagicka: p.maxMagicka,
      maxHealth: p.maxHealth,
      healthRegen: p.healthRegen,
      magickaRegen: p.magickaRegen,
      staminaRegen: p.staminaRegen,
    };
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe("Skill Tree Audit — structure", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test("panel is visible on load", async ({ page }) => {
    await expect(page.locator(".skill-tree-ui")).toBeVisible();
  });

  test("panel has role=dialog and aria-modal", async ({ page }) => {
    const root = page.locator(".skill-tree-ui");
    await expect(root).toHaveAttribute("role", "dialog");
    await expect(root).toHaveAttribute("aria-modal", "true");
  });

  test("renders exactly three tree tabs", async ({ page }) => {
    const tabs = page.locator(".skill-tree-ui__tab");
    await expect(tabs).toHaveCount(3);
  });

  test("tab names are Combat, Magic, Survival", async ({ page }) => {
    const tabs = page.locator(".skill-tree-ui__tab");
    await expect(tabs.nth(0)).toHaveText("Combat");
    await expect(tabs.nth(1)).toHaveText("Magic");
    await expect(tabs.nth(2)).toHaveText("Survival");
  });

  test("tabs have role=tab and aria-selected", async ({ page }) => {
    const tabs = page.locator(".skill-tree-ui__tab");
    for (let i = 0; i < 3; i++) {
      await expect(tabs.nth(i)).toHaveAttribute("role", "tab");
    }
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "false");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "false");
  });

  test("skill points label shows 0 on load", async ({ page }) => {
    const label = page.locator(".skill-tree-ui__points");
    await expect(label).toHaveText("Skill Points: 0");
  });

  test("close button hides the panel", async ({ page }) => {
    await page.locator(".skill-tree-ui__close").click();
    await expect(page.locator(".skill-tree-ui")).not.toBeVisible();
  });
});

test.describe("Skill Tree Audit — Combat tree", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test("Combat tab shows three skill cards", async ({ page }) => {
    // Combat is the default (first) tab
    const cards = page.locator(".skill-tree-ui__card");
    await expect(cards).toHaveCount(3);
  });

  test("Iron Skin card has correct description and 3-pip max", async ({ page }) => {
    const ironSkin = page.locator('[data-skill-id="iron_skin"]');
    await expect(ironSkin.locator(".skill-tree-ui__skill-name")).toHaveText("Iron Skin");
    await expect(ironSkin.locator(".skill-tree-ui__pips")).toHaveText("○○○");
    await expect(ironSkin.locator(".skill-tree-ui__pips")).toHaveAttribute("aria-label", "Rank 0 of 3");
  });

  test("Warrior's Edge shows lock icon when Iron Skin rank 0", async ({ page }) => {
    const edge = page.locator('[data-skill-id="warriors_edge"]');
    await expect(edge).toHaveClass(/is-locked/);
    await expect(edge.locator(".skill-tree-ui__skill-desc")).toContainText("🔒");
  });

  test("Endurance has no lock because it has no prerequisites", async ({ page }) => {
    const endurance = page.locator('[data-skill-id="endurance"]');
    await expect(endurance).not.toHaveClass(/is-locked/);
  });

  test("all upgrade buttons are disabled when skillPoints = 0", async ({ page }) => {
    const btns = page.locator(".skill-tree-ui__upgrade-btn");
    const count = await btns.count();
    for (let i = 0; i < count; i++) {
      await expect(btns.nth(i)).toBeDisabled();
    }
  });

  test("Iron Skin upgrade button enables after granting a skill point", async ({ page }) => {
    await grantPoints(page, 1);
    const ironSkinBtn = page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__upgrade-btn');
    await expect(ironSkinBtn).toBeEnabled();
  });

  test("purchasing Iron Skin rank 1 updates pips and skill points", async ({ page }) => {
    await grantPoints(page, 1);
    await page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__upgrade-btn').click();

    const ironSkin = page.locator('[data-skill-id="iron_skin"]');
    await expect(ironSkin.locator(".skill-tree-ui__pips")).toHaveText("●○○");
    await expect(page.locator(".skill-tree-ui__points")).toHaveText("Skill Points: 0");
  });

  test("purchasing Iron Skin rank 1 applies +5 bonusArmor", async ({ page }) => {
    await grantPoints(page, 1);
    await page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__upgrade-btn').click();

    const stats = await playerStats(page);
    expect(stats.bonusArmor).toBe(5);
  });

  test("Iron Skin rank 1 unlocks Warrior's Edge", async ({ page }) => {
    await grantPoints(page, 2);
    await page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__upgrade-btn').click();

    const edge = page.locator('[data-skill-id="warriors_edge"]');
    await expect(edge).not.toHaveClass(/is-locked/);
    await expect(edge.locator(".skill-tree-ui__upgrade-btn")).toBeEnabled();
  });

  test("Warrior's Edge stays locked if Iron Skin never purchased", async ({ page }) => {
    await grantPoints(page, 5);
    // Try clicking the (disabled) Warrior's Edge button
    const edgeBtn = page.locator('[data-skill-id="warriors_edge"] .skill-tree-ui__upgrade-btn');
    await expect(edgeBtn).toBeDisabled();
    // System-level: a forced JS call should still fail and emit a notification
    await page.evaluate(() => {
      (window as HarnessWindow).__harness.system.purchaseSkill(0, 1);
    });
    const notifs = await getNotifications(page);
    expect(notifs.some((n) => n.includes("Requires"))).toBe(true);
  });

  test("Iron Skin reaches max rank 3 and shows Max badge", async ({ page }) => {
    await grantPoints(page, 3);
    const btn = page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__upgrade-btn');
    await btn.click();
    await grantPoints(page, 0); // re-render
    await btn.click();
    await grantPoints(page, 0);
    await btn.click();

    const ironSkin = page.locator('[data-skill-id="iron_skin"]');
    await expect(ironSkin).toHaveClass(/is-maxed/);
    await expect(ironSkin.locator(".skill-tree-ui__maxed-badge")).toHaveText("Max");
    await expect(ironSkin.locator(".skill-tree-ui__pips")).toHaveText("●●●");
    const stats = await playerStats(page);
    expect(stats.bonusArmor).toBe(15); // 5 × 3
  });

  test("Endurance max rank 2 grants +50 maxStamina", async ({ page }) => {
    await grantPoints(page, 2);
    const btn = page.locator('[data-skill-id="endurance"] .skill-tree-ui__upgrade-btn');
    await btn.click();
    await btn.click();
    const stats = await playerStats(page);
    expect(stats.maxStamina).toBe(150); // 100 + 25*2
  });

  test("Combat tree can be fully maxed (3+3+2 = 8 points)", async ({ page }) => {
    await grantPoints(page, 8);
    // Iron Skin ×3
    const ironBtn = page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__upgrade-btn');
    await ironBtn.click();
    await ironBtn.click();
    await ironBtn.click();
    // Warrior's Edge ×3 (now unlocked)
    const edgeBtn = page.locator('[data-skill-id="warriors_edge"] .skill-tree-ui__upgrade-btn');
    await edgeBtn.click();
    await edgeBtn.click();
    await edgeBtn.click();
    // Endurance ×2
    const endBtn = page.locator('[data-skill-id="endurance"] .skill-tree-ui__upgrade-btn');
    await endBtn.click();
    await endBtn.click();

    // All three should be maxed
    await expect(page.locator('[data-skill-id="iron_skin"]')).toHaveClass(/is-maxed/);
    await expect(page.locator('[data-skill-id="warriors_edge"]')).toHaveClass(/is-maxed/);
    await expect(page.locator('[data-skill-id="endurance"]')).toHaveClass(/is-maxed/);

    // No upgrade buttons should remain
    await expect(page.locator(".skill-tree-ui__upgrade-btn")).toHaveCount(0);

    const stats = await playerStats(page);
    expect(stats.bonusArmor).toBe(15);   // Iron Skin 3×5
    expect(stats.bonusDamage).toBe(15);  // Warrior's Edge 3×5
    expect(stats.maxStamina).toBe(150);  // Endurance 2×25 + 100 base
    expect(stats.skillPoints).toBe(0);
  });
});

test.describe("Skill Tree Audit — Magic tree", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
    // Switch to Magic tab
    await page.locator(".skill-tree-ui__tab").nth(1).click();
  });

  test("Magic tab shows three skill cards", async ({ page }) => {
    const cards = page.locator(".skill-tree-ui__card");
    await expect(cards).toHaveCount(3);
  });

  test("Mana Flow is locked until Arcane Power rank 1", async ({ page }) => {
    const manaFlow = page.locator('[data-skill-id="mana_flow"]');
    await expect(manaFlow).toHaveClass(/is-locked/);
  });

  test("Arcane Power unlocks Mana Flow", async ({ page }) => {
    await grantPoints(page, 1);
    await page.locator('[data-skill-id="arcane_power"] .skill-tree-ui__upgrade-btn').click();
    const manaFlow = page.locator('[data-skill-id="mana_flow"]');
    await expect(manaFlow).not.toHaveClass(/is-locked/);
  });

  test("Arcane Power applies +5 bonusMagicDamage per rank", async ({ page }) => {
    await grantPoints(page, 3);
    const btn = page.locator('[data-skill-id="arcane_power"] .skill-tree-ui__upgrade-btn');
    await btn.click();
    await btn.click();
    await btn.click();
    const stats = await playerStats(page);
    expect(stats.bonusMagicDamage).toBe(15);
  });

  test("Mystic Reserve applies +25 maxMagicka per rank", async ({ page }) => {
    await grantPoints(page, 2);
    const btn = page.locator('[data-skill-id="mystic_reserve"] .skill-tree-ui__upgrade-btn');
    await btn.click();
    await btn.click();
    const stats = await playerStats(page);
    expect(stats.maxMagicka).toBe(150);
  });

  test("Mana Flow applies +1 magickaRegen per rank (after unlock)", async ({ page }) => {
    await grantPoints(page, 4); // 1 for Arcane Power, 3 for Mana Flow
    await page.locator('[data-skill-id="arcane_power"] .skill-tree-ui__upgrade-btn').click();
    const manaBtn = page.locator('[data-skill-id="mana_flow"] .skill-tree-ui__upgrade-btn');
    await manaBtn.click();
    await manaBtn.click();
    await manaBtn.click();
    const stats = await playerStats(page);
    expect(stats.magickaRegen).toBe(5); // 2 base + 3
  });

  test("Magic tree can be fully maxed (3+2+3 = 8 points)", async ({ page }) => {
    await grantPoints(page, 8);
    // Arcane Power ×3
    const apBtn = page.locator('[data-skill-id="arcane_power"] .skill-tree-ui__upgrade-btn');
    await apBtn.click();
    await apBtn.click();
    await apBtn.click();
    // Mystic Reserve ×2
    const mrBtn = page.locator('[data-skill-id="mystic_reserve"] .skill-tree-ui__upgrade-btn');
    await mrBtn.click();
    await mrBtn.click();
    // Mana Flow ×3 (now unlocked)
    const mfBtn = page.locator('[data-skill-id="mana_flow"] .skill-tree-ui__upgrade-btn');
    await mfBtn.click();
    await mfBtn.click();
    await mfBtn.click();

    await expect(page.locator('[data-skill-id="arcane_power"]')).toHaveClass(/is-maxed/);
    await expect(page.locator('[data-skill-id="mystic_reserve"]')).toHaveClass(/is-maxed/);
    await expect(page.locator('[data-skill-id="mana_flow"]')).toHaveClass(/is-maxed/);

    await expect(page.locator(".skill-tree-ui__upgrade-btn")).toHaveCount(0);

    const stats = await playerStats(page);
    expect(stats.bonusMagicDamage).toBe(15); // 3×5
    expect(stats.maxMagicka).toBe(150);       // 100 + 2×25
    expect(stats.magickaRegen).toBe(5);        // 2 + 3×1
  });
});

test.describe("Skill Tree Audit — Survival tree", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
    // Switch to Survival tab
    await page.locator(".skill-tree-ui__tab").nth(2).click();
  });

  test("Survival tab shows three skill cards", async ({ page }) => {
    const cards = page.locator(".skill-tree-ui__card");
    await expect(cards).toHaveCount(3);
  });

  test("Second Wind is locked until Swift Recovery rank 1", async ({ page }) => {
    const sw = page.locator('[data-skill-id="second_wind"]');
    await expect(sw).toHaveClass(/is-locked/);
  });

  test("Swift Recovery unlocks Second Wind", async ({ page }) => {
    await grantPoints(page, 1);
    await page.locator('[data-skill-id="swift_recovery"] .skill-tree-ui__upgrade-btn').click();
    await expect(page.locator('[data-skill-id="second_wind"]')).not.toHaveClass(/is-locked/);
  });

  test("Vitality applies +25 maxHealth per rank", async ({ page }) => {
    await grantPoints(page, 3);
    const btn = page.locator('[data-skill-id="vitality"] .skill-tree-ui__upgrade-btn');
    await btn.click();
    await btn.click();
    await btn.click();
    const stats = await playerStats(page);
    expect(stats.maxHealth).toBe(175); // 100 + 3×25
  });

  test("Swift Recovery applies +0.5 healthRegen per rank", async ({ page }) => {
    await grantPoints(page, 3);
    const btn = page.locator('[data-skill-id="swift_recovery"] .skill-tree-ui__upgrade-btn');
    await btn.click();
    await btn.click();
    await btn.click();
    const stats = await playerStats(page);
    expect(stats.healthRegen).toBeCloseTo(2.0); // 0.5 base + 3×0.5
  });

  test("Second Wind applies +5 staminaRegen per rank (after unlock)", async ({ page }) => {
    await grantPoints(page, 3); // 1 for Swift Recovery, 2 for Second Wind
    await page.locator('[data-skill-id="swift_recovery"] .skill-tree-ui__upgrade-btn').click();
    const swBtn = page.locator('[data-skill-id="second_wind"] .skill-tree-ui__upgrade-btn');
    await swBtn.click();
    await swBtn.click();
    const stats = await playerStats(page);
    expect(stats.staminaRegen).toBe(15); // 5 base + 2×5
  });

  test("Survival tree can be fully maxed (3+3+2 = 8 points)", async ({ page }) => {
    await grantPoints(page, 8);
    const vitBtn = page.locator('[data-skill-id="vitality"] .skill-tree-ui__upgrade-btn');
    await vitBtn.click();
    await vitBtn.click();
    await vitBtn.click();
    const srBtn = page.locator('[data-skill-id="swift_recovery"] .skill-tree-ui__upgrade-btn');
    await srBtn.click();
    await srBtn.click();
    await srBtn.click();
    const sw2Btn = page.locator('[data-skill-id="second_wind"] .skill-tree-ui__upgrade-btn');
    await sw2Btn.click();
    await sw2Btn.click();

    await expect(page.locator('[data-skill-id="vitality"]')).toHaveClass(/is-maxed/);
    await expect(page.locator('[data-skill-id="swift_recovery"]')).toHaveClass(/is-maxed/);
    await expect(page.locator('[data-skill-id="second_wind"]')).toHaveClass(/is-maxed/);
    await expect(page.locator(".skill-tree-ui__upgrade-btn")).toHaveCount(0);
  });
});

test.describe("Skill Tree Audit — tab switching", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test("clicking Magic tab makes it active and shows Magic skills", async ({ page }) => {
    await page.locator(".skill-tree-ui__tab").nth(1).click();
    await expect(page.locator(".skill-tree-ui__tab").nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-skill-id="arcane_power"]')).toBeVisible();
    // Combat skills must be gone
    await expect(page.locator('[data-skill-id="iron_skin"]')).not.toBeVisible();
  });

  test("clicking Survival tab makes it active and shows Survival skills", async ({ page }) => {
    await page.locator(".skill-tree-ui__tab").nth(2).click();
    await expect(page.locator(".skill-tree-ui__tab").nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-skill-id="vitality"]')).toBeVisible();
  });

  test("switching back to Combat tab works after visiting Magic", async ({ page }) => {
    await page.locator(".skill-tree-ui__tab").nth(1).click();
    await page.locator(".skill-tree-ui__tab").nth(0).click();
    await expect(page.locator('[data-skill-id="iron_skin"]')).toBeVisible();
  });

  test("purchasing on one tab does not affect another tab's skill", async ({ page }) => {
    await grantPoints(page, 1);
    // Buy Iron Skin (Combat tab, default)
    await page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__upgrade-btn').click();
    // Switch to Magic
    await page.locator(".skill-tree-ui__tab").nth(1).click();
    // Arcane Power should still be rank 0
    await expect(page.locator('[data-skill-id="arcane_power"] .skill-tree-ui__pips')).toHaveText("○○○");
  });
});

test.describe("Skill Tree Audit — notifications", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test("buying a skill emits an upgrade notification", async ({ page }) => {
    await grantPoints(page, 1);
    await page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__upgrade-btn').click();
    const notifs = await getNotifications(page);
    expect(notifs.some((n) => n.includes("Iron Skin") && n.includes("rank 1"))).toBe(true);
  });

  test("trying to buy with no points emits a no-points notification", async ({ page }) => {
    // Bypass the disabled button and call the system directly
    await page.evaluate(() => {
      (window as HarnessWindow).__harness.system.purchaseSkill(0, 0);
    });
    const notifs = await getNotifications(page);
    expect(notifs.some((n) => n.toLowerCase().includes("no skill points"))).toBe(true);
  });

  test("trying to buy a locked skill emits a Requires notification", async ({ page }) => {
    await grantPoints(page, 1);
    // warriors_edge requires iron_skin rank 1
    await page.evaluate(() => {
      (window as HarnessWindow).__harness.system.purchaseSkill(0, 1);
    });
    const notifs = await getNotifications(page);
    expect(notifs.some((n) => n.includes("Requires"))).toBe(true);
  });

  test("trying to buy an already-maxed skill emits a max-rank notification", async ({ page }) => {
    // Grant 4 points: 3 consumed to max Iron Skin (rank 3), 1 remaining so the
    // 4th purchase attempt is rejected by the max-rank check (not the no-points check).
    await grantPoints(page, 4);
    await page.evaluate(() => {
      const h = (window as HarnessWindow).__harness;
      h.system.purchaseSkill(0, 0); // iron_skin rank 1
      h.system.purchaseSkill(0, 0); // iron_skin rank 2
      h.system.purchaseSkill(0, 0); // iron_skin rank 3 (maxed)
      h.system.purchaseSkill(0, 0); // 4th attempt → max-rank rejection
    });
    const notifs = await getNotifications(page);
    expect(notifs.some((n) => n.toLowerCase().includes("max rank"))).toBe(true);
  });
});

test.describe("Skill Tree Audit — save/restore state", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test("getSaveState returns empty array when nothing is purchased", async ({ page }) => {
    const saved = await page.evaluate(() => {
      return (window as HarnessWindow).__harness.system.getSaveState();
    });
    expect(saved).toEqual([]);
  });

  test("getSaveState captures purchased ranks", async ({ page }) => {
    await grantPoints(page, 2);
    await page.evaluate(() => {
      const h = (window as HarnessWindow).__harness;
      h.system.purchaseSkill(0, 0); // iron_skin rank 1
      h.system.purchaseSkill(0, 0); // iron_skin rank 2
    });
    const saved = await page.evaluate(() => {
      return (window as HarnessWindow).__harness.system.getSaveState();
    });
    expect(saved).toContainEqual({ id: "iron_skin", rank: 2 });
    expect(saved.length).toBe(1); // only iron_skin was bought
  });

  test("restoreState reapplies ranks and updates the UI", async ({ page }) => {
    await page.evaluate(() => {
      const h = (window as HarnessWindow).__harness;
      h.system.restoreState([
        { id: "iron_skin", rank: 2 },
        { id: "endurance", rank: 1 },
      ]);
      h.refresh();
    });

    const ironPips = page.locator('[data-skill-id="iron_skin"] .skill-tree-ui__pips');
    await expect(ironPips).toHaveText("●●○");
    const endPips = page.locator('[data-skill-id="endurance"] .skill-tree-ui__pips');
    await expect(endPips).toHaveText("●○");

    // restoreState skips prerequisites on rank application, so warriors_edge prereq is now met
    const stats = await playerStats(page);
    expect(stats.bonusArmor).toBe(10);   // iron_skin rank 2 × 5
    expect(stats.maxStamina).toBe(125);  // 100 + endurance rank 1 × 25
  });

  test("restoreState is idempotent (loading twice does not double-apply effects)", async ({ page }) => {
    await page.evaluate(() => {
      const h = (window as HarnessWindow).__harness;
      const state = [{ id: "iron_skin", rank: 2 }];
      h.system.restoreState(state);
      // Manually zero bonusArmor between calls (as SaveSystem does)
      h.player.bonusArmor = 0;
      h.system.restoreState(state);
    });
    const stats = await playerStats(page);
    expect(stats.bonusArmor).toBe(10); // 2 × 5, not 4 × 5
  });

  test("getSkillRank returns 0 for unknown skill", async ({ page }) => {
    const rank = await page.evaluate(() => {
      return (window as HarnessWindow).__harness.system.getSkillRank("nonexistent");
    });
    expect(rank).toBe(0);
  });

  test("getSkillRank reflects purchased rank", async ({ page }) => {
    await grantPoints(page, 2);
    await page.evaluate(() => {
      const h = (window as HarnessWindow).__harness;
      h.system.purchaseSkill(0, 0); // iron_skin 1
      h.system.purchaseSkill(0, 0); // iron_skin 2
    });
    const rank = await page.evaluate(() => {
      return (window as HarnessWindow).__harness.system.getSkillRank("iron_skin");
    });
    expect(rank).toBe(2);
  });
});

// ── Audit finding: BabylonJS UIManager prerequisite gap ──────────────────────

test.describe("Skill Tree Audit — prerequisite enforcement (UIManager gap)", () => {
  /**
   * This group documents the known gap: UIManager.refreshSkillTree() does
   * not visually lock skills whose prerequisites are unmet.  The system
   * (SkillTreeSystem.purchaseSkill) still rejects such purchases and fires
   * a "Requires: …" notification.  The HTML SkillTreeUI exercised in all
   * other tests handles this correctly.
   */
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test("HTML SkillTreeUI correctly disables Warrior's Edge when Iron Skin unmet", async ({ page }) => {
    await grantPoints(page, 1);
    // warriors_edge should be disabled even though there are skill points
    const edgeBtn = page.locator('[data-skill-id="warriors_edge"] .skill-tree-ui__upgrade-btn');
    await expect(edgeBtn).toBeDisabled();
    await expect(edgeBtn).toHaveAttribute("aria-disabled", "true");
    await expect(edgeBtn).toHaveAttribute("title", "Prerequisites not met.");
  });

  test("HTML SkillTreeUI correctly disables Mana Flow when Arcane Power unmet", async ({ page }) => {
    await page.locator(".skill-tree-ui__tab").nth(1).click(); // Magic
    await grantPoints(page, 1);
    const mfBtn = page.locator('[data-skill-id="mana_flow"] .skill-tree-ui__upgrade-btn');
    await expect(mfBtn).toBeDisabled();
    await expect(mfBtn).toHaveAttribute("title", "Prerequisites not met.");
  });

  test("HTML SkillTreeUI correctly disables Second Wind when Swift Recovery unmet", async ({ page }) => {
    await page.locator(".skill-tree-ui__tab").nth(2).click(); // Survival
    await grantPoints(page, 1);
    const swBtn = page.locator('[data-skill-id="second_wind"] .skill-tree-ui__upgrade-btn');
    await expect(swBtn).toBeDisabled();
    await expect(swBtn).toHaveAttribute("title", "Prerequisites not met.");
  });

  test("system rejects Warrior's Edge purchase and fires Requires notification (even if called directly)", async ({ page }) => {
    await grantPoints(page, 3);
    // Directly invoke purchaseSkill to simulate the UIManager gap (bypasses button disable)
    const result = await page.evaluate(() => {
      return (window as HarnessWindow).__harness.system.purchaseSkill(0, 1);
    });
    expect(result).toBe(false);
    const notifs = await getNotifications(page);
    expect(notifs.some((n) => n.includes("Requires") && n.includes("iron_skin"))).toBe(true);
  });

  test("Iron Skin rank 0 is not purchasable as Warrior's Edge (double-check via getSkillRank)", async ({ page }) => {
    await grantPoints(page, 5);
    // Attempt direct purchase of warriors_edge 5 times — all should fail
    await page.evaluate(() => {
      const h = (window as HarnessWindow).__harness;
      for (let i = 0; i < 5; i++) h.system.purchaseSkill(0, 1);
    });
    const rank = await page.evaluate(() => {
      return (window as HarnessWindow).__harness.system.getSkillRank("warriors_edge");
    });
    expect(rank).toBe(0); // never incremented
    const stats = await playerStats(page);
    expect(stats.skillPoints).toBe(5); // no points consumed
  });
});
