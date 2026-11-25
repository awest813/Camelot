/**
 * Who holds the input: panels and menus versus play, the modal registry, and whether combat input is blocked.
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { actors } from "../entities/actors";
import { Dead, Engaged } from "../core/ecs/actors";
import { ProgressionKey } from "../features/progression/progression-feature";
import { PickpocketKey } from "../features/pickpocket/pickpocket-feature";

/** Every panel that takes over the screen, in Escape order. */
export function registerModals(g: Game): void {
  const restore = () => restoreGameplayInput(g);
  g._modals.add(
    { id: "character-sheet", isOpen: () => g.characterSheetUI.isVisible,
      close: () => g.kernel.services.get(ProgressionKey).closeSheet() },
    { id: "inventory", isOpen: () => g.inventorySystem.isOpen, close: () => { g.inventorySystem.toggleInventory(); restore(); } },
    { id: "quest-log", isOpen: () => g.questSystem.isLogOpen, close: () => { g.questSystem.toggleQuestLog(); restore(); } },
    { id: "skill-tree", isOpen: () => g.skillTreeSystem.isOpen, close: () => { g.skillTreeSystem.toggle(); restore(); } },
    { id: "attributes", isOpen: () => g.ui.isAttributePanelOpen, close: () => { g.ui.toggleAttributePanel(false); restore(); } },
    { id: "alchemy", isOpen: () => g.alchemyUI.isVisible, close: () => g.crafting.toggleAlchemy() },
    { id: "enchanting", isOpen: () => g.enchantingUI.isVisible, close: () => g.crafting.toggleEnchanting() },
    { id: "forge", isOpen: () => g.craftingUI.isVisible, close: () => g.crafting.toggleSmithing() },
    { id: "jobs", isOpen: () => g.jobs.window.isVisible, close: () => { g.jobs.window.hide(); g.jobs.window.onClose?.(); } },
    { id: "spell-making", isOpen: () => g.spellMakingUI.isVisible, close: () => g.spellMakingUI.close() },
    { id: "barter", isOpen: () => g._barterUI.isVisible, close: () => g._trade.barterPanel.onClose?.() },
    { id: "container", isOpen: () => g._containerUI.isVisible, close: () => g._trade.containerPanel.onClose?.() },
    { id: "fast-travel", isOpen: () => g.fastTravelUI.isVisible, close: () => g.fastTravelUI.close() },
    { id: "pets", isOpen: () => g.petUI.isVisible, close: () => g.pets.togglePanel() },
    { id: "followers", isOpen: () => g.followerUI.isVisible, close: () => g.followers.togglePanel() },
    { id: "shouts", isOpen: () => g.shoutUI.isVisible, close: () => g.shouts.togglePanel() },
    { id: "pickpocket", isOpen: () => g.pickpocketUI.isVisible, close: () => g.kernel.services.get(PickpocketKey).close() },
    { id: "stable", isOpen: () => g.stableUI.isVisible, close: () => g.stableUI.close() },
    { id: "saddlebag", isOpen: () => g.saddlebagUI.isVisible, close: () => g.saddlebagUI.close() },
    { id: "credits", isOpen: () => !!g._creditsUI?.isVisible, close: () => { g._creditsUI!.hide(); g._creditsUI!.onClose?.(); } },
    { id: "graphics", isOpen: () => g.graphicsSettingsUI.isVisible, close: () => { g.graphicsSettingsUI.hide(); g.graphicsSettingsUI.onClose?.(); } },
    ...(g.editors?.windows() ?? []),
    { id: "wait", isOpen: () => g.ui.isWaitDialogOpen, close: () => { g.ui.toggleWaitDialog(false); restore(); } },
  );
}

/**
 * A panel's key: close it if it is open, else open it over play (never on
 * top of another menu) and take input.
 */
export function togglePanel(g: Game, id: string, open: () => void): void {
  if (g._modals.isOpen(id)) { g._modals.close(id); return; }
  if (isCombatInputBlocked(g)) return;
  open();
  suspendGameplayInput(g);
}

export function isCombatInputBlocked(g: Game): boolean {
  return (
      g.isPaused ||
      g.mapEditorActive ||
      g.levelUpUI.isVisible ||
      g.guardEncounterUI.isVisible ||
      g.dialogueSystem.isInDialogue ||
      g._modals.anyOpen() ||
      g.interactionSystem.isBlocked
  );
}

/** A menu takes input from play (see PlayFocus). */
export function suspendGameplayInput(g: Game): void {
  g._focus.take("menu");
}

/** The menu let go; play has input again unless the pause menu, editor, … still hold it. */
export function restoreGameplayInput(g: Game): void {
  g._focus.give("menu");
}

export function isPlayerInCombat(_g: Game): boolean {
  // Anyone alive in a fighting state (the Engaged tag).
  return actors.bodies([Engaged], [Dead]).length > 0;
}

export function togglePause(g: Game): void {
  g.isPaused = !g.isPaused;
  g.ui.togglePauseMenu(g.isPaused);

  if (g.isPaused) {
      g._gameplayLoop.reset();
      g.editors?.exitMapEditor({ quiet: true });
      g._modals.closeAll();
      g.ui.setInteractionText("");
      g._focus.take("pause");
  } else {
      g._focus.give("pause");
  }
}
