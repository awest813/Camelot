import { describe, it, expect } from "vitest";
import {
  getQuaterniusEntry,
  getKeysByPack,
  getKeysByCategory,
  getAnimatedKeys,
  getAllQuaterniusKeys,
  getManifest,
  getAllTags,
  getKeysByTags,
  getAllPacks,
  getManifestSize,
} from "./quaternius-asset-manifest";
import type { QuaterniusPack, AssetCategory } from "./quaternius-asset-manifest";

describe("QuaterniusAssetManifest", () => {
  // ── getManifestSize ─────────────────────────────────────────────────────────

  describe("getManifestSize", () => {
    it("returns the total number of Quaternius assets", () => {
      // 20 props + 16 nature + 10 characters + 10 monsters + 14 outfits + 12 animations = 82
      expect(getManifestSize()).toBe(82);
    });
  });

  // ── getQuaterniusEntry ──────────────────────────────────────────────────────

  describe("getQuaterniusEntry", () => {
    it("returns metadata for a known Quaternius key", () => {
      const entry = getQuaterniusEntry("qKnight");
      expect(entry).toBeDefined();
      expect(entry!.name).toBe("Knight");
      expect(entry!.pack).toBe("ultimate-rpg");
      expect(entry!.category).toBe("character");
      expect(entry!.rigged).toBe(true);
      expect(entry!.animated).toBe(true);
      expect(entry!.animationGroups).toContain("Idle");
      expect(entry!.animationGroups).toContain("Attack");
    });

    it("returns metadata for a prop key", () => {
      const entry = getQuaterniusEntry("qBarrel");
      expect(entry).toBeDefined();
      expect(entry!.name).toBe("Barrel");
      expect(entry!.pack).toBe("fantasy-props");
      expect(entry!.rigged).toBe(false);
      expect(entry!.animated).toBe(false);
      expect(entry!.animationGroups).toEqual([]);
    });

    it("returns undefined for a non-Quaternius key", () => {
      expect(getQuaterniusEntry("cottage")).toBeUndefined();
    });

    it("returns undefined for an unknown key", () => {
      expect(getQuaterniusEntry("nonExistent" as any)).toBeUndefined();
    });
  });

  // ── getKeysByPack ───────────────────────────────────────────────────────────

  describe("getKeysByPack", () => {
    it("returns all fantasy prop keys", () => {
      const keys = getKeysByPack("fantasy-props");
      expect(keys.length).toBe(20);
      expect(keys).toContain("qBarrel");
      expect(keys).toContain("qChest");
      expect(keys).toContain("qAltar");
      expect(keys).toContain("qBannerStand");
    });

    it("returns all stylized nature keys", () => {
      const keys = getKeysByPack("stylized-nature");
      expect(keys.length).toBe(16);
      expect(keys).toContain("qOakTree");
      expect(keys).toContain("qRockLarge");
      expect(keys).toContain("qMushroom");
    });

    it("returns all ultimate RPG character keys", () => {
      const keys = getKeysByPack("ultimate-rpg");
      expect(keys.length).toBe(10);
      expect(keys).toContain("qKnight");
      expect(keys).toContain("qMage");
      expect(keys).toContain("qVillagerMale");
    });

    it("returns all animated monster keys", () => {
      const keys = getKeysByPack("animated-monster");
      expect(keys.length).toBe(10);
      expect(keys).toContain("qSkeleton");
      expect(keys).toContain("qWolf");
      expect(keys).toContain("qGhost");
    });

    it("returns all modular outfit keys", () => {
      const keys = getKeysByPack("modular-outfits");
      expect(keys.length).toBe(14);
      expect(keys).toContain("qHelmetLight");
      expect(keys).toContain("qChestHeavy");
      expect(keys).toContain("qShieldTower");
    });

    it("returns all animation library keys", () => {
      const keys = getKeysByPack("animation-library");
      expect(keys.length).toBe(12);
      expect(keys).toContain("qAnimIdle");
      expect(keys).toContain("qAnimAttackMelee");
      expect(keys).toContain("qAnimSit");
    });

    it("returns empty array for unknown pack", () => {
      expect(getKeysByPack("nonexistent" as QuaterniusPack)).toEqual([]);
    });
  });

  // ── getKeysByCategory ───────────────────────────────────────────────────────

  describe("getKeysByCategory", () => {
    it("returns all character keys", () => {
      const keys = getKeysByCategory("character");
      expect(keys.length).toBe(10);
      expect(keys).toContain("qKnight");
      expect(keys).toContain("qInnkeeper");
    });

    it("returns all creature keys", () => {
      const keys = getKeysByCategory("creature");
      expect(keys.length).toBe(10);
      expect(keys).toContain("qSkeleton");
      expect(keys).toContain("qDragonSmall");
    });

    it("returns all vegetation keys", () => {
      const keys = getKeysByCategory("vegetation");
      expect(keys).toContain("qOakTree");
      expect(keys).toContain("qFern");
      expect(keys).toContain("qMushroom");
    });

    it("returns all animation keys", () => {
      const keys = getKeysByCategory("animation");
      expect(keys.length).toBe(12);
    });

    it("returns outfit head keys", () => {
      const keys = getKeysByCategory("outfit-head");
      expect(keys.length).toBe(3);
      expect(keys).toContain("qHelmetLight");
      expect(keys).toContain("qHelmetHeavy");
      expect(keys).toContain("qHelmetMage");
    });

    it("returns empty array for unknown category", () => {
      expect(getKeysByCategory("unknown" as AssetCategory)).toEqual([]);
    });
  });

  // ── getAnimatedKeys ─────────────────────────────────────────────────────────

  describe("getAnimatedKeys", () => {
    it("returns only keys with animated flag", () => {
      const keys = getAnimatedKeys();
      // 10 characters + 10 monsters + 12 animations = 32
      expect(keys.length).toBe(32);
      expect(keys).toContain("qKnight");
      expect(keys).toContain("qSkeleton");
      expect(keys).toContain("qAnimIdle");
      // Props and outfits should not be included
      expect(keys).not.toContain("qBarrel");
      expect(keys).not.toContain("qHelmetLight");
    });
  });

  // ── getAllQuaterniusKeys ─────────────────────────────────────────────────────

  describe("getAllQuaterniusKeys", () => {
    it("returns all Quaternius keys", () => {
      const keys = getAllQuaterniusKeys();
      expect(keys.length).toBe(82);
    });

    it("every key starts with 'q'", () => {
      const keys = getAllQuaterniusKeys();
      for (const key of keys) {
        expect(key.startsWith("q")).toBe(true);
      }
    });
  });

  // ── getManifest ─────────────────────────────────────────────────────────────

  describe("getManifest", () => {
    it("returns all entries with correct structure", () => {
      const manifest = getManifest();
      expect(manifest.length).toBe(82);
      for (const entry of manifest) {
        expect(entry).toHaveProperty("key");
        expect(entry).toHaveProperty("name");
        expect(entry).toHaveProperty("pack");
        expect(entry).toHaveProperty("category");
        expect(entry).toHaveProperty("tags");
        expect(entry).toHaveProperty("rigged");
        expect(entry).toHaveProperty("animated");
        expect(entry).toHaveProperty("animationGroups");
        expect(Array.isArray(entry.tags)).toBe(true);
        expect(Array.isArray(entry.animationGroups)).toBe(true);
      }
    });

    it("animated entries always have animationGroups", () => {
      const manifest = getManifest();
      for (const entry of manifest) {
        if (entry.animated) {
          expect(entry.animationGroups.length).toBeGreaterThan(0);
        }
      }
    });

    it("non-animated entries have empty animationGroups", () => {
      const manifest = getManifest();
      for (const entry of manifest) {
        if (!entry.animated) {
          expect(entry.animationGroups).toEqual([]);
        }
      }
    });
  });

  // ── getAllTags ───────────────────────────────────────────────────────────────

  describe("getAllTags", () => {
    it("returns a sorted array of distinct tags", () => {
      const tags = getAllTags();
      expect(tags.length).toBeGreaterThan(0);
      // Verify sorted
      for (let i = 1; i < tags.length; i++) {
        expect(tags[i] >= tags[i - 1]).toBe(true);
      }
      // Spot-check known tags
      expect(tags).toContain("melee");
      expect(tags).toContain("tavern");
      expect(tags).toContain("tree");
      expect(tags).toContain("undead");
    });
  });

  // ── getKeysByTags ───────────────────────────────────────────────────────────

  describe("getKeysByTags", () => {
    it("filters by a single tag", () => {
      const keys = getKeysByTags(["undead"]);
      expect(keys).toContain("qSkeleton");
      expect(keys).toContain("qGhost");
      expect(keys).not.toContain("qBarrel");
    });

    it("filters by multiple tags (AND logic)", () => {
      const keys = getKeysByTags(["melee", "armoured"]);
      expect(keys).toContain("qKnight");
      expect(keys).not.toContain("qRogue"); // light, not armoured
    });

    it("returns empty for non-existent tag", () => {
      expect(getKeysByTags(["nonexistent"])).toEqual([]);
    });
  });

  // ── getAllPacks ──────────────────────────────────────────────────────────────

  describe("getAllPacks", () => {
    it("returns all six pack identifiers", () => {
      const packs = getAllPacks();
      expect(packs.length).toBe(6);
      expect(packs).toContain("fantasy-props");
      expect(packs).toContain("stylized-nature");
      expect(packs).toContain("ultimate-rpg");
      expect(packs).toContain("animated-monster");
      expect(packs).toContain("modular-outfits");
      expect(packs).toContain("animation-library");
    });
  });
});
