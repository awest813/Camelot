/**
 * Start-up, gameplay systems: spells, persuasion, loot tables, NPC archetypes and schedules, the LOD pass, crafting, weather, quick slots and waiting.
 *
 * Part of the composition root: a stretch of the game's start-up, moved out
 * of game.ts.
 */
import type { Game } from "../game";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { AchievementSystem } from "../platform/achievement-system";
import { getDesktopBridge } from "../platform/desktop-bridge";
import { frameworkBaseContent } from "../framework/content/base-content";
import { SpellSystem } from "../systems/spell-system";
import { PersuasionSystem } from "../systems/persuasion-system";
import { LootTableSystem, STARTER_LOOT_TABLES } from "../systems/loot-table-system";
import { NpcArchetypeSystem } from "../systems/npc-archetype-system";
import { NpcScheduleSystem } from "../systems/npc-schedule-system";
import { CraftingFeature } from "../features/crafting/crafting-feature";
import { LodSystem } from "../systems/lod-system";
import { WeatherSystem } from "../systems/weather-system";
import { QuickSlotSystem, isConsumableItem } from "../systems/quickslot-system";
import { WaitSystem } from "../systems/wait-system";
import { tryAssignQuickSlotFromClick } from "./input-wiring";
import { actors } from "../entities/actors"; import { Dead, Engaged } from "../core/ecs/actors";

export function setupGameplaySystems(g: Game): void {
  // ── v3 system wiring ──────────────────────────────────────────────────────
  g._achievements = new AchievementSystem();
  g.eventBus.on("achievement:unlocked", ({ definition }) => {
    g.ui.showNotification(`Achievement unlocked: ${definition.name}`, 4000);
    const bridge = getDesktopBridge();
    if (bridge) void bridge.unlockAchievement(definition.id);
  });
  g._achievements.bind(g.eventBus);
  void g._achievements.syncWithDesktop();
  g.lootTableSystem = new LootTableSystem();
  for (const t of STARTER_LOOT_TABLES) g.lootTableSystem.registerTable(t);

  // NPC archetype factory — pre-load archetypes from base content
  g.npcScheduleSystem = new NpcScheduleSystem();
  g.npcArchetypeSystem = new NpcArchetypeSystem();
  g.npcArchetypeSystem.scheduleSystem = g.npcScheduleSystem;
  g.npcArchetypeSystem.registerAll(frameworkBaseContent.npcArchetypes);

  g.spellSystem     = new SpellSystem(g.player, g.scheduleSystem.npcs, g.ui, g.scene);
  // Seed the player with the two starter spells
  g.spellSystem.learnSpell("kindle");
  g.spellSystem.learnSpell("mending");
  g.spellSystem.equipSpell("kindle");
  // Sync magic damage bonus from attributes
  g.spellSystem.magicDamageBonus = g.attributeSystem.magicDamageBonus; g.spellSystem.silenced = () => g.activeEffectsSystem?.isSilenced ?? false;

  g.persuasionSystem = new PersuasionSystem();

  // ── v4 system wiring (browser optimisation) ──────────────────────────────
  // LOD system: run the visibility pass every 5 frames for performance.
  // Registered meshes are pruned when disposed; no global clear on cell travel.
  g.lodSystem = new LodSystem({ updateEveryNFrames: 5 });
  g.lodSystem.setQuality(g.graphics.tier);
  g.lodSystem.setCamera(g.player.camera);
  g.world.setLodSystem(g.lodSystem);

  // Register v3 systems with save
  g.saveSystem.setSpellSystem(g.spellSystem);
  g.saveSystem.setPersuasionSystem(g.persuasionSystem);

  // ── Crafting: alchemy, enchanting, smithing + gear wear ─────────────────
  // Shift+B opens the forge.  Gear wears in combat; Repair Hammers mend it.
  g._crafting = new CraftingFeature({
    player: g.player,
    ui: g.ui,
    inventory: g.inventorySystem,
    equipment: g.equipmentSystem,
  });
  g.saveSystem.setAlchemySystem(g.alchemySystem);
  g.saveSystem.setEnchantingSystem(g.enchantingSystem);
  g._installFeatures();
  // Forget condition for gear that left the world (dropped, or wiped by a shop restock).
  g.eventBus.on("save:beforeSave", () => {
    g.smithing.pruneConditions([
      ...g.inventorySystem.items,
      ...g.equipmentSystem.getEquipped().values(),
      ...(g.horseSystem?.ownedHorses ?? []).flatMap((h) => g.horseSystem.getSaddlebag(h.id) ?? []),
      // Sold gear keeps its wear while it sits in a shop (no free repair by buyback).
      ...[...(g.barterSystem?.merchants.values() ?? [])].flatMap((m) => m.inventory),
    ]);
  });
  // Worn gear trades for less, and barter rows show each piece's condition.
  g.barterSystem.itemValueMultiplier = (item) => g.smithing.getValueMultiplier(item);
  g._trade.setItemTag((item) => {
    const c = g.smithing.getItemCondition(item);
    return c === null ? null : `${Math.round(c)}%`;
  });
  // Hovering a piece of gear in the inventory shows its condition.
  g.ui.itemDetailSuffix = (item) => {
    const c = g.smithing.getItemCondition(item);
    return c === null ? "" : `\nCondition: ${Math.round(c)}%`;
  };
  g.saveSystem.setItemConditionSystem(g.itemConditionSystem);

  // ── v6 system wiring (Weather + QuickSlots) ────────────────────────────────
  // WeatherSystem: Markov-chain atmospheric weather with fog/light integration.
  // Pass scene and light references so it can directly update visuals each tick.
  g.weatherSystem = new WeatherSystem(
    "clear",
    g.scene,
    g.scene.getLightByName("hLight") as any,
    g.scene.getLightByName("sun") as any,
    { ambientBase: g.graphics.lighting.ambientBase, sunBase: g.graphics.lighting.sunBase },
  );
  g.weatherSystem.events = g.eventBus;
  g.saveSystem.setWeatherSystem(g.weatherSystem);

  // QuickSlotSystem: bind consumable items to hotkeys 7, 8, 9, 0.
  g.quickSlotSystem = new QuickSlotSystem(g.inventorySystem, g.player, g.ui);
  // Seed slot 7 with the starter health potion (if the player has one)
  g.quickSlotSystem.bindSlot("7", "potion_hp_01");
  g.quickSlotSystem.events = g.eventBus;
  g.eventBus.on("item:consumed", ({ item, source }) => {
    // Food restores hunger via the survival system (potions restore stats
    // directly inside QuickSlotSystem).
    const nutrition = item.stats?.nutrition;
    if (typeof nutrition === "number" && nutrition > 0) {
      g.survivalSystem.eat(nutrition);
      g.ui.showNotification(`Ate ${item.name}.`, 1600);
    }
    g.eventBus.emit("player:consumeItem" as any, { itemId: item.id, source });
    g.saveSystem.markDirty();
  });
  g.saveSystem.setQuickSlotSystem(g.quickSlotSystem);

  g.eventBus.on("ui:inventoryItemClick", ({ item }) => {
    if (tryAssignQuickSlotFromClick(g, item)) return;
    if (g.smithing.tryUseRepairItem(item)) {
      g.saveSystem.markDirty();
      return;
    }
    if (g.quickSlotSystem.tryConsumeFromInventoryRow(item)) {
      g.saveSystem.markDirty();
      return;
    }
    g.equipmentSystem.handleItemClick(item);
  });
  g.ui.isConsumableItem = isConsumableItem;

  // ── v7 system wiring (QoL: Wait + Compass) ────────────────────────────────
  g.waitSystem = new WaitSystem();
  g.saveSystem.setWaitSystem(g.waitSystem);
  g.eventBus.on("ui:waitConfirm", ({ hours }) => {
    if (actors.bodies([Engaged], [Dead]).length > 0) { g.ui.showNotification("You cannot wait with enemies nearby.", 2400); return; } // as fast travel: no resting mid-fight
    const result = g.waitSystem.wait(hours, g.timeSystem, g.player);
    if (result.ok) {
      // Waiting counts as light sleep — resting at an inn restores more.
      g.survivalSystem.rest(hours * 14);
      g.ui.showNotification(result.message, 2800);
      g.saveSystem.markDirty();
    }
  });
  // Panels the player closes from inside go through the modal registry.
  g.eventBus.on("ui:panelClosed", ({ id }) => g._modals.close(id));
}
