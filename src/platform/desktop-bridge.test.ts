import { afterEach, describe, expect, it, vi } from "vitest";
import { SAVE_STORAGE_KEY } from "./constants";
import { hydrateDesktopSave } from "./desktop-bridge";
import { desktopMirroredSaveStore } from "./save-store";

function installBridge(readSave: () => Promise<string | null>) {
  const writeSave = vi.fn(async () => undefined);
  const deleteSave = vi.fn(async () => undefined);
  window.camelotDesktop = {
    readSave,
    writeSave,
    deleteSave,
    quit: vi.fn(),
    toggleFullscreen: vi.fn(async () => true),
    setFullscreen: vi.fn(async () => false),
    isFullscreen: vi.fn(async () => false),
    unlockAchievement: vi.fn(async () => false),
    syncAchievements: vi.fn(async (ids: string[]) => ids),
    getSteamStatus: vi.fn(async () => ({
      mode: "offline" as const,
      appId: "0",
      persona: null,
      cloud: false,
    })),
  };
  return { writeSave, deleteSave };
}

describe("desktop save hydration", () => {
  afterEach(() => {
    localStorage.removeItem(SAVE_STORAGE_KEY);
    delete window.camelotDesktop;
  });

  it("does nothing in the browser", async () => {
    localStorage.setItem(SAVE_STORAGE_KEY, "{\"version\":29,\"timestamp\":1}");
    await hydrateDesktopSave();
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe("{\"version\":29,\"timestamp\":1}");
  });

  it("prefers the newer valid disk slot and ignores corrupt files", async () => {
    const older = JSON.stringify({ version: 29, timestamp: 10, player: {} });
    const newer = JSON.stringify({ version: 29, timestamp: 50, player: {} });
    localStorage.setItem(SAVE_STORAGE_KEY, older);
    installBridge(async () => newer);
    await hydrateDesktopSave();
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(newer);

    installBridge(async () => "not-json");
    await hydrateDesktopSave();
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(newer);
  });

  it("keeps a newer local slot", async () => {
    const local = JSON.stringify({ version: 29, timestamp: 80 });
    const disk = JSON.stringify({ version: 29, timestamp: 20 });
    localStorage.setItem(SAVE_STORAGE_KEY, local);
    installBridge(async () => disk);
    await hydrateDesktopSave();
    expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(local);
  });

  it("mirrors writes and deletes for the primary slot only", () => {
    const { writeSave, deleteSave } = installBridge(async () => null);
    const store = desktopMirroredSaveStore();
    expect(store).not.toBeNull();
    store!.setItem(SAVE_STORAGE_KEY, "{\"version\":29}");
    store!.setItem("other", "x");
    store!.removeItem(SAVE_STORAGE_KEY);
    expect(writeSave).toHaveBeenCalledWith("{\"version\":29}");
    expect(deleteSave).toHaveBeenCalledOnce();
    expect(localStorage.getItem("other")).toBe("x");
  });
});
