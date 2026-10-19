import { SAVE_STORAGE_KEY } from "./constants";
import { getDesktopBridge } from "./desktop-bridge";

/** Synchronous key/value slot used by SaveSystem. */
export interface SaveStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * When the Electron shell is present, mirror the primary save slot to
 * `userData/saves/slot.json` so Steam Auto-Cloud can watch a real file.
 * Reads stay on localStorage, which hydrateDesktopSave fills at boot.
 */
export function desktopMirroredSaveStore(): SaveStore | null {
  const bridge = getDesktopBridge();
  if (!bridge) return null;

  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => {
      localStorage.setItem(key, value);
      if (key === SAVE_STORAGE_KEY) {
        void bridge.writeSave(value).catch((error: unknown) => {
          console.warn("[Camelot] Desktop save mirror failed", error);
        });
      }
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
      if (key === SAVE_STORAGE_KEY) {
        void bridge.deleteSave().catch((error: unknown) => {
          console.warn("[Camelot] Desktop save delete failed", error);
        });
      }
    },
  };
}
