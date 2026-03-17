import { QuestEvent, QuestEventResult } from "../quests/quest-types";

// ── Framework event adapter interface ────────────────────────────────────────

/**
 * Adapter interface that host-game systems can implement to react to
 * framework-level events without a direct dependency on the internal
 * engine classes.
 *
 * All methods are optional — implement only the events your system cares
 * about.  Adapters are registered with `FrameworkRuntime.registerAdapter()`
 * and unregistered with `FrameworkRuntime.unregisterAdapter()`.
 *
 * **Design intent**
 *
 * The adapter bridge lets demo gameplay systems (which may depend on
 * BabylonJS or other runtime libraries) consume framework state changes
 * as source-of-truth notifications rather than maintaining their own
 * parallel state.  This makes the `FrameworkRuntime` the single authority
 * for quest, inventory, faction, and flag data while still allowing the
 * game layer to react to those changes.
 *
 * **Example**
 * ```ts
 * class MyQuestHUD implements IFrameworkEventAdapter {
 *   onQuestEvent(event, results) {
 *     for (const result of results) {
 *       if (result.questCompleted) {
 *         showCompletionBanner(result.questId);
 *       }
 *     }
 *   }
 * }
 *
 * runtime.registerAdapter(new MyQuestHUD());
 * ```
 */
export interface IFrameworkEventAdapter {
  /**
   * Called after `FrameworkRuntime.applyQuestEvent()` finishes processing.
   *
   * @param event   - The quest event that was applied.
   * @param results - Per-quest result records (may be empty if no quest
   *   matched the event).
   */
  onQuestEvent?(event: QuestEvent, results: QuestEventResult[]): void;

  /**
   * Called when an item quantity changes in the inventory engine.
   *
   * Fired by both `addItem` and `removeItem` operations.  `newQuantity`
   * reflects the count after the operation; 0 means the item was fully
   * removed.
   *
   * @param itemId      - The item that changed.
   * @param newQuantity - The item's new total quantity (0 = removed).
   */
  onInventoryChange?(itemId: string, newQuantity: number): void;

  /**
   * Called when a faction reputation value changes.
   *
   * @param factionId      - The faction whose reputation changed.
   * @param newReputation  - The reputation value after the change.
   */
  onFactionReputationChange?(factionId: string, newReputation: number): void;

  /**
   * Called when a named flag is set or cleared.
   *
   * @param flag  - The flag name.
   * @param value - The flag's new boolean value.
   */
  onFlagChange?(flag: string, value: boolean): void;

  /**
   * Called when a dialogue session reaches its end (all choices exhausted or
   * `endsDialogue: true` is reached).
   *
   * @param dialogueId - The id of the dialogue tree that completed.
   */
  onDialogueComplete?(dialogueId: string): void;
}
