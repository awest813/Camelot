import { SAVE_STORAGE_KEY } from "./constants";

export interface SteamStatus {
  mode: "steamworks" | "offline";
  appId: string;
  persona: string | null;
  cloud: boolean;
}

/**
 * Context-bridge API exposed by the Electron preload script as
 * `window.camelotDesktop`. The browser build never sets it.
 */
export interface CamelotDesktopBridge {
  readSave(): Promise<string | null>;
  writeSave(json: string): Promise<void>;
  deleteSave(): Promise<void>;
  quit(): void;
  toggleFullscreen(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  unlockAchievement(id: string): Promise<boolean>;
  syncAchievements(ids: string[]): Promise<string[]>;
  getSteamStatus(): Promise<SteamStatus>;
}

declare global {
  interface Window {
    camelotDesktop?: CamelotDesktopBridge;
  }
}

/** The desktop shell, or null in a normal browser tab. */
export function getDesktopBridge(): CamelotDesktopBridge | null {
  if (typeof window === "undefined") return null;
  const api = window.camelotDesktop;
  if (!api || typeof api.readSave !== "function" || typeof api.writeSave !== "function") {
    return null;
  }
  return api;
}

function readTimestamp(json: string): number | null {
  try {
    const parsed = JSON.parse(json) as { timestamp?: unknown; version?: unknown };
    if (typeof parsed.version !== "number" || typeof parsed.timestamp !== "number") return null;
    if (!Number.isFinite(parsed.timestamp)) return null;
    return parsed.timestamp;
  } catch {
    return null;
  }
}

/**
 * Copy the newer of the on-disk Steam Cloud slot and the browser slot into
 * localStorage before the game constructs SaveSystem. Corrupt disk data is
 * ignored so a bad write cannot wipe a good local save.
 */
export async function hydrateDesktopSave(): Promise<void> {
  const bridge = getDesktopBridge();
  if (!bridge || typeof localStorage === "undefined") return;

  let disk: string | null;
  try {
    disk = await bridge.readSave();
  } catch (error) {
    console.warn("[Camelot] Could not read the desktop save", error);
    return;
  }
  if (!disk) return;

  const diskTimestamp = readTimestamp(disk);
  if (diskTimestamp === null) return;

  const local = localStorage.getItem(SAVE_STORAGE_KEY);
  const localTimestamp = local ? readTimestamp(local) : null;
  if (localTimestamp === null || diskTimestamp >= localTimestamp) {
    localStorage.setItem(SAVE_STORAGE_KEY, disk);
  }
}
