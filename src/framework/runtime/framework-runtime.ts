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
      getInventoryCount: (itemId) => this._inventoryEngine.getItemCount(itemId),
      getSkillLevel: this._skillLevelProvider,
      emitEvent: (eventId, payload) => {
        const event = this._translateDialogueEvent(eventId, payload);
        if (event) {
          this._questEngine.applyEvent(event);
        }
      },
      activateQuest: (questId) => {
        this._questEngine.activateQuest(questId);
      },
      consumeItem: (itemId, quantity) => {
        return this._inventoryEngine.removeItem(itemId, quantity).success;
      },
      giveItem: (itemId, quantity) => {
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
