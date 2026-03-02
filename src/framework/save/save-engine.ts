import { applySaveMigrations } from "./migrations";
import { FRAMEWORK_SAVE_SCHEMA_VERSION, FrameworkSaveFile, FrameworkStateSnapshot, StorageAdapter } from "./save-types";

const DEFAULT_STORAGE_KEY = "camelot_framework_save";

export class SaveEngine {
  private _storage: StorageAdapter | null;
  private _storageKey: string;

  constructor(storage?: StorageAdapter, storageKey: string = DEFAULT_STORAGE_KEY) {
    this._storage = storage ?? null;
    this._storageKey = storageKey;
  }

  public createSave(snapshot: FrameworkStateSnapshot, profileId: string = "default"): FrameworkSaveFile {
    return {
      schemaVersion: FRAMEWORK_SAVE_SCHEMA_VERSION,
      savedAt: Date.now(),
      profileId,
      state: {
        dialogueState: { ...snapshot.dialogueState },
        questState: { ...snapshot.questState },
        inventoryState: { ...snapshot.inventoryState },
        factionState: { ...snapshot.factionState },
        flags: { ...snapshot.flags },
        legacyState: snapshot.legacyState ? { ...snapshot.legacyState } : {},
      },
    };
  }

  public serialize(snapshot: FrameworkStateSnapshot, profileId: string = "default"): string {
    return JSON.stringify(this.createSave(snapshot, profileId));
  }

  public deserialize(raw: string): FrameworkSaveFile {
    const parsed = JSON.parse(raw);
    return applySaveMigrations(parsed, FRAMEWORK_SAVE_SCHEMA_VERSION);
  }

  public saveToStorage(snapshot: FrameworkStateSnapshot, profileId: string = "default"): FrameworkSaveFile {
    if (!this._storage) {
      throw new Error("SaveEngine storage adapter is not configured.");
    }
    const saveFile = this.createSave(snapshot, profileId);
    this._storage.setItem(this._storageKey, JSON.stringify(saveFile));
    return saveFile;
  }

  public loadFromStorage(): FrameworkSaveFile | null {
    if (!this._storage) {
      throw new Error("SaveEngine storage adapter is not configured.");
    }
    const raw = this._storage.getItem(this._storageKey);
    if (!raw) return null;
    return this.deserialize(raw);
  }
}
