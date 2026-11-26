/**
 * Start-up, the core systems: attributes, time, schedules, combat, dialogue, inventory, equipment, saves, quests, interaction, the data framework, the editors, stealth, crime, containers, projectiles, barter and pickpocketing.
 *
 * Part of the composition root: a stretch of the game's start-up, moved out
 * of game.ts.
 */
import type { Game } from "../game";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { CombatSystem } from "../systems/combat-system";
import { DialogueSystem } from "../systems/dialogue-system";
import { InventorySystem } from "../systems/inventory-system";
import { EquipmentSystem } from "../systems/equipment-system";
import { SaveSystem } from "../systems/save-system";
import { desktopMirroredSaveStore } from "../platform/save-store";
import { QuestSystem } from "../systems/quest-system";
import { InteractionSystem } from "../systems/interaction-system";
import { SkillTreeSystem } from "../systems/skill-tree-system";
import { AudioSystem } from "../systems/audio-system";
import { FrameworkRuntime } from "../framework/runtime/framework-runtime";
import { frameworkBaseContent } from "../framework/content/base-content";
import { AttributeSystem } from "../systems/attribute-system";
import { TimeSystem } from "../systems/time-system";
import { StealthSystem } from "../systems/stealth-system";
import { CrimeSystem } from "../systems/crime-system";
import { ContainerSystem } from "../systems/container-system";
import { ProjectileSystem } from "../systems/projectile-system";
import { BarterSystem } from "../systems/barter-system";
import { ShopSystem } from "../systems/shop-system";
import { STARTER_QUESTS } from "../content/starting-area";
import { CellManager } from "../world/cell-manager";
import { PickpocketKey } from "../features/pickpocket/pickpocket-feature";
import { createFrameworkDialogueSession, handleDialogueHostEvent, loadFrameworkMods } from "./framework-bridge";
import { refreshHelpOverlayIfVisible } from "./help-overlay";
import { syncWeaponArchetype } from "./game-loop";
import { restoreGameplayInput, suspendGameplayInput } from "./play-focus";

export function setupCoreSystems(g: Game): void {
  // ── v2 Oblivion-lite systems ──────────────────────────────────────────────
  g.attributeSystem = new AttributeSystem();
  g.timeSystem      = new TimeSystem(120, 8);  // 2-min real day, start at 08:00
  g.cellManager     = new CellManager(g.scene, g.player);

  // Sync initial derived stats from attributes
  g.player.maxHealth      = g.attributeSystem.maxHealth;
  g.player.maxMagicka     = g.attributeSystem.maxMagicka;
  g.player.maxStamina     = g.attributeSystem.maxStamina;
  g.player.maxCarryWeight = g.attributeSystem.carryWeight;
  g.player.health         = g.player.maxHealth;
  g.player.magicka        = g.player.maxMagicka;
  g.player.stamina        = g.player.maxStamina;

  // Notify player of location changes (full wiring in the v8 block once
  // fastTravelSystem is ready). Exterior CDN props stay in LodSystem across
  // interior transitions; disposed meshes are pruned in lodSystem.update().

  // Wire up structure NPC spawning so guards are tracked by schedule & combat.
  // (Full wiring including level scaling is done in the v8 block below.)

  g.combatSystem       = new CombatSystem(g.scene, g.player, g.scheduleSystem.npcs, g.ui, g.navigationSystem);
  g.dialogueSystem     = new DialogueSystem(g.scene, g.player, g.scheduleSystem.npcs, g.canvas);
  g.inventorySystem    = new InventorySystem(g.player, g.ui, g.canvas);
  g.inventorySystem.events = g.eventBus;
  g.equipmentSystem    = new EquipmentSystem(g.player, g.inventorySystem, g.ui);
  // Equipped weapon drives the combat weapon archetype (sword/bow/staff/...).
  g.equipmentSystem.events = g.eventBus;
  // Gear changed: the weapon archetype follows; equipped gear is saved state.
  // (Wear tracking listens in the crafting feature.)
  g.eventBus.on("equipment:changed", () => {
    syncWeaponArchetype(g);
    g.saveSystem.markDirty();
  });
  syncWeaponArchetype(g);
  g.saveSystem         = new SaveSystem(g.player, g.inventorySystem, g.equipmentSystem, g.ui);
  const mirroredSaves = desktopMirroredSaveStore();
  if (mirroredSaves) g.saveSystem.setStorage(mirroredSaves);
  g.saveSystem.setCombatSystem(g.combatSystem);
  g.questSystem        = new QuestSystem(g.ui);
  g.questSystem.events = g.eventBus;
  g.saveSystem.setQuestSystem(g.questSystem);
  g.saveSystem.events = g.eventBus;
  g.interactionSystem  = new InteractionSystem(g.scene, g.player, g.inventorySystem, g.dialogueSystem, g.ui);
  g.interactionSystem.cellManager = g.cellManager;
  g.dialogueSystem.focus = g._focus;
  // The camera stack runs the dialogue framing (and outranks it with the death fall).
  g.dialogueSystem.driveCamera = false;
  const framing = g.dialogueSystem.camera;
  g._camera.add({ id: "dialogue", get active() { return framing.phase !== "idle"; }, update: (dt) => framing.update(dt) });
  g._camera.add(g._deathCamera);
  g.inventorySystem.focus = g._focus;
  g.skillTreeSystem    = new SkillTreeSystem(g.player, g.ui);
  g.ui.events = g.eventBus;
  g.eventBus.on("ui:skillPurchase", ({ treeIndex, skillIndex }) => g.skillTreeSystem.purchaseSkill(treeIndex, skillIndex));
  g.saveSystem.setSkillTreeSystem(g.skillTreeSystem);
  g.audioSystem        = new AudioSystem();
  // The base content plus the starter quests (one quest engine for all).
  g.frameworkRuntime   = new FrameworkRuntime({ ...frameworkBaseContent, quests: [...frameworkBaseContent.quests, ...STARTER_QUESTS] }, {
    inventoryCapacity: g.inventorySystem.maxCapacity,
    fetchImpl: (url: string) => fetch(url),
    skillLevelProvider: (skillId: string) => g.skillTreeSystem.getSkillRank(skillId),
    // Dialogue chance rolls come from a seeded stream (the kernel is built later).
    random: () => g.kernel.rng.stream("dialogue").next(),
  });
  g.frameworkRuntime.questEngine.activateQuest("quest_guard_resolution");
  for (const q of STARTER_QUESTS) g.frameworkRuntime.questEngine.activateQuest(q.id);
  g.questSystem.setFramework(() => g.frameworkRuntime?.questEngine ?? null);
  g.saveSystem.setFrameworkRuntime(g.frameworkRuntime);
  g.dialogueSystem.dialogueSessionProvider = (targetNpc) => {
    g._currentDialogueNpcName = targetNpc.key;
    return createFrameworkDialogueSession(g, targetNpc.key);
  };
  loadFrameworkMods(g);
  // Editor tools (map editor, creators, bundles, asset browser, hub): only
  // in the editor app, which passes them in.
  g.editors = g._editorFactory?.(g, {
    suspendGameplay: () => suspendGameplayInput(g),
    restoreGameplay: () => restoreGameplayInput(g),
    editorMode: (on) => {
      // The editor holds input, and its own chords replace the play bindings.
      if (on) g._focus.take("editor"); else g._focus.give("editor");
      g._inputAdapter.setContext(on ? "editor" : "play");
    },
    modeChanged: () => refreshHelpOverlayIfVisible(g),
  }) ?? null;

  // ── v2 system wiring ──────────────────────────────────────────────────────
  g.stealthSystem   = new StealthSystem(g.player, g.scheduleSystem.npcs, g.ui, g.scene);
  g.crimeSystem     = new CrimeSystem(g.player, g.scheduleSystem.npcs, g.ui, g.scene);
  g.containerSystem = new ContainerSystem(g.scene, g.player, g.inventorySystem, g.ui);
  g.projectileSystem = new ProjectileSystem(g.scene, g.player, g.scheduleSystem.npcs, g.ui);
  g.projectileSystem.stealthSystem = g.stealthSystem;
  g.barterSystem    = new BarterSystem(g.inventorySystem, g.ui);
  g.shopSystem      = new ShopSystem();
  g.barterSystem.events = g.eventBus;
  g.eventBus.on("barter:transaction", () => g._pack.setGold(g.barterSystem.playerGold));
  g.frameworkRuntime.setDialogueHostHooks({
    onDialogueHostEvent: (eventId, payload) => handleDialogueHostEvent(g, eventId, payload),
    onDialogueConsumeItem: (itemId, quantity) => g._pack.consume(itemId, quantity),
    onDialogueGiveItem: (itemId, quantity) => g._pack.give(itemId, quantity),
    dialogueInventoryCount: (itemId) => g._pack.count(itemId),
  });

  // Register v2 systems with save
  g.saveSystem.setAttributeSystem(g.attributeSystem);
  g.saveSystem.setTimeSystem(g.timeSystem);
  g.saveSystem.setCrimeSystem(g.crimeSystem);
  g.saveSystem.setContainerSystem(g.containerSystem);
  g.saveSystem.setBarterSystem(g.barterSystem);
  g.saveSystem.setCellManager(g.cellManager);
  g.saveSystem.setStealthSystem(g.stealthSystem);

  // ── Pickpocket wiring (sneak-thief loop) ────────────────────────────────
  g.interactionSystem.stealthSystem = g.stealthSystem;
  g.interactionSystem.pickpocketSystem = g.pickpocketSystem;
  g.interactionSystem.sneakLevelProvider = () =>
    g.skillProgressionSystem.getSkill("sneak")?.level ?? 0;
  g.interactionSystem.events = g.eventBus;
  g.eventBus.on("interact:pickpocket", ({ npc }) => g.kernel.services.get(PickpocketKey).open(npc));
  // Seed the starting cast (structure/archetype spawns register on arrival).
  for (const npc of g.scheduleSystem.npcs) g._thief.registerNpc(npc);
}
