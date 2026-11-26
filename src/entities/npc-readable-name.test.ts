import { describe, expect, it } from "vitest";
import { readableName } from "./npc";

describe("readableName", () => {
  it("drops serials and chunk ids, spaces joined words, keeps real names", () => {
    expect(readableName("Bandit Archer_10003")).toBe("Bandit Archer");
    expect(readableName("Villager_3_4_-2")).toBe("Villager");
    expect(readableName("RuinGuard_3_-4")).toBe("Ruin Guard");
    expect(readableName("DragonBoss_1_2")).toBe("Dragon Boss");
    expect(readableName("Captain Aldric")).toBe("Captain Aldric");
    expect(readableName("_7")).toBe("_7");
  });
});
