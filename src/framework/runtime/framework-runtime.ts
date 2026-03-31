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
  /**
   * When set, dialogue `emit_event` effects invoke this after quest-event translation
   * so the host can handle non-quest ids (`barter:open`, `rest:inn`, …).
   */
  onDialogueHostEvent?: (eventId: string, payload?: Record<string, unknown>) => void;
  /**
   * When set, dialogue `consume_item` uses this instead of the headless inventory engine.
   * Return whether the items were removed.
   */
  onDialogueConsumeItem?: (itemId: string, quantity: number) => boolean;
  /**
   * When set, dialogue `give_item` delegates here (framework inventory is not updated by
   * `createDialogueSession` in that case — the host should mirror state if needed).
   */
  onDialogueGiveItem?: (itemId: string, quantity: number) => void;
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
  private _onDialogueHostEvent?: (eventId: string, payload?: Record<string, unknown>) => void;
  private _onDialogueConsumeItem?: (itemId: string, quantity: number) => boolean;
  private _onDialogueGiveItem?: (itemId: string, quantity: number) => void;
  private _dialogueInventoryCount?: (itemId: string) => number;

  constructor(baseContent: RpgContentBundle, options: FrameworkRuntimeOptions = {}) {
    this.contentRegistry.loadBase(baseContent);
    this._skillLevelProvider = options.skillLevelProvider;
    this._onDialogueHostEvent = options.onDialogueHostEvent;
    this._onDialogueConsumeItem = options.onDialogueConsumeItem;
    this._onDialogueGiveItem = options.onDialogueGiveItem;
    this._rebuildEngines(options.inventoryCapacity ?? 20);
    this.saveEngine = new SaveEngine(options.storage, options.storageKey);
    if (options.fetchImpl) {
      this._modLoader = new ModLoader(options.fetchImpl);
    }
  }

  public get dialogueEngine(): DialogueEngine {
    return this._dialogueEngine;
  }

  /**
   * Update dialogue host hooks after construction (e.g. once BarterSystem exists).
   * Omitted keys leave the previous callback in place.
   */
  public setDialogueHostHooks(
    hooks: Partial<{
      onDialogueHostEvent: (eventId: string, payload?: Record<string, unknown>) => void;
      onDialogueConsumeItem: (itemId: string, quantity: number) => boolean;
      onDialogueGiveItem: (itemId: string, quantity: number) => void;
      dialogueInventoryCount: (itemId: string) => number;
    }>,
  ): void {
    if (hooks.onDialogueHostEvent !== undefined) this._onDialogueHostEvent = hooks.onDialogueHostEvent;
    if (hooks.onDialogueConsumeItem !== undefined) this._onDialogueConsumeItem = hooks.onDialogueConsumeItem;
    if (hooks.onDialogueGiveItem !== undefined) this._onDialogueGiveItem = hooks.onDialogueGiveItem;
    if (hooks.dialogueInventoryCount !== undefined) this._dialogueInventoryCount = hooks.dialogueInventoryCount;
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

  /**
   * Read a named boolean flag (returns `false` for unknown flags).
   * Flags are shared between dialogue sessions and are persisted in save files.
   */
  public getFlag(flag: string): boolean {
    return this._flags.get(flag) ?? false;
  }

  /**
   * Set a named boolean flag.
   * The change is immediately visible to all subsequent dialogue sessions.
   */
  public setFlag(flag: string, value: boolean): void {
    this._flags.set(flag, value);
  }

  public createDialogueSession(dialogueId: string): DialogueSession {
    const context: DialogueContext = {
      getFlag: (flag) => this._flags.get(flag) ?? false,
      setFlag: (flag, value) => {
        this._flags.set(flag, value);
      },
      getFactionReputation: (factionId) => this._factionEngine.getReputation(factionId),
      adjustFactionReputation: (factionId, amount) => {
        this._factionEngine.adjustReputation(factionId, amount);
      },
      getQuestStatus: (questId) => this._questEngine.getQuestStatus(questId),
      getInventoryCount: (itemId) =>
        this._dialogueInventoryCount?.(itemId) ?? this._inventoryEngine.getItemCount(itemId),
      getSkillLevel: this._skillLevelProvider,
      emitEvent: (eventId, payload) => {
        this._onDialogueHostEvent?.(eventId, payload);
        const event = this._translateDialogueEvent(eventId, payload);
        if (event) {
          this._questEngine.applyEvent(event);
        }
      },
      activateQuest: (questId) => {
        this._questEngine.activateQuest(questId);
      },
      consumeItem: (itemId, quantity) => {
        if (this._onDialogueConsumeItem) {
          return this._onDialogueConsumeItem(itemId, quantity);
        }
        return this._inventoryEngine.removeItem(itemId, quantity).success;
      },
      giveItem: (itemId, quantity) => {
        if (this._onDialogueGiveItem) {
          this._onDialogueGiveItem(itemId, quantity);
          return;
        }
        this._inventoryEngine.addItem(itemId, quantity);
      },
    };

    return this._dialogueEngine.createSession(dialogueId, context);
  }

  public applyQuestEvent(event: QuestEvent): QuestEventResult[] {
    return this._questEngine.applyEvent(event);
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
