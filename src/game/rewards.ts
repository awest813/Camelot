/**
 * Rewards the world hands out: dynamic world events, and what the player lifts from pockets.
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { COIN_PURSE } from "../features/pickpocket/pickpocket-feature";
import type { DynamicEventReward } from "../systems/dynamic-world-event-system";

export function grantDynamicWorldEventReward(g: Game, reward: DynamicEventReward): void {
  const xp = Math.max(0, Math.floor(reward.xp ?? 0));
  const gold = Math.max(0, Math.floor(reward.gold ?? 0));

  if (xp > 0) {
    g.player.addExperience(xp);
    g.ui.showNotification(`+${xp} XP`, 1800);
  }

  if (gold > 0) {
    g._pack.addGold(gold);
    g.ui.showNotification(`+${gold} gold`, 1800);
  }

  if (reward.label) {
    g.ui.showNotification(reward.label, 2500);
  }

  if (xp > 0 || gold > 0) {
    g.saveSystem.markDirty();
  }
}

/** Move a successfully lifted item into the player inventory. */
export function grantPickpocketItem(g: Game, itemId: string): void {
  if (itemId === COIN_PURSE) {
      g._pack.addGold(8);
      g.ui.showNotification("Coin purse: +8 gold", 2200);
      return;
  }
  g._pack.receive(itemId, () => ({
      id: itemId, name: g._thief.label(itemId), description: "Lifted.",
      stackable: false, quantity: 1, weight: 0.5, stats: { value: 10 },
  }));
}

/** Once per in-game hour: features (world events, raids, …) react to `time:hour`. */
export function updateDynamicWorldEventsOnHourChange(g: Game): void {
  const elapsedHour = Math.floor(g.timeSystem.elapsedGameHours);
  if (elapsedHour === g._lastDynamicWorldEventHour) return;
  g._lastDynamicWorldEventHour = elapsedHour;
  g.eventBus.emit("time:hour", { hour: g.timeSystem.hour, elapsedHours: g.timeSystem.elapsedGameHours });
}
