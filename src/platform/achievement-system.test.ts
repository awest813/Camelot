import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { ACHIEVEMENTS, AchievementSystem } from "./achievement-system";
import { ACHIEVEMENT_STORAGE_KEY, GAME_VERSION } from "./constants";
import { GameEventBus } from "../systems/event-bus";
import packageJson from "../../package.json";

describe("AchievementSystem", () => {
  afterEach(() => {
    localStorage.removeItem(ACHIEVEMENT_STORAGE_KEY);
    delete window.camelotDesktop;
  });

  it("ships a unique Steam-safe catalogue", () => {
    const ids = ACHIEVEMENTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ACHIEVEMENTS) {
      expect(entry.id).toMatch(/^[A-Z0-9_]{1,64}$/);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("matches steam/achievements.json and the package version", () => {
    const onDisk = JSON.parse(readFileSync("steam/achievements.json", "utf8")) as { id: string }[];
    expect(onDisk.map((entry) => entry.id)).toEqual(ACHIEVEMENTS.map((entry) => entry.id));
    expect(packageJson.version).toBe(GAME_VERSION);
  });

  it("unlocks once, persists, and ignores unknown ids", () => {
    const system = new AchievementSystem();
    const seen: string[] = [];
    system.onUnlocked = (definition) => seen.push(definition.id);

    expect(system.unlock("ACH_FIRST_BLOOD")).toBe(true);
    expect(system.unlock("ACH_FIRST_BLOOD")).toBe(false);
    expect(system.unlock("NOT_A_REAL_ACHIEVEMENT")).toBe(false);
    expect(seen).toEqual(["ACH_FIRST_BLOOD"]);

    const restored = new AchievementSystem();
    expect(restored.isUnlocked("ACH_FIRST_BLOOD")).toBe(true);
    expect(restored.unlock("ACH_FIRST_BLOOD")).toBe(false);
  });

  it("maps gameplay events onto the launch set", () => {
    const system = new AchievementSystem();
    const bus = new GameEventBus();
    system.bind(bus);

    bus.emit("player:kill", { npcId: "bandit", npcName: "Bandit", xp: 10 });
    bus.emit("player:kill", { npcId: "dragon", npcName: "DragonBoss_1_2", xp: 80 });
    bus.emit("quest:completed", { questId: "q", xpReward: 25 });
    bus.emit("player:levelUp", { newLevel: 10 });
    bus.emit("player:died", {});
    bus.emit("spell:cast", { spellId: "flames", spellName: "Flames", magickaCost: 10 });
    bus.emit("pet:acquired", { petId: "wolf", petName: "Wolf", species: "wolf" });

    expect(system.isUnlocked("ACH_FIRST_BLOOD")).toBe(true);
    expect(system.isUnlocked("ACH_DRAGONSLAYER")).toBe(true);
    expect(system.isUnlocked("ACH_OATH_KEPT")).toBe(true);
    expect(system.isUnlocked("ACH_SEASONED")).toBe(true);
    expect(system.isUnlocked("ACH_KNIGHT_OF_THE_REALM")).toBe(true);
    expect(system.isUnlocked("ACH_ONCE_AND_FUTURE")).toBe(true);
    expect(system.isUnlocked("ACH_FIRST_SPELL")).toBe(true);
    expect(system.isUnlocked("ACH_COMPANION")).toBe(true);
  });

  it("unions desktop unlocks without a second toast", async () => {
    const system = new AchievementSystem();
    const toasted: string[] = [];
    system.onUnlocked = (definition) => toasted.push(definition.id);
    window.camelotDesktop = {
      readSave: vi.fn(async () => null),
      writeSave: vi.fn(async () => undefined),
      deleteSave: vi.fn(async () => undefined),
      quit: vi.fn(),
      toggleFullscreen: vi.fn(async () => true),
      setFullscreen: vi.fn(async () => true),
      isFullscreen: vi.fn(async () => false),
      unlockAchievement: vi.fn(async () => true),
      syncAchievements: vi.fn(async (ids: string[]) => [...ids, "ACH_SADDLED"]),
      getSteamStatus: vi.fn(async () => ({
        mode: "offline" as const,
        appId: "0",
        persona: null,
        cloud: false,
      })),
    };

    system.unlock("ACH_FIRST_BLOOD");
    await system.syncWithDesktop();

    expect(system.isUnlocked("ACH_SADDLED")).toBe(true);
    expect(toasted).toEqual(["ACH_FIRST_BLOOD"]);
    delete window.camelotDesktop;
  });
});
