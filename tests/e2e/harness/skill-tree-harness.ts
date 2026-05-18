/**
 * Skill Tree Playwright Harness
 *
 * Boots the HTML-based SkillTreeUI + SkillTreeSystem in a browser context
 * that has NO BabylonJS dependency. A lightweight mock player and mock
 * UIManager are wired together, then the whole harness is exposed on
 * `window.__harness` so Playwright tests can drive and inspect state.
 *
 * Harness URL (Vite dev): /tests/e2e/harness/skill-tree-harness.html
 */

import { SkillTreeSystem } from "../../../src/systems/skill-tree-system";
import { SkillTreeUI } from "../../../src/ui/skill-tree-ui";
import type { SkillTree } from "../../../src/systems/skill-tree-system";

// ── Mock player ──────────────────────────────────────────────────────────────
const player = {
  health: 100,
  maxHealth: 100,
  magicka: 100,
  maxMagicka: 100,
  stamina: 100,
  maxStamina: 100,
  healthRegen: 0.5,
  magickaRegen: 2,
  staminaRegen: 5,
  bonusArmor: 0,
  bonusDamage: 0,
  bonusMagicDamage: 0,
  skillPoints: 0, // Start with 0; tests will grant points via harness.grantPoints()
} as unknown as import("../../../src/entities/player").Player;

// ── HTML Skill Tree UI ────────────────────────────────────────────────────────
const skillTreeUI = new SkillTreeUI();
skillTreeUI.show();

// ── Notification log (visible on-page + collected for assertions) ─────────────
const _notifications: string[] = [];
const notifContainer = document.getElementById("notifications")!;

function _pushNotification(msg: string) {
  _notifications.push(msg);
  const div = document.createElement("div");
  div.className = "notification";
  div.dataset.msg = msg;
  div.textContent = msg;
  notifContainer.appendChild(div);
}

// ── Mock UIManager — only the methods SkillTreeSystem calls ──────────────────
const mockUI = {
  showNotification(msg: string, _duration: number) {
    _pushNotification(msg);
  },
  toggleSkillTree(_visible: boolean) {
    // SkillTreeUI.show/hide is driven by the harness directly; ignore this.
  },
  refreshSkillTree(trees: SkillTree[], skillPoints: number) {
    skillTreeUI.update(
      trees,
      skillPoints,
      (ti, si) => system.arePrerequisitesMet(ti, si),
    );
  },
} as unknown as import("../../../src/ui/ui-manager").UIManager;

// ── System ────────────────────────────────────────────────────────────────────
const system = new SkillTreeSystem(player, mockUI);

// Wire purchase callback
skillTreeUI.onPurchase = (treeIdx, skillIdx) => {
  system.purchaseSkill(treeIdx, skillIdx);
};

// Initial render (0 skill points — all upgrades disabled)
skillTreeUI.update(
  system.trees,
  player.skillPoints,
  (ti, si) => system.arePrerequisitesMet(ti, si),
);

// ── Public harness API exposed on window ─────────────────────────────────────
interface HarnessApi {
  /** The mock player object. Mutate skillPoints then call refresh(). */
  player: typeof player;
  /** The live SkillTreeSystem instance. */
  system: SkillTreeSystem;
  /** The live SkillTreeUI instance. */
  ui: SkillTreeUI;
  /** Grant N skill points to the player and re-render. */
  grantPoints(n: number): void;
  /** Reset the whole system (all ranks to 0, points to 0) and re-render. */
  reset(): void;
  /** All notification strings accumulated since page load or last clearNotifications(). */
  getNotifications(): string[];
  /** Discard accumulated notifications. */
  clearNotifications(): void;
  /** Force a UI refresh (useful after direct state manipulation). */
  refresh(): void;
}

const harness: HarnessApi = {
  player,
  system,
  ui: skillTreeUI,

  grantPoints(n: number) {
    player.skillPoints += n;
    this.refresh();
  },

  reset() {
    system.restoreState([]);
    player.skillPoints = 0;
    player.bonusArmor = 0;
    player.bonusDamage = 0;
    player.maxStamina = 100;
    player.bonusMagicDamage = 0;
    player.maxMagicka = 100;
    player.maxHealth = 100;
    player.healthRegen = 0.5;
    player.magickaRegen = 2;
    player.staminaRegen = 5;
    _notifications.length = 0;
    notifContainer.innerHTML = "";
    this.refresh();
  },

  refresh() {
    skillTreeUI.update(
      system.trees,
      player.skillPoints,
      (ti, si) => system.arePrerequisitesMet(ti, si),
    );
  },

  getNotifications() {
    return [..._notifications];
  },

  clearNotifications() {
    _notifications.length = 0;
    notifContainer.innerHTML = "";
  },
};

(window as unknown as { __harness: HarnessApi }).__harness = harness;
