import { describe, it, expect, vi, beforeEach } from "vitest";
import { EquipmentVisualSystem } from "./equipment-visual-system";
import type { EquipmentVisualSlot, OutfitSnapshot } from "./equipment-visual-system";
import type { FantasyAssetKey } from "./fantasy-asset-loader";

describe("EquipmentVisualSystem", () => {
  let system: EquipmentVisualSystem;
  let attachCalls: Array<{ characterId: string; slot: EquipmentVisualSlot; assetKey: FantasyAssetKey }>;
  let detachCalls: Array<{ characterId: string; slot: EquipmentVisualSlot }>;

  beforeEach(() => {
    system = new EquipmentVisualSystem();
    attachCalls = [];
    detachCalls = [];
    system.onOutfitAttach = (characterId, slot, assetKey) => {
      attachCalls.push({ characterId, slot, assetKey });
    };
    system.onOutfitDetach = (characterId, slot) => {
      detachCalls.push({ characterId, slot });
    };
  });

  // ── Registration ──────────────────────────────────────────────────────────

  describe("registration", () => {
    it("registers a character", () => {
      system.registerCharacter("npc_01");
      expect(system.isRegistered("npc_01")).toBe(true);
    });

    it("double registration is a no-op", () => {
      system.registerCharacter("npc_01");
      system.equip("npc_01", "head", "qHelmetLight");
      system.registerCharacter("npc_01"); // should not clear outfit
      expect(system.getEquipped("npc_01", "head")).toBe("qHelmetLight");
    });

    it("unregisters a character and fires detach for each equipped slot", () => {
      system.registerCharacter("npc_01");
      system.equip("npc_01", "head", "qHelmetLight");
      system.equip("npc_01", "chest", "qChestHeavy");
      detachCalls = [];

      system.unregisterCharacter("npc_01");
      expect(system.isRegistered("npc_01")).toBe(false);
      expect(detachCalls.length).toBe(2);
    });

    it("unregistering unknown character is a no-op", () => {
      system.unregisterCharacter("unknown");
      expect(detachCalls.length).toBe(0);
    });

    it("getRegisteredCharacters returns all IDs", () => {
      system.registerCharacter("a");
      system.registerCharacter("b");
      expect(system.getRegisteredCharacters()).toEqual(["a", "b"]);
    });
  });

  // ── Equip ─────────────────────────────────────────────────────────────────

  describe("equip", () => {
    beforeEach(() => {
      system.registerCharacter("npc_01");
    });

    it("equips an outfit piece and fires onOutfitAttach", () => {
      const result = system.equip("npc_01", "head", "qHelmetLight");
      expect(result).toBe(true);
      expect(attachCalls.length).toBe(1);
      expect(attachCalls[0]).toEqual({ characterId: "npc_01", slot: "head", assetKey: "qHelmetLight" });
      expect(system.getEquipped("npc_01", "head")).toBe("qHelmetLight");
    });

    it("re-equipping the same outfit is a no-op", () => {
      system.equip("npc_01", "head", "qHelmetLight");
      attachCalls = [];
      const result = system.equip("npc_01", "head", "qHelmetLight");
      expect(result).toBe(false);
      expect(attachCalls.length).toBe(0);
    });

    it("replacing outfit detaches old then attaches new", () => {
      system.equip("npc_01", "head", "qHelmetLight");
      attachCalls = [];
      detachCalls = [];

      system.equip("npc_01", "head", "qHelmetHeavy");
      expect(detachCalls.length).toBe(1);
      expect(detachCalls[0]).toEqual({ characterId: "npc_01", slot: "head" });
      expect(attachCalls.length).toBe(1);
      expect(attachCalls[0]).toEqual({ characterId: "npc_01", slot: "head", assetKey: "qHelmetHeavy" });
    });

    it("returns false for unregistered character", () => {
      expect(system.equip("unknown", "head", "qHelmetLight")).toBe(false);
    });

    it("can equip multiple slots independently", () => {
      system.equip("npc_01", "head", "qHelmetLight");
      system.equip("npc_01", "chest", "qChestLight");
      system.equip("npc_01", "feet", "qBootsLight");
      expect(system.getEquippedSlotCount("npc_01")).toBe(3);
    });
  });

  // ── Unequip ───────────────────────────────────────────────────────────────

  describe("unequip", () => {
    beforeEach(() => {
      system.registerCharacter("npc_01");
    });

    it("removes outfit and fires onOutfitDetach", () => {
      system.equip("npc_01", "chest", "qChestHeavy");
      detachCalls = [];

      const result = system.unequip("npc_01", "chest");
      expect(result).toBe(true);
      expect(detachCalls.length).toBe(1);
      expect(system.getEquipped("npc_01", "chest")).toBeUndefined();
    });

    it("returns false when slot is already empty", () => {
      expect(system.unequip("npc_01", "head")).toBe(false);
    });

    it("returns false for unregistered character", () => {
      expect(system.unequip("unknown", "head")).toBe(false);
    });
  });

  // ── unequipAll ────────────────────────────────────────────────────────────

  describe("unequipAll", () => {
    it("removes all equipped slots", () => {
      system.registerCharacter("npc_01");
      system.equip("npc_01", "head", "qHelmetLight");
      system.equip("npc_01", "chest", "qChestLight");
      system.equip("npc_01", "legs", "qLegsLight");
      detachCalls = [];

      system.unequipAll("npc_01");
      expect(detachCalls.length).toBe(3);
      expect(system.getEquippedSlotCount("npc_01")).toBe(0);
    });

    it("no-op for unregistered character", () => {
      system.unequipAll("unknown");
      expect(detachCalls.length).toBe(0);
    });
  });

  // ── Queries ───────────────────────────────────────────────────────────────

  describe("queries", () => {
    beforeEach(() => {
      system.registerCharacter("npc_01");
    });

    it("getOutfit returns all equipped slots", () => {
      system.equip("npc_01", "head", "qHelmetLight");
      system.equip("npc_01", "chest", "qChestHeavy");
      const outfit = system.getOutfit("npc_01");
      expect(outfit.head).toBe("qHelmetLight");
      expect(outfit.chest).toBe("qChestHeavy");
      expect(outfit.legs).toBeUndefined();
    });

    it("getOutfit returns empty object for unregistered character", () => {
      expect(system.getOutfit("unknown")).toEqual({});
    });

    it("getEquippedSlotCount returns 0 for unregistered", () => {
      expect(system.getEquippedSlotCount("unknown")).toBe(0);
    });
  });

  // ── Snapshot ──────────────────────────────────────────────────────────────

  describe("snapshot", () => {
    it("captures and restores outfit state", () => {
      system.registerCharacter("npc_01");
      system.equip("npc_01", "head", "qHelmetLight");
      system.equip("npc_01", "chest", "qChestHeavy");

      const snap = system.getSnapshot("npc_01");
      expect(snap).not.toBeNull();
      expect(snap!.characterId).toBe("npc_01");
      expect(snap!.bindings.head).toBe("qHelmetLight");
      expect(snap!.bindings.chest).toBe("qChestHeavy");
      expect(snap!.bindings.legs).toBeNull();

      // Clear and restore
      system.unequipAll("npc_01");
      attachCalls = [];
      system.restoreSnapshot(snap!);

      expect(system.getEquipped("npc_01", "head")).toBe("qHelmetLight");
      expect(system.getEquipped("npc_01", "chest")).toBe("qChestHeavy");
      expect(attachCalls.length).toBe(2);
    });

    it("getSnapshot returns null for unregistered character", () => {
      expect(system.getSnapshot("unknown")).toBeNull();
    });

    it("restoreSnapshot registers unregistered characters", () => {
      const snap: OutfitSnapshot = {
        characterId: "new_npc",
        bindings: {
          head: "qHelmetMage",
          chest: "qChestRobe",
          legs: null,
          feet: null,
          back: "qCloakLong",
          offhand: null,
        },
      };
      system.restoreSnapshot(snap);
      expect(system.isRegistered("new_npc")).toBe(true);
      expect(system.getEquipped("new_npc", "head")).toBe("qHelmetMage");
      expect(system.getEquipped("new_npc", "back")).toBe("qCloakLong");
      expect(system.getEquippedSlotCount("new_npc")).toBe(3);
    });

    it("restoreSnapshot clears existing bindings first", () => {
      system.registerCharacter("npc_01");
      system.equip("npc_01", "head", "qHelmetLight");
      system.equip("npc_01", "legs", "qLegsLight");
      detachCalls = [];

      const snap: OutfitSnapshot = {
        characterId: "npc_01",
        bindings: {
          head: "qHelmetHeavy",
          chest: null,
          legs: null,
          feet: null,
          back: null,
          offhand: null,
        },
      };
      system.restoreSnapshot(snap);

      // Should have detached head + legs
      expect(detachCalls.length).toBe(2);
      expect(system.getEquipped("npc_01", "head")).toBe("qHelmetHeavy");
      expect(system.getEquipped("npc_01", "legs")).toBeUndefined();
    });
  });

  // ── Bulk snapshot ─────────────────────────────────────────────────────────

  describe("getAllSnapshots / restoreAllSnapshots", () => {
    it("round-trips multiple characters", () => {
      system.registerCharacter("npc_01");
      system.registerCharacter("npc_02");
      system.equip("npc_01", "head", "qHelmetLight");
      system.equip("npc_02", "chest", "qChestRobe");

      const all = system.getAllSnapshots();
      expect(all.length).toBe(2);

      // Create fresh system and restore
      const system2 = new EquipmentVisualSystem();
      system2.restoreAllSnapshots(all);
      expect(system2.getEquipped("npc_01", "head")).toBe("qHelmetLight");
      expect(system2.getEquipped("npc_02", "chest")).toBe("qChestRobe");
    });
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────

  describe("callbacks", () => {
    it("works without callbacks set", () => {
      const noCallbackSystem = new EquipmentVisualSystem();
      noCallbackSystem.registerCharacter("npc_01");
      expect(() => noCallbackSystem.equip("npc_01", "head", "qHelmetLight")).not.toThrow();
      expect(() => noCallbackSystem.unequip("npc_01", "head")).not.toThrow();
    });

    it("can clear callbacks by setting null", () => {
      system.onOutfitAttach = null;
      system.onOutfitDetach = null;
      system.registerCharacter("npc_01");
      expect(() => system.equip("npc_01", "head", "qHelmetLight")).not.toThrow();
    });
  });
});
