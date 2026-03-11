import { describe, it, expect, beforeEach } from "vitest";
import {
  FactionCreatorSystem,
  DEFAULT_HOSTILE_BELOW,
  DEFAULT_FRIENDLY_AT,
  DEFAULT_ALLIED_AT,
} from "./faction-creator-system";

describe("FactionCreatorSystem", () => {
  let sys: FactionCreatorSystem;

  beforeEach(() => {
    sys = new FactionCreatorSystem();
  });

  // ── constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("starts with a blank draft using default thresholds", () => {
      expect(sys.draft.id).toBe("");
      expect(sys.draft.name).toBe("");
      expect(sys.draft.defaultReputation).toBe(0);
      expect(sys.draft.hostileBelow).toBe(DEFAULT_HOSTILE_BELOW);
      expect(sys.draft.friendlyAt).toBe(DEFAULT_FRIENDLY_AT);
      expect(sys.draft.alliedAt).toBe(DEFAULT_ALLIED_AT);
      expect(sys.relations).toHaveLength(0);
    });

    it("accepts initial values", () => {
      const s = new FactionCreatorSystem({
        id:   "guilds",
        name: "Mages Guild",
        hostileBelow: -50,
      });
      expect(s.draft.id).toBe("guilds");
      expect(s.draft.name).toBe("Mages Guild");
      expect(s.draft.hostileBelow).toBe(-50);
    });
  });

  // ── setMeta ────────────────────────────────────────────────────────────────

  describe("setMeta", () => {
    it("trims id and name", () => {
      sys.setMeta({ id: "  faction_guards  ", name: "  City Guards  " });
      expect(sys.draft.id).toBe("faction_guards");
      expect(sys.draft.name).toBe("City Guards");
    });

    it("clamps thresholds to [-100, 100]", () => {
      sys.setMeta({ hostileBelow: -200, friendlyAt: 999, alliedAt: -999 });
      expect(sys.draft.hostileBelow).toBe(-100);
      expect(sys.draft.friendlyAt).toBe(100);
      expect(sys.draft.alliedAt).toBe(-100);
    });

    it("rounds thresholds to integers", () => {
      sys.setMeta({ hostileBelow: -24.7, friendlyAt: 24.4 });
      expect(sys.draft.hostileBelow).toBe(-25);
      expect(sys.draft.friendlyAt).toBe(24);
    });

    it("partial update leaves other fields unchanged", () => {
      sys.setMeta({ id: "f1", name: "Name" });
      sys.setMeta({ alliedAt: 80 });
      expect(sys.draft.id).toBe("f1");
      expect(sys.draft.alliedAt).toBe(80);
    });
  });

  // ── addRelation ────────────────────────────────────────────────────────────

  describe("addRelation", () => {
    it("adds a relation with defaults", () => {
      const targetId = sys.addRelation();
      expect(sys.relations).toHaveLength(1);
      expect(sys.relations[0].targetId).toBe(targetId);
      expect(sys.relations[0].disposition).toBe("neutral");
    });

    it("uses provided targetId", () => {
      const id = sys.addRelation({ targetId: "thieves_guild", disposition: "hostile" });
      expect(id).toBe("thieves_guild");
      expect(sys.relations[0].disposition).toBe("hostile");
    });

    it("auto-generates unique targetIds when none supplied", () => {
      const a = sys.addRelation();
      const b = sys.addRelation();
      expect(a).not.toBe(b);
    });
  });

  // ── updateRelation ─────────────────────────────────────────────────────────

  describe("updateRelation", () => {
    it("updates disposition and note", () => {
      sys.addRelation({ targetId: "imperials" });
      const ok = sys.updateRelation("imperials", { disposition: "friendly", note: "Trade allies" });
      expect(ok).toBe(true);
      expect(sys.relations[0].disposition).toBe("friendly");
      expect(sys.relations[0].note).toBe("Trade allies");
    });

    it("returns false for unknown targetId", () => {
      expect(sys.updateRelation("no_such_faction", { disposition: "hostile" })).toBe(false);
    });
  });

  // ── removeRelation ─────────────────────────────────────────────────────────

  describe("removeRelation", () => {
    it("removes the relation", () => {
      sys.addRelation({ targetId: "bandits" });
      expect(sys.removeRelation("bandits")).toBe(true);
      expect(sys.relations).toHaveLength(0);
    });

    it("returns false for unknown targetId", () => {
      expect(sys.removeRelation("no_such")).toBe(false);
    });
  });

  // ── validate ──────────────────────────────────────────────────────────────

  describe("validate", () => {
    it("reports missing id and name", () => {
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues).toContain("Faction ID is required.");
      expect(report.issues).toContain("Faction name is required.");
    });

    it("passes when id, name, and thresholds are valid", () => {
      sys.setMeta({
        id:           "city_guards",
        name:         "City Guards",
        hostileBelow: -25,
        friendlyAt:   25,
        alliedAt:     60,
      });
      expect(sys.validate().valid).toBe(true);
    });

    it("reports threshold ordering violation: hostileBelow >= friendlyAt", () => {
      sys.setMeta({ id: "f", name: "F", hostileBelow: 30, friendlyAt: 25, alliedAt: 60 });
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("hostileBelow"))).toBe(true);
    });

    it("reports threshold ordering violation: friendlyAt >= alliedAt", () => {
      sys.setMeta({ id: "f", name: "F", hostileBelow: -30, friendlyAt: 70, alliedAt: 60 });
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("friendlyAt"))).toBe(true);
    });

    it("reports duplicate relation targets", () => {
      sys.setMeta({ id: "f", name: "F" });
      sys.addRelation({ targetId: "other" });
      sys.addRelation({ targetId: "other" });
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("Duplicate relation"))).toBe(true);
    });

    it("reports self-referential relation", () => {
      sys.setMeta({ id: "f", name: "F" });
      sys.addRelation({ targetId: "f" });
      const report = sys.validate();
      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.includes("itself"))).toBe(true);
    });
  });

  // ── toDefinition ──────────────────────────────────────────────────────────

  describe("toDefinition", () => {
    it("produces a FactionDefinition with correct fields", () => {
      sys.setMeta({
        id:                "mages_guild",
        name:              "Mages Guild",
        description:       "Scholars of the arcane",
        defaultReputation: 10,
        hostileBelow:      -30,
        friendlyAt:        20,
        alliedAt:          70,
      });
      const def = sys.toDefinition();
      expect(def.id).toBe("mages_guild");
      expect(def.name).toBe("Mages Guild");
      expect(def.description).toBe("Scholars of the arcane");
      expect(def.defaultReputation).toBe(10);
      expect(def.hostileBelow).toBe(-30);
      expect(def.friendlyAt).toBe(20);
      expect(def.alliedAt).toBe(70);
    });

    it("omits empty description from output", () => {
      sys.setMeta({ id: "f", name: "F", description: "" });
      expect(sys.toDefinition().description).toBeUndefined();
    });
  });

  // ── export / import round-trip ─────────────────────────────────────────────

  describe("exportToJson / importFromJson", () => {
    it("round-trips metadata faithfully", () => {
      sys.setMeta({
        id:           "city_guards",
        name:         "City Guards",
        description:  "Protectors of the realm",
        hostileBelow: -30,
        friendlyAt:   15,
        alliedAt:     55,
      });
      sys.addRelation({ targetId: "bandits", disposition: "hostile", note: "At war" });

      const json = sys.exportToJson();
      const other = new FactionCreatorSystem();
      expect(other.importFromJson(json)).toBe(true);

      expect(other.draft.id).toBe("city_guards");
      expect(other.draft.name).toBe("City Guards");
      expect(other.draft.hostileBelow).toBe(-30);
      expect(other.relations).toHaveLength(1);
      expect(other.relations[0].targetId).toBe("bandits");
      expect(other.relations[0].disposition).toBe("hostile");
    });

    it("returns false for malformed JSON", () => {
      expect(sys.importFromJson("not json")).toBe(false);
    });

    it("returns false when id field is absent", () => {
      expect(sys.importFromJson('{"name":"No ID"}')).toBe(false);
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("restores the blank draft", () => {
      sys.setMeta({ id: "f1", name: "Faction 1" });
      sys.addRelation({ targetId: "other" });
      sys.reset();
      expect(sys.draft.id).toBe("");
      expect(sys.relations).toHaveLength(0);
      expect(sys.draft.hostileBelow).toBe(DEFAULT_HOSTILE_BELOW);
    });
  });
});
