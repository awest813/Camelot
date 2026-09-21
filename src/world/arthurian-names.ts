import { createMulberry32 } from "./simplex-terrain";
import { WorldSeed } from "./world-seed";
import type { BiomeType } from "./world-manager";

// ── Root Dictionaries ─────────────────────────────────────────────────────────

export const ARTHURIAN_PREFIXES = [
  "Caer", "Dun", "Pen", "Tor", "Tre", "Tint", "Cam", "Aber", "Bryn", "Llan",
  "Glen", "Craig", "Strath", "Car", "Inver", "Glaston", "Durn", "Pendragon",
];

export const ARTHURIAN_ROOTS = [
  "leon", "agel", "lann", "vorn", "arthur", "mor", "gwen", "gawain", "vance",
  "dorn", "bury", "galahad", "carbonek", "avalon", "mordred", "merlin", "bedivere",
];

export const ARTHURIAN_SUFFIXES = [
  "ford", "haven", "keep", "tor", "ton", "reach", "barrow", "cross", "hill",
  "mouth", "shire", "vale", "stead", "hollow", "bridge", "crag", "crest",
];

export const BIOME_LANDMARK_SUFFIXES: Record<BiomeType, string[]> = {
  plains: ["Vale", "Meadow", "Highland", "Plain", "Marches", "Downs", "Lowlands"],
  forest: ["Woods", "Deep", "Brocéliande", "Wilds", "Grove", "Thicket", "Canopy"],
  desert: ["Dunes", "Wastes", "Expanse", "Canyon", "Badlands", "Flats", "Redcrag"],
  tundra: ["Reach", "Glacier", "Peak", "Frostcrag", "Pass", "Wastes", "Fell"],
};

export const ARTHURIAN_LEGENDS = [
  "Arthur", "Guinevere", "Lancelot", "Gawain", "Galahad", "Percival",
  "Tristan", "Iseult", "Merlin", "Morgana", "Bedivere", "Kay", "Bors",
  "Ywain", "Gareth", "Geraint", "Mordred", "Nimue", "Uther", "Gorlois",
];

/**
 * Procedural Arthurian and Brythonic name generator for regions, settlements,
 * keeps, and historical landmarks.
 */
export class ArthurianNameGenerator {
  /**
   * Generates an authentic Arthurian settlement name.
   */
  public static generateSettlementName(
    seedInput: string | number,
    type: "capital" | "castle" | "town" | "shrine" | "outpost" = "town",
  ): string {
    const seed = typeof seedInput === "number" ? seedInput : WorldSeed.hashString(seedInput);
    const rng = createMulberry32(seed);

    if (type === "capital") {
      const capitals = ["Camelot", "Caerleon", "Carlisle", "Tintagel Castle", "Carduel"];
      return capitals[Math.floor(rng() * capitals.length)];
    }

    if (type === "shrine") {
      const shrineRoots = ["Avalon", "Glastonbury", "St. Jude", "Lady of the Lake", "The Grail", "Nimue's Springs"];
      return `Shrine of ${shrineRoots[Math.floor(rng() * shrineRoots.length)]}`;
    }

    const pre = ARTHURIAN_PREFIXES[Math.floor(rng() * ARTHURIAN_PREFIXES.length)];
    const root = ARTHURIAN_ROOTS[Math.floor(rng() * ARTHURIAN_ROOTS.length)];
    const suf = ARTHURIAN_SUFFIXES[Math.floor(rng() * ARTHURIAN_SUFFIXES.length)];

    let baseName = `${pre}${root}`;
    // 50% chance of compound suffix
    if (rng() > 0.5) {
      baseName = `${pre}${suf}`;
    }

    switch (type) {
      case "castle":
        return `${baseName} Keep`;
      case "outpost":
        return `${baseName} Watch`;
      default:
        return baseName;
    }
  }

  /**
   * Generates a descriptive Arthurian region name.
   */
  public static generateRegionName(
    seedInput: string | number,
    biome: BiomeType = "plains",
  ): string {
    const seed = typeof seedInput === "number" ? seedInput : WorldSeed.hashString(seedInput);
    const rng = createMulberry32(seed);

    const legend = ARTHURIAN_LEGENDS[Math.floor(rng() * ARTHURIAN_LEGENDS.length)];
    const suffixes = BIOME_LANDMARK_SUFFIXES[biome] || BIOME_LANDMARK_SUFFIXES.plains;
    const suffix = suffixes[Math.floor(rng() * suffixes.length)];

    const styles = [
      `${suffix} of ${legend}`,
      `${legend}'s ${suffix}`,
      `${ARTHURIAN_PREFIXES[Math.floor(rng() * ARTHURIAN_PREFIXES.length)]}${ARTHURIAN_ROOTS[Math.floor(rng() * ARTHURIAN_ROOTS.length)]} ${suffix}`,
    ];

    return styles[Math.floor(rng() * styles.length)];
  }

  /**
   * Generates a mysterious Arthurian dungeon, tomb, or crypt name.
   */
  public static generateDungeonName(seedInput: string | number): string {
    const seed = typeof seedInput === "number" ? seedInput : WorldSeed.hashString(seedInput);
    const rng = createMulberry32(seed);

    const legend = ARTHURIAN_LEGENDS[Math.floor(rng() * ARTHURIAN_LEGENDS.length)];
    const types = ["Catacombs", "Crypt", "Barrow", "Cavern", "Lair", "Hollow", "Ruin"];
    const type = types[Math.floor(rng() * types.length)];

    return `${type} of ${legend}`;
  }

  /**
   * Generates an authentic Celtic or Brythonic river name.
   */
  public static generateRiverName(seedInput: string | number): string {
    const seed = typeof seedInput === "number" ? seedInput : WorldSeed.hashString(seedInput);
    const rng = createMulberry32(seed);

    const riverRoots = [
      "Cam", "Severn", "Avon", "Usk", "Wye", "Dee", "Taff", "Esk",
      "Clyde", "Tweed", "Derwent", "Wharfe", "Eden", "Dart", "Tamar", "Ribble",
    ];
    const riverPrefixes = ["River", "Afon", "Water of", "Whispering"];
    const riverSuffixes = ["Bourne", "Brook", "Beck", "Stream", "River", "Run"];

    const root = riverRoots[Math.floor(rng() * riverRoots.length)];
    const roll = rng();

    if (roll < 0.4) {
      const pre = riverPrefixes[Math.floor(rng() * riverPrefixes.length)];
      return `${pre} ${root}`;
    } else if (roll < 0.7) {
      const suf = riverSuffixes[Math.floor(rng() * riverSuffixes.length)];
      return `${root} ${suf}`;
    } else {
      const legend = ARTHURIAN_LEGENDS[Math.floor(rng() * ARTHURIAN_LEGENDS.length)];
      return `${legend}'s Waters`;
    }
  }

  /**
   * Generates an atmospheric Arthurian lake, tarn, or mere name.
   */
  public static generateLakeName(seedInput: string | number): string {
    const seed = typeof seedInput === "number" ? seedInput : WorldSeed.hashString(seedInput);
    const rng = createMulberry32(seed);

    const lakeTypes = ["Mere", "Water", "Lake", "Tarn", "Pool", "Loch"];
    const type = lakeTypes[Math.floor(rng() * lakeTypes.length)];
    const roll = rng();

    if (roll < 0.5) {
      const legend = ARTHURIAN_LEGENDS[Math.floor(rng() * ARTHURIAN_LEGENDS.length)];
      return `${legend}'s ${type}`;
    } else {
      const pre = ARTHURIAN_PREFIXES[Math.floor(rng() * ARTHURIAN_PREFIXES.length)];
      const root = ARTHURIAN_ROOTS[Math.floor(rng() * ARTHURIAN_ROOTS.length)];
      return `${pre}${root} ${type}`;
    }
  }
}
