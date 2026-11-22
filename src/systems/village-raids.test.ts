import { describe, it, expect } from "vitest";
import {
  VillageRaidSystem,
  RAID_CHANCE,
  RAID_COOLDOWN_HOURS,
  RAID_NIGHT_MULTIPLIER,
  raiderCount,
} from "./village-raids";

const base = { villageId: "village_3_4", elapsedHours: 100, hourOfDay: 12, playerLevel: 5 };

describe("VillageRaidSystem", () => {
  it("rolls against the hourly chance, more often at night", () => {
    const s = new VillageRaidSystem();
    expect(s.shouldRaid({ ...base, rand: RAID_CHANCE - 0.001 })).toBe(true);
    expect(s.shouldRaid({ ...base, rand: RAID_CHANCE + 0.001 })).toBe(false);
    const nightRoll = RAID_CHANCE * RAID_NIGHT_MULTIPLIER - 0.001;
    expect(s.shouldRaid({ ...base, hourOfDay: 23, rand: nightRoll })).toBe(true);
    expect(s.shouldRaid({ ...base, hourOfDay: 14, rand: nightRoll })).toBe(false);
  });

  it("spares low-level players, fresh games, and villages raided recently", () => {
    const s = new VillageRaidSystem();
    expect(s.shouldRaid({ ...base, playerLevel: 1, rand: 0 })).toBe(false);
    expect(s.shouldRaid({ ...base, elapsedHours: 2, rand: 0 })).toBe(false);
    s.start(base.villageId, "Camcross", ["Bandit_1"], 100);
    s.onKill("Bandit_1");
    expect(s.shouldRaid({ ...base, elapsedHours: 100 + RAID_COOLDOWN_HOURS - 1, rand: 0 })).toBe(false);
    expect(s.shouldRaid({ ...base, elapsedHours: 100 + RAID_COOLDOWN_HOURS, rand: 0 })).toBe(true);
    // Another village isn't on cooldown.
    expect(s.shouldRaid({ ...base, villageId: "village_9_9", rand: 0 })).toBe(true);
  });

  it("is won when every raider is dead, and pays by raid size", () => {
    const s = new VillageRaidSystem();
    s.start("v", "Camcross", ["Bandit_1", "Bandit Archer_2", "Bandit_3"], 50);
    expect(s.shouldRaid({ ...base, villageId: "other", rand: 0 }), "one raid at a time").toBe(false);
    expect(s.onKill("Wolf_1")).toBeNull();
    expect(s.onKill("Bandit_1")).toBeNull();
    expect(s.onKill("Bandit_1"), "a kill counts once").toBeNull();
    expect(s.onKill("Bandit Archer_2")).toBeNull();
    const won = s.onKill("Bandit_3");
    expect(won).toEqual({ villageId: "v", villageName: "Camcross", total: 3, rewardGold: 105, rewardXp: 75 });
    expect(s.active).toBeNull();
  });

  it("can be abandoned, and keeps its cooldowns through a save", () => {
    const s = new VillageRaidSystem();
    s.start("v", "Camcross", ["Bandit_1"], 50);
    expect(s.abandon()?.villageName).toBe("Camcross");
    expect(s.active).toBeNull();
    expect(s.onKill("Bandit_1")).toBeNull();
    const copy = new VillageRaidSystem();
    copy.restoreFromSave(s.getSaveState());
    expect(copy.shouldRaid({ ...base, villageId: "v", elapsedHours: 60, rand: 0 })).toBe(false);
    expect(copy.shouldRaid({ ...base, villageId: "v", elapsedHours: 50 + RAID_COOLDOWN_HOURS, rand: 0 })).toBe(true);
  });

  it("sends more raiders against stronger players, within limits", () => {
    expect(raiderCount(1)).toBe(2);
    expect(raiderCount(3)).toBe(3);
    expect(raiderCount(6)).toBe(4);
    expect(raiderCount(40)).toBe(5);
  });
});
