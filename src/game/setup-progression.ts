/**
 * Start-up, progression and the start: mark and recall, trainers, perks, leveled lists, stealth into combat, the effect and quick-slot HUDs, UI animation, level-up, hit-stop, the starting area and its merchants.
 *
 * Part of the composition root: a stretch of the game's start-up, moved out
 * of game.ts.
 */
import type { Game } from "../game";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { AIState } from "../entities/npc";
import { registerStarterMerchants } from "../content/starter-merchants";
import { seedStartingArea } from "../content/starting-area";
import { SCHED_GUARD } from "../systems/npc-schedule-system";
import { CharacterKey } from "../features/character/character-feature";
import { LeveledListSystem, ALL_BUILT_IN_LEVELED_LISTS } from "../systems/leveled-list-system";
import { UIAnimator } from "../ui/ui-animator";
import { MarkRecallSystem } from "../systems/mark-recall-system";
import { TrainerSystem } from "../systems/trainer-system";
import { ActiveEffectHUD } from "../ui/active-effect-hud";
import { QuickSlotHUD } from "../ui/quickslot-hud";
import { PerkSystem } from "../systems/perk-system";

export function setupProgressionAndStart(g: Game): void {
  // ── v24: Mark & Recall ────────────────────────────────────────────────
  g.markRecallSystem = new MarkRecallSystem();
  g.markRecallSystem.events = g.eventBus;
  g.eventBus.on("mark:recalled", ({ position }) => g.player.camera.position.set(position.x, position.y, position.z));
  g.saveSystem.setMarkRecallSystem(g.markRecallSystem);

  // ── v24: Trainer System ───────────────────────────────────────────────
  g.trainerSystem = new TrainerSystem();
  g.trainerSystem.events = g.eventBus;
  g.eventBus.on("trainer:trained", ({ skillId, newLevel, goldSpent }) => {
    // Gold sufficiency is pre-validated by TrainerSystem.train() via canTrain();
    // g callback only fires on a successful, already-approved session.
    g.skillProgressionSystem.setSkillLevel(skillId, newLevel);
    g._pack.spendGold(goldSpent);
    g.ui.showNotification(`${skillId} raised to ${newLevel}!  (−${goldSpent}g)`, 3000);
    g.saveSystem.markDirty();
  });
  g.saveSystem.setTrainerSystem(g.trainerSystem);

  // ── v27: Perk System ──────────────────────────────────────────────────
  g.perkSystem = new PerkSystem(g.player, g.skillProgressionSystem);
  g.perkSystem.events = g.eventBus;
  g.saveSystem.setPerkSystem(g.perkSystem);

  g._lastDynamicWorldEventHour = Math.floor(g.timeSystem.elapsedGameHours);

  // ── Leveled lists (tiered boss loot) ─────────────────────────────────────
  g.leveledListSystem = new LeveledListSystem();
  g.leveledListSystem.registerAll(ALL_BUILT_IN_LEVELED_LISTS);

  // Wire sneak-attack detection into combat.
  g.combatSystem.setStealthSystem(g.stealthSystem);

  // Suspicion (partial detection) routes NPCs to investigate where the
  // player was seen/heard — full detection still triggers ALERT.
  g.stealthSystem.events = g.eventBus;
  g.eventBus.on("stealth:noticed", ({ npc, playerPos }) => {
    if (npc.isDead || npc.isAggressive) return;
    if (!npc.lastKnownPlayerPos) npc.lastKnownPlayerPos = playerPos.clone();
    else npc.lastKnownPlayerPos.copyFrom(playerPos);
    if (npc.aiState === AIState.IDLE || npc.aiState === AIState.PATROL) {
      npc.aiState = AIState.INVESTIGATE;
      npc.investigateTimer = 0;
      // Sync the visual channel (amber tint) without the combat transition,
      // which would flag the suspicious NPC as hostile.
      g.combatSystem.paintNpcInvestigating(npc);
    }
  });

  // ── Active Effects HUD ──────────────────────────────────────────────────
  g.activeEffectHUD = new ActiveEffectHUD();
  g.activeEffectHUD.show();

  // ── Quick Slot HUD ────────────────────────────────────────────────────
  g.quickSlotHUD = new QuickSlotHUD();
  // Quick-slot assign mode: clicking a HUD slot opens the inventory; the
  // next consumable clicked there is bound to that slot.
  g.quickSlotHUD.events = g.eventBus;
  g.eventBus.on("quickslot:assign", ({ key }) => {
    if (g.isPaused || g.mapEditorActive || g.dialogueSystem.isInDialogue) return;
    g._quickSlotAssignKey = key;
    g.ui.showNotification(`Pick a consumable in your inventory for slot ${key}.`, 3000);
    if (!g.inventorySystem.isOpen) {
      g.inventorySystem.toggleInventory();
    }
  });
  // Leaving the inventory cancels a pending quick-slot assignment.
  g.eventBus.on("ui:inventoryClosed", () => { g._quickSlotAssignKey = null; });
  g.quickSlotHUD.show();
  g.quickSlotHUD.update(g.quickSlotSystem);

  // ── UI animations (Motion library) ─────────────────────────────────────────
  const uiAnimator = new UIAnimator();
  g.levelUpUI.setAnimator(uiAnimator);
  g.spellMakingUI.setAnimator(uiAnimator);
  g.guardEncounterUI.setAnimator(uiAnimator);
  g.saddlebagUI.setAnimator(uiAnimator);

  void g.kernel.services.get(CharacterKey).create();

  g.eventBus.on("ui:attributeSpend", ({ name }) => {
    const spent = g.attributeSystem.spendPoint(name);
    if (spent) {
      g.saveSystem.markDirty();
      // Sync derived stats back to player after spending
      g.player.maxHealth      = g.attributeSystem.maxHealth;
      g.player.maxMagicka     = g.attributeSystem.maxMagicka;
      g.player.maxStamina     = g.attributeSystem.maxStamina;
      g.player.maxCarryWeight = g.attributeSystem.carryWeight;
      g.spellSystem.magicDamageBonus = g.attributeSystem.magicDamageBonus;
      // Refresh the attribute panel display
      g.ui.refreshAttributePanel(g.attributeSystem);
    }
  });

  // Hit-stop effect wired to FixedStepLoop
  g.eventBus.on("ui:hitStop", ({ durationMs }) => {
    g._gameplayLoop.timeScale = 0.05; // heavy slow-mo
    setTimeout(() => {
      g._gameplayLoop.timeScale = 1.0;
    }, durationMs);
  });

  // Level-up awards attribute points
  g.player.events = g.eventBus;
  g.eventBus.on("player:combatLevelUp", () => {
    // Combat XP level-up — no notification (spam). Character level-up
    // fires via onLevelUpComplete and shows the meaningful notification.
    g.attributeSystem.awardLevelUpPoints(1);
    g.saveSystem.markDirty();
    // Sync magic damage bonus after level-up attribute award
    g.spellSystem.magicDamageBonus = g.attributeSystem.magicDamageBonus;
  });

  // Guard crime challenge is wired in the v9 block above.

  // Stealth detection notification

  // The starting area: the guard, a forge, a chest, the Old Cave, weapons on the ground.
  seedStartingArea({
    scene: g.scene,
    addNpc: (npc) => g._roster.add(npc),
    guardSchedule: (npc) => { g.npcScheduleSystem.applySchedule(npc, SCHED_GUARD); },
    placeSmithy: (x, z) => g._chunks.placeSmithy(null, null, x, z),
    assets: g.fantasyAssets,
    containers: g.containerSystem,
    cells: g.cellManager,
    castShadow: (root) => g.shadowGenerator?.addShadowCaster(root, true),
  });

  // The starting region's merchants (dialogue `barter:open` uses payload.merchantId).
  registerStarterMerchants(g.barterSystem, g.merchantRestockSystem, g.shopSystem, g.timeSystem.elapsedGameTime);

  g.interactionSystem.containerSystem = g.containerSystem;
}
