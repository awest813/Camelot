import { describe, it, expect, beforeEach } from "vitest";
import { ModManifestSystem } from "./mod-manifest-system";

describe("ModManifestSystem", () => {
  let sys: ModManifestSystem;

  beforeEach(() => {
    sys = new ModManifestSystem();
  });

  // ── constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("starts with an empty entry list", () => {
      expect(sys.entries).toHaveLength(0);
      expect(sys.entryCount).toBe(0);
    });

    it("accepts initial entries", () => {
      const s = new ModManifestSystem({
        entries: [{ id: "mod_a", url: "./mod-a.json", enabled: true }],
      });
      expect(s.entries).toHaveLength(1);
      expect(s.entries[0].id).toBe("mod_a");
      expect(s.entries[0].url).toBe("./mod-a.json");
    });

    it("initial entries are independent copies", () => {
      const initial = [{ id: "mod_a", url: "./a.json", enabled: true }];
      const s = new ModManifestSystem({ entries: initial });
      initial[0].id = "mutated";
      expect(s.entries[0].id).toBe("mod_a");
    });
  });

  // ── addEntry ───────────────────────────────────────────────────────────────

  describe("addEntry", () => {
    it("adds an entry with provided fields", () => {
      const id = sys.addEntry({ id: "my_mod", url: "./my-mod.json" });
      expect(id).toBe("my_mod");
      expect(sys.entries).toHaveLength(1);
      expect(sys.entries[0].url).toBe("./my-mod.json");
      expect(sys.entries[0].enabled).toBe(true);
    });

    it("auto-generates id when not provided", () => {
      const id = sys.addEntry({ url: "./a.json" });
      expect(id).toMatch(/^mod_\d+$/);
      expect(sys.entries[0].id).toBe(id);
    });

    it("auto-generates id when blank", () => {
      const id = sys.addEntry({ id: "  ", url: "./a.json" });
      expect(id).toMatch(/^mod_\d+$/);
    });

    it("trims url whitespace", () => {
      sys.addEntry({ id: "m", url: "  ./mod.json  " });
      expect(sys.entries[0].url).toBe("./mod.json");
    });

    it("defaults enabled to true", () => {
      sys.addEntry({ id: "m", url: "./m.json" });
      expect(sys.entries[0].enabled).toBe(true);
    });

    it("respects explicit enabled=false", () => {
      sys.addEntry({ id: "m", url: "./m.json", enabled: false });
      expect(sys.entries[0].enabled).toBe(false);
    });

    it("multiple adds preserve order", () => {
      sys.addEntry({ id: "a", url: "./a.json" });
      sys.addEntry({ id: "b", url: "./b.json" });
      sys.addEntry({ id: "c", url: "./c.json" });
      expect(sys.entries.map(e => e.id)).toEqual(["a", "b", "c"]);
    });
  });

  // ── removeEntry ────────────────────────────────────────────────────────────

  describe("removeEntry", () => {
    it("removes an existing entry", () => {
      sys.addEntry({ id: "m", url: "./m.json" });
      const ok = sys.removeEntry("m");
      expect(ok).toBe(true);
      expect(sys.entries).toHaveLength(0);
    });

    it("returns false for unknown id", () => {
      expect(sys.removeEntry("ghost")).toBe(false);
    });

    it("removes only the targeted entry", () => {
      sys.addEntry({ id: "a", url: "./a.json" });
      sys.addEntry({ id: "b", url: "./b.json" });
      sys.removeEntry("a");
      expect(sys.entries.map(e => e.id)).toEqual(["b"]);
    });
  });

  // ── updateEntry ────────────────────────────────────────────────────────────

  describe("updateEntry", () => {
    beforeEach(() => {
      sys.addEntry({ id: "m", url: "./m.json", enabled: true });
    });

    it("updates url", () => {
      sys.updateEntry("m", { url: "./updated.json" });
      expect(sys.entries[0].url).toBe("./updated.json");
    });

    it("trims url on update", () => {
      sys.updateEntry("m", { url: "  ./trimmed.json  " });
      expect(sys.entries[0].url).toBe("./trimmed.json");
    });

    it("updates enabled flag", () => {
      sys.updateEntry("m", { enabled: false });
      expect(sys.entries[0].enabled).toBe(false);
    });

    it("returns false for unknown id", () => {
      expect(sys.updateEntry("ghost", { url: "./x.json" })).toBe(false);
    });
  });

  // ── enableEntry / disableEntry ────────────────────────────────────────────

  describe("enableEntry / disableEntry", () => {
    beforeEach(() => {
      sys.addEntry({ id: "m", url: "./m.json", enabled: false });
    });

    it("enableEntry sets enabled=true", () => {
      sys.enableEntry("m");
      expect(sys.entries[0].enabled).toBe(true);
    });

    it("disableEntry sets enabled=false", () => {
      sys.enableEntry("m");
      sys.disableEntry("m");
      expect(sys.entries[0].enabled).toBe(false);
    });

    it("enableEntry returns false for unknown id", () => {
      expect(sys.enableEntry("ghost")).toBe(false);
    });

    it("disableEntry returns false for unknown id", () => {
      expect(sys.disableEntry("ghost")).toBe(false);
    });
  });

  // ── moveEntryUp / moveEntryDown ────────────────────────────────────────────

  describe("moveEntryUp / moveEntryDown", () => {
    beforeEach(() => {
      sys.addEntry({ id: "a", url: "./a.json" });
      sys.addEntry({ id: "b", url: "./b.json" });
      sys.addEntry({ id: "c", url: "./c.json" });
    });

    it("moveEntryUp moves entry to earlier position", () => {
      sys.moveEntryUp("b");
      expect(sys.entries.map(e => e.id)).toEqual(["b", "a", "c"]);
    });

    it("moveEntryUp returns false when already first", () => {
      expect(sys.moveEntryUp("a")).toBe(false);
      expect(sys.entries.map(e => e.id)).toEqual(["a", "b", "c"]);
    });

    it("moveEntryDown moves entry to later position", () => {
      sys.moveEntryDown("b");
      expect(sys.entries.map(e => e.id)).toEqual(["a", "c", "b"]);
    });

    it("moveEntryDown returns false when already last", () => {
      expect(sys.moveEntryDown("c")).toBe(false);
      expect(sys.entries.map(e => e.id)).toEqual(["a", "b", "c"]);
    });

    it("returns false for unknown id", () => {
      expect(sys.moveEntryUp("ghost")).toBe(false);
      expect(sys.moveEntryDown("ghost")).toBe(false);
    });
  });

  // ── validate ──────────────────────────────────────────────────────────────

  describe("validate", () => {
    it("returns valid for an empty manifest", () => {
      const r = sys.validate();
      expect(r.valid).toBe(true);
      expect(r.issues).toHaveLength(0);
    });

    it("returns valid for well-formed entries", () => {
      sys.addEntry({ id: "mod_a", url: "./a.json" });
      sys.addEntry({ id: "mod_b", url: "https://cdn.example.com/b.json" });
      expect(sys.validate().valid).toBe(true);
    });

    it("detects empty id", () => {
      // Import raw JSON to bypass addEntry's auto-generation.
      sys.importFromJson('{"mods":[{"id":"","url":"./a.json"}]}');
      const r = sys.validate();
      expect(r.valid).toBe(false);
      expect(r.issues.some(i => i.type === "empty_id")).toBe(true);
    });

    it("detects duplicate ids", () => {
      sys.addEntry({ id: "dup", url: "./a.json" });
      sys.addEntry({ id: "dup", url: "./b.json" });
      const r = sys.validate();
      expect(r.valid).toBe(false);
      expect(r.issues.some(i => i.type === "duplicate_id" && i.entryId === "dup")).toBe(true);
    });

    it("detects empty url", () => {
      sys.addEntry({ id: "mod_a", url: "" });
      const r = sys.validate();
      expect(r.valid).toBe(false);
      expect(r.issues.some(i => i.type === "empty_url" && i.entryId === "mod_a")).toBe(true);
    });

    it("collects multiple issues across entries", () => {
      sys.importFromJson('{"mods":[{"id":"a","url":""},{"id":"a","url":""}]}');
      const r = sys.validate();
      expect(r.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── toManifest ────────────────────────────────────────────────────────────

  describe("toManifest", () => {
    it("returns an object with mods array", () => {
      sys.addEntry({ id: "mod_a", url: "./a.json" });
      const m = sys.toManifest();
      expect(Array.isArray(m.mods)).toBe(true);
      expect(m.mods).toHaveLength(1);
      expect(m.mods[0].id).toBe("mod_a");
      expect(m.mods[0].url).toBe("./a.json");
    });

    it("omits enabled field when true (clean output)", () => {
      sys.addEntry({ id: "m", url: "./m.json", enabled: true });
      const m = sys.toManifest();
      expect(m.mods[0].enabled).toBeUndefined();
    });

    it("includes enabled:false when entry is disabled", () => {
      sys.addEntry({ id: "m", url: "./m.json", enabled: false });
      const m = sys.toManifest();
      expect(m.mods[0].enabled).toBe(false);
    });

    it("preserves load order", () => {
      sys.addEntry({ id: "first", url: "./1.json" });
      sys.addEntry({ id: "second", url: "./2.json" });
      sys.addEntry({ id: "third", url: "./3.json" });
      const ids = sys.toManifest().mods.map(m => m.id);
      expect(ids).toEqual(["first", "second", "third"]);
    });
  });

  // ── exportToJson / importFromJson ─────────────────────────────────────────

  describe("exportToJson / importFromJson", () => {
    it("round-trips entries via JSON", () => {
      sys.addEntry({ id: "mod_a", url: "./a.json" });
      sys.addEntry({ id: "mod_b", url: "./b.json", enabled: false });
      const json = sys.exportToJson();

      const sys2 = new ModManifestSystem();
      const ok = sys2.importFromJson(json);
      expect(ok).toBe(true);
      expect(sys2.entries).toHaveLength(2);
      expect(sys2.entries[0].id).toBe("mod_a");
      expect(sys2.entries[1].id).toBe("mod_b");
      expect(sys2.entries[1].enabled).toBe(false);
    });

    it("importFromJson returns false for invalid JSON", () => {
      expect(sys.importFromJson("not json")).toBe(false);
    });

    it("importFromJson returns false when mods is not an array", () => {
      expect(sys.importFromJson('{"mods": "nope"}')).toBe(false);
    });

    it("importFromJson skips non-object entries gracefully", () => {
      const ok = sys.importFromJson('{"mods": [null, {"id":"m","url":"./m.json"}]}');
      expect(ok).toBe(true);
      // null entry is skipped; only the valid object is imported
      expect(sys.entries).toHaveLength(1);
      expect(sys.entries[0].id).toBe("m");
    });

    it("importFromJson treats missing enabled as true", () => {
      sys.importFromJson('{"mods":[{"id":"m","url":"./m.json"}]}');
      expect(sys.entries[0].enabled).toBe(true);
    });

    it("importFromJson replaces existing entries", () => {
      sys.addEntry({ id: "old", url: "./old.json" });
      sys.importFromJson('{"mods":[{"id":"new","url":"./new.json"}]}');
      expect(sys.entries).toHaveLength(1);
      expect(sys.entries[0].id).toBe("new");
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all entries", () => {
      sys.addEntry({ id: "a", url: "./a.json" });
      sys.addEntry({ id: "b", url: "./b.json" });
      sys.reset();
      expect(sys.entries).toHaveLength(0);
      expect(sys.entryCount).toBe(0);
    });

    it("allows adding entries after reset", () => {
      sys.addEntry({ id: "a", url: "./a.json" });
      sys.reset();
      const id = sys.addEntry({ url: "./b.json" });
      expect(id).toMatch(/^mod_/);
      expect(sys.entries).toHaveLength(1);
    });
  });
});
