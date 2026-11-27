import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { ACHIEVEMENTS, AchievementSystem } from "./achievement-system";
import { ACHIEVEMENT_STORAGE_KEY, GAME_VERSION } from "./constants";
import { GameEventBus } from "../systems/event-bus";
import packageJson from "../../package.json";
import { listen } from "../testing/listen";

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
    listen(system, "achievement:unlocked", (p) => ((definition) => seen.push(definition.id))(p.definition));
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
    bus.emit("spell:cast", { spellId: "kindle", spellName: "Kindle", magickaCost: 10 });
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

  it("exploring, clearing a camp and a board job each have theirs", () => {
    const system = new AchievementSystem();
    const bus = new GameEventBus();
    system.bind(bus);
    bus.emit("location:discovered", { id: "a", name: "A", known: 9 });
    expect(system.isUnlocked("ACH_WAYFARER")).toBe(false);
    bus.emit("location:discovered", { id: "b", name: "B", known: 10 });
    expect(system.isUnlocked("ACH_WAYFARER")).toBe(true);
    bus.emit("landmark:cleared", { id: "site_dragon_1_1", name: "Roost" });
    expect(system.isUnlocked("ACH_CAMP_BREAKER"), "a roost is not a camp").toBe(false);
    bus.emit("landmark:cleared", { id: "site_bandit-camp_1_1", name: "Camp" });
    expect(system.isUnlocked("ACH_CAMP_BREAKER")).toBe(true);
    bus.emit("quest:completed", { questId: "main_1", xpReward: 0 });
    expect(system.isUnlocked("ACH_SWORD_FOR_HIRE")).toBe(false);
    bus.emit("quest:completed", { questId: "job_inn_3_4", xpReward: 0 });
    expect(system.isUnlocked("ACH_SWORD_FOR_HIRE")).toBe(true);
  });

  it("unions desktop unlocks without a second toast", async () => {
    const system = new AchievementSystem();
    const toasted: string[] = [];
    listen(system, "achievement:unlocked", (p) => ((definition) => toasted.push(definition.id))(p.definition));
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
