/**
 * The data framework's side of the game: content mods, dialogue sessions, and the events dialogue fires at the host.
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { resolveDialogueIdForNpcMeshName } from "../systems/dialogue-npc-resolve";

export function loadFrameworkMods(g: Game): void {
  g.frameworkRuntime
      .loadModsFromManifest(`${import.meta.env.BASE_URL ?? "/"}mods/mods-manifest.json`)
      .then((report) => {
          if (report.loadedModIds.length > 0) {
              g.ui.showNotification(`Framework mods loaded: ${report.loadedModIds.length}`, 2200);
          }
          if (report.failures.length > 0) {
              g.ui.showNotification(`Framework mod failures: ${report.failures.length}`, 3000);
          }
      })
      .catch(() => {
          // Mods are optional for local runtime; ignore network/404 failures.
      });
}

export function createFrameworkDialogueSession(g: Game, npcName: string) {
  const archetypes = g.frameworkRuntime.contentRegistry.getAllNpcArchetypes();
  const dialogueId = resolveDialogueIdForNpcMeshName(npcName, archetypes);
  if (!dialogueId) return null;
  if (!g.frameworkRuntime.dialogueEngine.hasDialogue(dialogueId)) {
      if (import.meta.env.DEV) {
          console.warn(`[Game] No registered dialogue '${dialogueId}' for NPC mesh '${npcName}'.`);
      }
      return null;
  }
  try {
      return g.frameworkRuntime.createDialogueSession(dialogueId);
  } catch (err) {
      if (import.meta.env.DEV) {
          console.warn(`[Game] createDialogueSession('${dialogueId}') failed for '${npcName}'.`, err);
      }
      return null;
  }
}

export function handleDialogueHostEvent(g: Game, eventId: string, payload?: Record<string, unknown>): void {
  // Features act on dialogue actions ("jobs:ask", "barter:open",
  // "smithing:open", "trainer:train", "rest:inn", …).
  g.eventBus.emit("dialogue:action", { eventId, npcName: g._currentDialogueNpcName, payload });
}
