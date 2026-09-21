import { describe, it, expect } from "vitest";
import { ArthurianNameGenerator } from "./arthurian-names";

describe("ArthurianNameGenerator — Settlement Names", () => {
  it("generates legendary capitals for type='capital'", () => {
    const cap1 = ArthurianNameGenerator.generateSettlementName(10, "capital");
    expect(["Camelot", "Caerleon", "Carlisle", "Tintagel Castle", "Carduel"]).toContain(cap1);
  });

  it("generates sacred shrine titles for type='shrine'", () => {
    const shrine = ArthurianNameGenerator.generateSettlementName(42, "shrine");
    expect(shrine).toContain("Shrine of");
  });

  it("appends Keep or Watch for castle and outpost types", () => {
    const castle = ArthurianNameGenerator.generateSettlementName(100, "castle");
    expect(castle).toContain("Keep");

    const outpost = ArthurianNameGenerator.generateSettlementName(100, "outpost");
    expect(outpost).toContain("Watch");
  });

  it("is deterministic for identical seeds", () => {
    const nameA = ArthurianNameGenerator.generateSettlementName("FixedSeed", "town");
    const nameB = ArthurianNameGenerator.generateSettlementName("FixedSeed", "town");
    expect(nameA).toBe(nameB);
  });
});

describe("ArthurianNameGenerator — Region Names", () => {
  it("incorporates biome-specific suffixes", () => {
    const tundraName = ArthurianNameGenerator.generateRegionName(50, "tundra");
    expect(
      tundraName.includes("Reach") ||
        tundraName.includes("Glacier") ||
        tundraName.includes("Peak") ||
        tundraName.includes("Frostcrag") ||
        tundraName.includes("Pass") ||
        tundraName.includes("Wastes") ||
        tundraName.includes("Fell"),
    ).toBe(true);

    const desertName = ArthurianNameGenerator.generateRegionName(50, "desert");
    expect(
      desertName.includes("Dunes") ||
        desertName.includes("Wastes") ||
        desertName.includes("Expanse") ||
        desertName.includes("Canyon") ||
        desertName.includes("Badlands") ||
        desertName.includes("Flats") ||
        desertName.includes("Redcrag"),
    ).toBe(true);
  });

  it("produces deterministic region names", () => {
    const regA = ArthurianNameGenerator.generateRegionName("AvalonRealm", "forest");
    const regB = ArthurianNameGenerator.generateRegionName("AvalonRealm", "forest");
    expect(regA).toBe(regB);
  });
});

describe("ArthurianNameGenerator — Dungeon Names", () => {
  it("generates dungeon names with legendary Arthurian figures", () => {
    const dung = ArthurianNameGenerator.generateDungeonName(999);
    expect(dung).toContain("of");
    expect(dung.length).toBeGreaterThan(5);
  });
});
