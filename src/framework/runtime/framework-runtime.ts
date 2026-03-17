import { ContentRegistry } from "../content/content-registry";
import { RpgContentBundle } from "../content/content-types";
import { DialogueEngine, DialogueSession } from "../dialogue/dialogue-engine";
import { DialogueContext } from "../dialogue/dialogue-types";
import { FactionEngine } from "../factions/faction-engine";
import { InventoryEngine } from "../inventory/inventory-engine";
import { QuestGraphEngine } from "../quests/quest-graph-engine";
import { QuestEvent, QuestEventResult } from "../quests/quest-types";
import { SaveEngine } from "../save/save-engine";
import { FrameworkSaveFile, FrameworkStateSnapshot, StorageAdapter } from "../save/save-types";
import { ModLoader } from "../mods/mod-loader";
import { FetchLike, ModLoadReport } from "../mods/mod-types";
import { IFrameworkEventAdapter } from "./framework-adapter";

export interface FrameworkRuntimeOptions {
  inventoryCapacity?: number;
  storage?: StorageAdapter;
  storageKey?: string;
  fetchImpl?: FetchLike;
  /**
   * Optional callback used to evaluate `skill_min` dialogue choice conditions.
   * Should return the player's current rank for the given skill id (0 if unknown).
   *
   * Wire this to `SkillTreeSystem.getSkillRank` in the host game so that
   * dialogue choices gated by skill level are correctly enabled/disabled.
   */
  skillLevelProvider?: (skillId: string) => number;
}

export class FrameworkRuntime {
  public readonly contentRegistry = new ContentRegistry();
  public readonly saveEngine: SaveEngine;

  private _flags = new Map<string, boolean>();
  private _dialogueEngine: DialogueEngine;
  private _questEngine: QuestGraphEngine;
  private _inventoryEngine: InventoryEngine;
  private _factionEngine: FactionEngine;
  private _modLoader: ModLoader | null = null;
  private _skillLevelProvider: ((skillId: string) => number) | undefined;
  private _adapters: Set<IFrameworkEventAdapter> = new Set();

  constructor(baseContent: RpgContentBundle, options: FrameworkRuntimeOptions = {}) {
    this.contentRegistry.loadBase(baseContent);
    this._skillLevelProvider = options.skillLevelProvider;
    this._rebuildEngines(options.inventoryCapacity ?? 20);
    this.saveEngine = new SaveEngine(options.storage, options.storageKey);
    if (options.fetchImpl) {
      this._modLoader = new ModLoader(options.fetchImpl);
    }
  }

  public get dialogueEngine(): DialogueEngine {
    return this._dialogueEngine;
  }

  public get questEngine(): QuestGraphEngine {
    return this._questEngine;
  }

  public get inventoryEngine(): InventoryEngine {
    return this._inventoryEngine;
  }

  public get factionEngine(): FactionEngine {
    return this._factionEngine;
  }

  // ── Adapter registration ──────────────────────────────────────────────────

  /**
   * Register an event adapter.  The adapter will receive notifications for
   * all framework events until it is unregistered.
   *
   * Registering the same adapter instance twice is a no-op.
   */
  public registerAdapter(adapter: IFrameworkEventAdapter): void {
    this._adapters.add(adapter);
  }

  /**
   * Unregister a previously registered adapter.  No-op if the adapter is
   * not currently registered.
   */
  public unregisterAdapter(adapter: IFrameworkEventAdapter): void {
    this._adapters.delete(adapter);
  }

  /** Number of currently registered adapters. */
  public get adapterCount(): number {
    return this._adapters.size;
  }

  // ── Core operations ───────────────────────────────────────────────────────

  public createDialogueSession(dialogueId: string): DialogueSession {
    const context: DialogueContext = {
      getFlag: (flag) => this._flags.get(flag) ?? false,
      setFlag: (flag, value) => {
        this._flags.set(flag, value);
        for (const adapter of this._adapters) adapter.onFlagChange?.(flag, value);
      },
      getFactionReputation: (factionId) => this._factionEngine.getReputation(factionId),
      adjustFactionReputation: (factionId, amount) => {
        this._factionEngine.adjustReputation(factionId, amount);
        const newRep = this._factionEngine.getReputation(factionId);
        for (const adapter of this._adapters) adapter.onFactionReputationChange?.(factionId, newRep);
      },
      getQuestStatus: (questId) => this._questEngine.getQuestStatus(questId),
      getInventoryCount: (itemId) => this._inventoryEngine.getItemCount(itemId),
      getSkillLevel: this._skillLevelProvider,
      emitEvent: (eventId, payload) => {
        const event = this._translateDialogueEvent(eventId, payload);
        if (event) {
          const results = this._questEngine.applyEvent(event);
          for (const adapter of this._adapters) adapter.onQuestEvent?.(event, results);
        }
      },
      activateQuest: (questId) => {
        this._questEngine.activateQuest(questId);
      },
      consumeItem: (itemId, quantity) => {
        const result = this._inventoryEngine.removeItem(itemId, quantity);
        if (result.success) {
          const newQty = this._inventoryEngine.getItemCount(itemId);
          for (const adapter of this._adapters) adapter.onInventoryChange?.(itemId, newQty);
        }
        return result.success;
      },
      giveItem: (itemId, quantity) => {
        this._inventoryEngine.addItem(itemId, quantity);
        const newQty = this._inventoryEngine.getItemCount(itemId);
        for (const adapter of this._adapters) adapter.onInventoryChange?.(itemId, newQty);
      },
    };

    const session = this._dialogueEngine.createSession(dialogueId, context);

    // Subscribe to the session's completion event to notify adapters.
    session.onComplete = (completedDialogueId) => {
      for (const adapter of this._adapters) adapter.onDialogueComplete?.(completedDialogueId);
    };

    return session;
  }

  public applyQuestEvent(event: QuestEvent): QuestEventResult[] {
    const results = this._questEngine.applyEvent(event);
    for (const adapter of this._adapters) adapter.onQuestEvent?.(event, results);
    return results;
  }

  public getSaveSnapshot(): FrameworkStateSnapshot {
    return {
      dialogueState: {},
      questState: this._questEngine.getSnapshot() as unknown as Record<string, unknown>,
      inventoryState: this._inventoryEngine.getSnapshot() as unknown as Record<string, unknown>,
      factionState: this._factionEngine.getSnapshot() as unknown as Record<string, unknown>,
      flags: Object.fromEntries(this._flags.entries()),
    };
  }

  public createSave(profileId: string = "default"): FrameworkSaveFile {
    return this.saveEngine.createSave(this.getSaveSnapshot(), profileId);
  }

  public restoreFromSave(saveFile: FrameworkSaveFile): void {
    this._flags = new Map(Object.entries(saveFile.state.flags ?? {}));
    this._questEngine.restoreSnapshot(saveFile.state.questState as unknown as ReturnType<QuestGraphEngine["getSnapshot"]>);
    this._inventoryEngine.restoreSnapshot(
      saveFile.state.inventoryState as unknown as ReturnType<InventoryEngine["getSnapshot"]>
    );
    this._factionEngine.restoreSnapshot(
      saveFile.state.factionState as unknown as ReturnType<FactionEngine["getSnapshot"]>
    );
  }

  public async loadModsFromManifest(manifestUrl: string): Promise<ModLoadReport> {
    if (!this._modLoader) {
      throw new Error("FrameworkRuntime requires fetchImpl to load mods.");
    }
    const baseBundle = this.contentRegistry.toBundle();
    const { content, report } = await this._modLoader.loadAndMerge(baseBundle, manifestUrl);
    this.contentRegistry.registerBundle(content, "merged", true);
    const capacity = this._inventoryEngine.getSnapshot().capacity;
    this._rebuildEngines(capacity);
    return report;
  }

  private _translateDialogueEvent(eventId: string, payload?: Record<string, unknown>): QuestEvent | null {
    if (!eventId.startsWith("quest:")) return null;
    const [_, type, targetId] = eventId.split(":");
    if (!type || !targetId) return null;
    if (type !== "kill" && type !== "pickup" && type !== "talk" && type !== "custom") return null;
    return {
      type,
      targetId,
      amount: typeof payload?.amount === "number" ? payload.amount : 1,
    };
  }

  private _rebuildEngines(inventoryCapacity: number): void {
    const bundle = this.contentRegistry.toBundle();
    this._dialogueEngine = new DialogueEngine(bundle.dialogues);
    this._questEngine = new QuestGraphEngine(bundle.quests);
    this._inventoryEngine = new InventoryEngine(bundle.items, inventoryCapacity);
    this._factionEngine = new FactionEngine(bundle.factions);
  }
}
