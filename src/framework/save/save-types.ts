export const FRAMEWORK_SAVE_SCHEMA_VERSION = 1;

export interface FrameworkStateSnapshot {
  dialogueState: Record<string, unknown>;
  questState: Record<string, unknown>;
  inventoryState: Record<string, unknown>;
  factionState: Record<string, unknown>;
  flags: Record<string, boolean>;
  legacyState?: Record<string, unknown>;
}

export interface FrameworkSaveFile {
  schemaVersion: number;
  savedAt: number;
  profileId: string;
  state: FrameworkStateSnapshot;
  checksum?: string;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SaveValidationResult {
  valid: boolean;
  reason?: string;
}
