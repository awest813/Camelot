/**
 * The game's own reactions to events that must run before the features' (subscribed first).
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { cleanupCollectedLoot, hydrateCellAfterLoad } from "./cells";
import { syncWeaponArchetype } from "./game-loop";

/**
 * The game's reactions that must come before the features' own (they are
 * subscribed first): after a load, the world is cleaned up and the cell
 * rebuilt before features reset; after a conversation, the barter purse
 * is synced before features act on it; a loaded chunk opens its scope
 * before anything is put in it.
 */
export function wireEarlyReactions(g: Game): void {
  const bus = g.eventBus;
  bus.on("save:loaded", () => {
    cleanupCollectedLoot(g);
    hydrateCellAfterLoad(g);
    // Saved equipment bypasses equip() — re-sync the weapon archetype.
    syncWeaponArchetype(g);
    // The bandit bounty is live or done in this save, or still to come (a save from before it).
    g._banditQuestStarted = g.frameworkRuntime.questEngine.getQuestStatus("quest_bandit_bounty") !== "inactive";
  });
  bus.on("dialogue:closed", () => { g.barterSystem.playerGold = g._pack.gold(); });
  bus.on("chunk:loaded", ({ chunkKey, cx, cz, biome }) => {
    g._chunks.open(chunkKey);
    // What goes where lives in the world-sites feature (villages, camps,
    // inns, homesteads, the dragon, wild nature).
    g.worldSites.populate(chunkKey, cx, cz, biome);
    // New ground and walls: the navmesh rebuilds (debounced, in a worker).
    g.navigationSystem.requestRebuild();
  });
}
