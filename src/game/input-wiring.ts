/**
 * Input: the input adapter's actions, the dialog toggle keys, the interact raycast, and the inventory's quick-slot assignment and save import.
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { type InputAction } from "../adapters/babylon/babylon-input-adapter";
import { isConsumableItem } from "../systems/quickslot-system";
import { TravelKey } from "../features/fast-travel/fast-travel-feature";
import { ProgressionKey } from "../features/progression/progression-feature";
import { SpellMakingKey } from "../features/spell-making/spell-making-feature";
import { ArrestKey } from "../features/arrest/arrest-feature";
import type { Item } from "../systems/inventory-system";
import { isCombatInputBlocked, restoreGameplayInput, togglePanel } from "./play-focus";
import { toggleHelpOverlay } from "./help-overlay";
import { MapKey } from "../features/map/map-feature";

/** Panel toggles that may be pressed again from inside their open DOM dialog. */
const DIALOG_TOGGLE_ACTIONS: ReadonlySet<InputAction> = new Set<InputAction>([
  "toggleInventory", "toggleQuestLog", "toggleSkillTree", "toggleAttributePanel",
  "toggleAlchemy", "toggleEnchanting", "toggleSmithing", "toggleSpellMaking", "toggleFastTravel",
  "toggleWaitDialog", "togglePetPanel", "toggleFollowerPanel", "toggleShoutMenu",
  "stableOrSaddlebag", "favoritesMenu", "toggleMap",
]);

export function wireInputAdapter(g: Game): void {
  const adapter = g._inputAdapter;

  // Combat
  g._combatControls.bind(adapter);

  // Movement
  adapter.onAction("toggleCrouch", () => {
      if (!g.isPaused && !g.dialogueSystem.isInDialogue) {
      const crouching = g.stealthSystem.toggleCrouch();
      g.ui.showNotification(crouching ? "Sneaking..." : "Standing", 1200);
      g._tips.did("sneak");
    }
  });

  // UI panels — every toggle closes its own menu first, and only opens when
  // no other modal owns the screen (prevents stacked menus).
  adapter.onAction("toggleInventory", () => togglePanel(g, "inventory", () => g.inventorySystem.toggleInventory()));
  adapter.onAction("toggleQuestLog", () => togglePanel(g, "quest-log", () => g.questSystem.toggleQuestLog()));
  adapter.onAction("toggleSkillTree", () => togglePanel(g, "skill-tree", () => g.skillTreeSystem.toggle()));
  adapter.onAction("toggleAttributePanel", () => togglePanel(g, "attributes", () => {
    g.ui.toggleAttributePanel(true);
    g.ui.refreshAttributePanel(g.attributeSystem);
  }));
  adapter.onAction("toggleAlchemy", () => g.crafting.toggleAlchemy());
  adapter.onAction("toggleEnchanting", () => g.crafting.toggleEnchanting());
  adapter.onAction("toggleSmithing", () => g.crafting.toggleSmithing());
  adapter.onAction("toggleSpellMaking", () => g.kernel.services.get(SpellMakingKey).toggle());
  adapter.onAction("toggleFastTravel", () => g.kernel.services.get(TravelKey).toggleMenu());
  adapter.onAction("markPosition", () => {
    if (isCombatInputBlocked(g)) return;
    const p = g.player.camera.position;
    g.markRecallSystem.mark({ x: p.x, y: p.y, z: p.z });
    g.saveSystem.markDirty();
  });
  adapter.onAction("togglePetPanel", () => g.pets.togglePanel());
  adapter.onAction("toggleFollowerPanel", () => {
    // In map-editor mode G cycles the gizmo (the adapter consumes the key
    // before the legacy editor branch can see it).
    if (g.editors?.mapEditorActive) {
      g.editors.cycleGizmo();
      return;
    }
    g.followers.togglePanel();
  });
  adapter.onAction("toggleShoutMenu", () => g.shouts.togglePanel());
  adapter.onAction("useShout", () => g.shouts.use());
  adapter.onAction("toggleWaitDialog", () => togglePanel(g, "wait", () => g.ui.toggleWaitDialog(true)));
  adapter.onAction("mountDismount", () => g.mounts.toggleMount());
  adapter.onAction("stableOrSaddlebag", () => g.mounts.toggleStableOrSaddlebag());
  adapter.onAction("showFameStatus", () => {
    if (!g.isPaused && !g.dialogueSystem.isInDialogue) {
      const effects = g.activeEffectsSystem.activeEffects;
      const effectStr = effects.length > 0 ? `  Active effects: ${effects.map(e => e.name).join(", ")}` : "";
      const customSpellCount = g.spellMakingSystem.customSpells.length;
      const spellStr = customSpellCount > 0 ? `  Custom spells: ${customSpellCount}` : "";
      g.ui.showNotification(
        `Fame: ${g.fameSystem.fame} (${g.fameSystem.fameLabel})` +
        `  Infamy: ${g.fameSystem.infamy} (${g.fameSystem.infamyLabel})` +
        `  Sentences: ${g.jailSystem.totalSentences}${effectStr}${spellStr}`,
        4000,
      );
    }
  });

  // Quick-slots (1-0 all bound)
  const allQKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
  for (const key of allQKeys) {
    const action = `quickSlot${key === "0" ? "0" : key}`;
    adapter.onAction(action as any, () => {
      if (!isCombatInputBlocked(g)) {
        g.quickSlotSystem.useSlot(key as any);
      }
    });
  }

  // Combat stances (Shift + 1–6): three melee, three magic.
  const stances = [["melee", "duelist"], ["melee", "soldier"], ["melee", "bruiser"], ["magic", "spark"], ["magic", "bolt"], ["magic", "surge"]] as const;
  stances.forEach(([kind, stance], i) => adapter.onAction(`archetype${i + 1}` as never, () => {
    if (g.isPaused || g.dialogueSystem.isInDialogue) return;
    if (kind === "melee") g.combatSystem.setMeleeArchetype(stance as never);
    else g.combatSystem.setMagicArchetype(stance as never);
  }));

  // System
  adapter.onAction("pause", () => {
    // Character creation owns the screen — Escape must not unpause beneath it.
    if (g._inCharacterCreation) return;
    if (g.dialogueSystem.isInDialogue) return;
    if (g.levelUpUI.isVisible) return;
    if (g.guardEncounterUI.isVisible) { g.kernel.services.get(ArrestKey).resist(); return; }
    if (g.editors?.mapEditorActive) { g.editors.exitMapEditor(); return; }
    // Otherwise close the top panel, or pause.
    if (g._modals.closeTop()) return;
    g.togglePause();
  });
  adapter.onAction("save", () => { if (!g.isPaused) g.saveSystem.save(); });
  adapter.onAction("load", () => { if (!g.isPaused) g.saveSystem.load(); });
  adapter.onAction("toggleMap", () => g.kernel.services.get(MapKey).toggle());
  adapter.onAction("toggleMute", () => {
    g.audioSystem.toggleMute();
    g.ui.showNotification(g.audioSystem.isMuted ? "Audio muted" : "Audio unmuted", 1500);
  });
  adapter.onAction("toggleDebugOverlay", () => {
    const shown = g.ui.toggleDebugOverlay();
    g.ui.showNotification(shown ? "Debug overlay ON" : "Debug overlay OFF", 1200);
  });
  adapter.onAction("screenshot", () => {
    g.screenshotSystem.download(g.canvas);
    g.ui.showNotification("Screenshot saved", 1500);
  });
  adapter.onAction("helpOverlay", () => {
    toggleHelpOverlay(g);
  });
  adapter.onAction("toggleMapEditor", () => g.editors?.toggleMapEditor());
  adapter.onAction("toggleCharacterSheet", () => g.kernel.services.get(ProgressionKey).toggleSheet());

  // ── action handlers ─────────────────────────────
  adapter.onAction("jump", () => {
    // Space also advances the onboarding tutorial when active
    if (g._tips.space()) return;

    if (!isCombatInputBlocked(g)) hop(g);
  });

  adapter.onAction("sprint", () => {
    if (isCombatInputBlocked(g)) return;
    g.stealthSystem.movementMode = "running";
    if (g.stealthSystem.isCrouching) {
      g.stealthSystem.isCrouching = false;
    }
  });
  adapter.onAction("sprintRelease", () => {
    g.stealthSystem.movementMode = "walking";
  });

  adapter.onAction("autoRun", () => {
    if (isCombatInputBlocked(g)) return;
    g.player.autoRun = !g.player.autoRun;
    g.ui.showNotification(g.player.autoRun ? "Auto-run on (CapsLock to stop)" : "Auto-run off", 1000);
  });

  adapter.onAction("interact", () => {
    if (g.dialogueSystem.isInDialogue) return;
    if (g.inventorySystem.isOpen) {
      g.inventorySystem.toggleInventory();
      // Closing with E must clear isBlocked exactly like the Escape path.
      restoreGameplayInput(g);
      return;
    }

    // A paused game or an open modal owns the screen: no world interaction
    // (and no E-jump fallback) may bleed through.
    if (isCombatInputBlocked(g)) return;

    // If nothing is within interact range, jump instead
    if (raycastInteract(g)) g.interactionSystem.interact();
    else hop(g);
  });

  adapter.onAction("favoritesMenu", () => {
    if (!g.isPaused && !g.dialogueSystem.isInDialogue) g.ui.showNotification(g.quickSlotSystem.describe(), 4000);
  });

  adapter.onAction("togglePOV", () => {
    if (g.mapEditorActive) return;
    if (!g.isPaused && !g.dialogueSystem.isInDialogue) {
      const curFov = g.player.camera.fov;
      g.player.camera.fov = curFov >= 1.8 ? 0.8 : 1.8;
      g.ui.showNotification(
        curFov >= 1.8 ? "First-person view" : "Third-person view",
        1200,
      );
    }
  });
}

/**
 * Route a panel-toggle key pressed while focus is inside an open dialog to the
 * input adapter (the canvas observable never sees it). Keys typed into text
 * fields, Escape/Tab (dialogs own those), and canvas-origin events — already
 * handled by the observable — are left alone.
 */
export function forwardDialogToggleKey(g: Game, ev: KeyboardEvent): void {
  if (ev.repeat || ev.defaultPrevented || g._inCharacterCreation) return;
  const target = ev.target;
  if (!(target instanceof HTMLElement) || target === g.canvas) return;
  if (!target.closest('[role="dialog"], [aria-modal="true"]')) return;
  if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
  const modifiers = { shift: ev.shiftKey, ctrlOrMeta: ev.ctrlKey || ev.metaKey };
  const action = g._inputAdapter.matchAction(ev.key, "down", modifiers);
  if (!action || !DIALOG_TOGGLE_ACTIONS.has(action)) return;
  ev.preventDefault();
  g._inputAdapter.handleKeyEvent(ev.key, "down", modifiers);
}

/** A jump: 10 stamina for a 3 m hop (only with gravity on, i.e. not flying in the editor). */
export function hop(g: Game): void {
  if (!g.player.camera.applyGravity || g.player.stamina < 10) return;
  g.player.stamina = Math.max(0, g.player.stamina - 10);
  g.player.notifyResourceSpent("stamina");
  g.player.camera.position.y += 3;
}

/** Check if the player is looking at an interactable object or NPC within 3 units. */
export function raycastInteract(g: Game): boolean {
  const hit = g.player.raycastForward(3, true);
  if (hit?.pickedMesh?.metadata) {
    const m = hit.pickedMesh.metadata;
    return m.type === "npc" || m.type === "loot" || m.type === "portal" || m.type === "container" || m.type === "activator";
  }
  return false;
}

/**
 * Assign-mode click: bind the clicked consumable to the pending quick-slot.
 * @returns true when the click was consumed by assign mode.
 */
export function tryAssignQuickSlotFromClick(g: Game, item: Item): boolean {
  const key = g._quickSlotAssignKey;
  if (!key) return false;
  if (!isConsumableItem(item)) {
      g.ui.showNotification(`${item.name} is not a consumable — pick a potion or food.`, 2400);
      return true;
  }
  g.quickSlotSystem.bindSlot(key, item.id);
  g._quickSlotAssignKey = null;
  g.quickSlotHUD.update(g.quickSlotSystem);
  g.ui.showNotification(`Slot ${key} bound to ${item.name}.`, 2200);
  g.saveSystem.markDirty();
  return true;
}

/**
 * Open a browser file picker and import the chosen save JSON
 * (pause menu → Import Save).  Must run inside the button's user gesture.
 */
export function openSaveImportPicker(g: Game): void {
  if (typeof document === "undefined") return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.display = "none";
  const cleanup = () => input.remove();
  input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void g.saveSystem.importFromFile(file);
      cleanup();
  });
  input.addEventListener("cancel", cleanup);
  document.body.appendChild(input);
  input.click();
}
