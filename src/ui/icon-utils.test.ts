import { describe, it, expect } from "vitest";
import {
  getItemIcon,
  getAttributeIcon,
  getStatIcon,
  getSpecializationIcon,
  getCraftingCategoryIcon,
  getJournalCategoryIcon,
  getGraphicsTierIcon,
  getDifficultyIcon,
} from "./icon-utils";

describe("icon-utils", () => {
  describe("getItemIcon()", () => {
    it("returns default box for undefined or null item", () => {
      expect(getItemIcon(undefined)).toBe("📦");
      expect(getItemIcon(null)).toBe("📦");
      expect(getItemIcon({})).toBe("📦");
    });

    it("respects explicit item.icon if provided", () => {
      expect(getItemIcon({ id: "custom_item", name: "Custom", icon: "✨" })).toBe("✨");
    });

    it("resolves by equipment slot", () => {
      expect(getItemIcon({ id: "item1", slot: "mainHand" })).toBe("⚔");
      expect(getItemIcon({ id: "item2", slot: "offHand" })).toBe("🛡");
      expect(getItemIcon({ id: "item3", slot: "head" })).toBe("🪖");
      expect(getItemIcon({ id: "item4", slot: "chest" })).toBe("🥋");
      expect(getItemIcon({ id: "item5", slot: "legs" })).toBe("👖");
      expect(getItemIcon({ id: "item6", slot: "feet" })).toBe("👢");
      expect(getItemIcon({ id: "item7", slot: "ring" })).toBe("💍");
      expect(getItemIcon({ id: "item8", slot: "amulet" })).toBe("💍");
    });

    it("resolves by item name or id heuristics", () => {
      expect(getItemIcon({ id: "minor_health_potion", name: "Minor Health Potion" })).toBe("🧪");
      expect(getItemIcon({ id: "spider_venom", name: "Deadly Spider Venom" })).toBe("☠");
      expect(getItemIcon({ id: "spellbook_fireball", name: "Tome of Fireball" })).toBe("📜");
      expect(getItemIcon({ id: "gold_ruby_ring", name: "Ruby Ring" })).toBe("💍");
      expect(getItemIcon({ id: "dungeon_iron_key", name: "Iron Key" })).toBe("🗝");
      expect(getItemIcon({ id: "hunting_bow", name: "Hunting Bow" })).toBe("🏹");
      expect(getItemIcon({ id: "battleaxe_iron", name: "Iron Battleaxe" })).toBe("🪓");
      expect(getItemIcon({ id: "warhammer_steel", name: "Steel Warhammer" })).toBe("🔨");
      expect(getItemIcon({ id: "mages_staff", name: "Staff of Lightning" })).toBe("🪄");
      expect(getItemIcon({ id: "iron_shield", name: "Iron Shield" })).toBe("🛡");
      expect(getItemIcon({ id: "steel_dagger", name: "Steel Dagger" })).toBe("⚔");
      expect(getItemIcon({ id: "iron_helmet", name: "Iron Helmet" })).toBe("🪖");
      expect(getItemIcon({ id: "leather_cuirass", name: "Leather Cuirass" })).toBe("🥋");
      expect(getItemIcon({ id: "cloth_pants", name: "Cloth Pants" })).toBe("👖");
      expect(getItemIcon({ id: "leather_boots", name: "Leather Boots" })).toBe("👢");
      expect(getItemIcon({ id: "gold_coin", name: "Gold Coins" })).toBe("🪙");
      expect(getItemIcon({ id: "wood_torch", name: "Torch" })).toBe("🪵");
      expect(getItemIcon({ id: "roasted_meat", name: "Roasted Meat" })).toBe("🍖");
      expect(getItemIcon({ id: "iron_ore", name: "Iron Ore" })).toBe("💎");
      expect(getItemIcon({ id: "nightshade_flower", name: "Nightshade Flower" })).toBe("🌿");
    });
  });

  describe("getAttributeIcon()", () => {
    it("returns correct icons for all primary attributes", () => {
      expect(getAttributeIcon("strength")).toBe("💪");
      expect(getAttributeIcon("endurance")).toBe("🛡");
      expect(getAttributeIcon("intelligence")).toBe("🧠");
      expect(getAttributeIcon("agility")).toBe("🏹");
      expect(getAttributeIcon("willpower")).toBe("🔮");
      expect(getAttributeIcon("speed")).toBe("⚡");
      expect(getAttributeIcon("luck")).toBe("🍀");
    });

    it("handles case insensitivity and fallback", () => {
      expect(getAttributeIcon("STRENGTH")).toBe("💪");
      expect(getAttributeIcon("unknown")).toBe("✦");
    });
  });

  describe("getStatIcon()", () => {
    it("returns correct icons for derived stats", () => {
      expect(getStatIcon("health")).toBe("❤");
      expect(getStatIcon("magicka")).toBe("✦");
      expect(getStatIcon("stamina")).toBe("⚡");
      expect(getStatIcon("carryWeight")).toBe("⚖");
      expect(getStatIcon("fame")).toBe("🌟");
      expect(getStatIcon("infamy")).toBe("💀");
      expect(getStatIcon("xp")).toBe("⭐");
    });
  });

  describe("getSpecializationIcon()", () => {
    it("returns combat, magic, and stealth icons", () => {
      expect(getSpecializationIcon("combat")).toBe("⚔");
      expect(getSpecializationIcon("magic")).toBe("✦");
      expect(getSpecializationIcon("stealth")).toBe("🌙");
      expect(getSpecializationIcon("other")).toBe("✦");
    });
  });

  describe("getCraftingCategoryIcon()", () => {
    it("returns icons for crafting categories", () => {
      expect(getCraftingCategoryIcon("all")).toBe("✦");
      expect(getCraftingCategoryIcon("weapon")).toBe("⚔");
      expect(getCraftingCategoryIcon("armor")).toBe("🛡");
      expect(getCraftingCategoryIcon("jewelry")).toBe("💍");
      expect(getCraftingCategoryIcon("misc")).toBe("📦");
    });
  });

  describe("getJournalCategoryIcon()", () => {
    it("returns icons for journal categories", () => {
      expect(getJournalCategoryIcon("all")).toBe("✦");
      expect(getJournalCategoryIcon("quest")).toBe("📜");
      expect(getJournalCategoryIcon("lore")).toBe("📖");
      expect(getJournalCategoryIcon("note")).toBe("📝");
      expect(getJournalCategoryIcon("rumor")).toBe("👂");
      expect(getJournalCategoryIcon("observation")).toBe("👁");
      expect(getJournalCategoryIcon("misc")).toBe("🗂");
      expect(getJournalCategoryIcon("favorites")).toBe("⭐");
    });
  });

  describe("getGraphicsTierIcon() & getDifficultyIcon()", () => {
    it("returns icons for graphics tiers", () => {
      expect(getGraphicsTierIcon("low")).toBe("⚡");
      expect(getGraphicsTierIcon("medium")).toBe("⚖");
      expect(getGraphicsTierIcon("high")).toBe("🌟");
      expect(getGraphicsTierIcon("ultra")).toBe("💎");
    });

    it("returns icons for difficulty levels", () => {
      expect(getDifficultyIcon("easy")).toBe("🛡");
      expect(getDifficultyIcon("normal")).toBe("⚔");
      expect(getDifficultyIcon("hard")).toBe("💀");
    });
  });
});
