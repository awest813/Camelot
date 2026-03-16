import { applySaveMigrations } from "./migrations";
import {
  FRAMEWORK_SAVE_SCHEMA_VERSION,
  FrameworkSaveFile,
  FrameworkStateSnapshot,
  SaveValidationResult,
  StorageAdapter,
} from "./save-types";

const DEFAULT_STORAGE_KEY = "camelot_framework_save";

/**
 * Compute a simple FNV-1a 32-bit checksum over a string.
 * Used to detect accidental corruption in persisted save data.
 */
function computeChecksum(data: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = (Math.imul(hash, 0x01000193) >>> 0);
  }
  return hash.toString(16).padStart(8, "0");
}

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
    try {
      const raw = this._storage.getItem(this._storageKey);
      if (!raw) return null;

      const deserialized = this.deserialize(raw);
      const validation = this.validateSaveFile(deserialized);
      if (!validation.valid) {
        return null;
      }

      return deserialized;
    } catch {
      return null;
    }
  }

  /**
   * Exports a save file as a self-contained JSON string with an embedded checksum.
   * Use `importSave` to load and verify the result.
   */
  public exportSave(snapshot: FrameworkStateSnapshot, profileId: string = "default"): string {
    const saveFile = this.createSave(snapshot, profileId);
    const stateJson = JSON.stringify(saveFile.state);
    const checksum = computeChecksum(stateJson);
    const exportFile: FrameworkSaveFile = { ...saveFile, checksum };
    return JSON.stringify(exportFile);
  }

  /**
   * Imports and validates a save string produced by `exportSave`.
   * Returns the migrated save file on success.
   * Throws a descriptive error if the data is corrupt or unparseable.
   * Attempts best-effort partial recovery when the checksum is missing.
   */
  public importSave(raw: string): FrameworkSaveFile {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Save import failed: data is not valid JSON.");
    }

    const obj = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    if (!obj) {
      throw new Error("Save import failed: root value must be an object.");
    }

    // Verify checksum when present; warn-only (partial recovery) when absent.
    if (typeof obj.checksum === "string") {
      const { checksum: storedChecksum, ...rest } = obj;
      const stateJson = JSON.stringify((rest as unknown as FrameworkSaveFile).state);
      const actualChecksum = computeChecksum(stateJson);
      if (actualChecksum !== storedChecksum) {
        throw new Error(
          `Save import failed: checksum mismatch (expected ${storedChecksum}, got ${actualChecksum}). Data may be corrupted.`
        );
      }
    }

    return applySaveMigrations(parsed, FRAMEWORK_SAVE_SCHEMA_VERSION);
  }

  /**
   * Validates a save file object without throwing.
   * Returns a result indicating whether the file is structurally sound and the checksum matches.
   */
  public validateSaveFile(saveFile: FrameworkSaveFile): SaveValidationResult {
    if (typeof saveFile.schemaVersion !== "number") {
      return { valid: false, reason: "Missing or invalid schemaVersion." };
    }
    if (saveFile.schemaVersion > FRAMEWORK_SAVE_SCHEMA_VERSION) {
      return { valid: false, reason: `Unknown schema version ${saveFile.schemaVersion}.` };
    }
    if (typeof saveFile.profileId !== "string" || saveFile.profileId.trim() === "") {
      return { valid: false, reason: "Missing or empty profileId." };
    }
    if (typeof saveFile.state !== "object" || saveFile.state === null) {
      return { valid: false, reason: "Missing state object." };
    }
    if (typeof saveFile.checksum === "string") {
      const stateJson = JSON.stringify(saveFile.state);
      const actual = computeChecksum(stateJson);
      if (actual !== saveFile.checksum) {
        return { valid: false, reason: `Checksum mismatch (expected ${saveFile.checksum}, got ${actual}).` };
      }
    }
    return { valid: true };
  }
}
