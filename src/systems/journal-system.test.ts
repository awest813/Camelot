import { describe, it, expect, vi, beforeEach } from "vitest";
import { JournalSystem } from "./journal-system";
import type { JournalEntry, JournalSnapshot } from "./journal-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

let clock = 1_000_000;
const advanceClock = (ms: number) => { clock += ms; };

const makeEntry = (overrides: Partial<Omit<JournalEntry, "createdAt" | "updatedAt" | "favorite">> = {}) => ({
  id: overrides.id ?? "entry_1",
  title: overrides.title ?? "A Found Note",
  body: overrides.body ?? "The note speaks of ancient secrets.",
  category: overrides.category ?? ("lore" as const),
  tags: overrides.tags ?? ["ancient", "secrets"],
  summary: overrides.summary,
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("JournalSystem", () => {
  let sys: JournalSystem;

  beforeEach(() => {
    clock = 1_000_000;
    sys = new JournalSystem(() => clock);
  });

  // ── addEntry ──────────────────────────────────────────────────────────────

  describe("addEntry", () => {
    it("adds a valid entry", () => {
      const e = sys.addEntry(makeEntry());
      expect(e.id).toBe("entry_1");
      expect(e.title).toBe("A Found Note");
      expect(e.favorite).toBe(false);
    });

    it("sets createdAt and updatedAt to current time", () => {
      const e = sys.addEntry(makeEntry());
      expect(e.createdAt).toBe(1_000_000);
      expect(e.updatedAt).toBe(1_000_000);
    });

    it("normalises tags to lower-case", () => {
      const e = sys.addEntry(makeEntry({ tags: ["Ancient", "SECRETS", "Lore"] }));
      expect(e.tags).toEqual(["ancient", "secrets", "lore"]);
    });

    it("trims and filters empty tags", () => {
      const e = sys.addEntry(makeEntry({ tags: ["  good ", "", "  "] }));
      expect(e.tags).toEqual(["good"]);
    });

    it("defaults favorite to false", () => {
      const e = sys.addEntry(makeEntry());
      expect(e.favorite).toBe(false);
    });

    it("honours explicit favorite=true", () => {
      const e = sys.addEntry({ ...makeEntry(), favorite: true });
      expect(e.favorite).toBe(true);
    });

    it("throws on empty id", () => {
      expect(() => sys.addEntry({ ...makeEntry(), id: "" })).toThrow();
      expect(() => sys.addEntry({ ...makeEntry(), id: "   " })).toThrow();
    });

    it("throws on duplicate id", () => {
      sys.addEntry(makeEntry());
      expect(() => sys.addEntry(makeEntry())).toThrow();
    });

    it("throws on empty title", () => {
      expect(() => sys.addEntry({ ...makeEntry(), title: "" })).toThrow();
    });

    it("throws on empty body", () => {
      expect(() => sys.addEntry({ ...makeEntry(), body: "" })).toThrow();
    });

    it("returns a copy — mutation does not affect stored entry", () => {
      const e = sys.addEntry(makeEntry());
      e.title = "Mutated";
      expect(sys.getEntry("entry_1")!.title).toBe("A Found Note");
    });

    it("increments entryCount", () => {
      sys.addEntry(makeEntry({ id: "a" }));
      sys.addEntry(makeEntry({ id: "b" }));
      expect(sys.entryCount).toBe(2);
    });
  });

  // ── updateEntry ───────────────────────────────────────────────────────────

  describe("updateEntry", () => {
    beforeEach(() => {
      sys.addEntry(makeEntry());
    });

    it("updates the title", () => {
      sys.updateEntry("entry_1", { title: "Updated Title" });
      expect(sys.getEntry("entry_1")!.title).toBe("Updated Title");
    });

    it("updates updatedAt but preserves createdAt", () => {
      advanceClock(500);
      sys.updateEntry("entry_1", { title: "New Title" });
      const e = sys.getEntry("entry_1")!;
      expect(e.createdAt).toBe(1_000_000);
      expect(e.updatedAt).toBe(1_000_500);
    });

    it("normalises updated tags", () => {
      sys.updateEntry("entry_1", { tags: ["NEW_TAG", "another"] });
      expect(sys.getEntry("entry_1")!.tags).toEqual(["new_tag", "another"]);
    });

    it("throws for unknown id", () => {
      expect(() => sys.updateEntry("nonexistent", { title: "x" })).toThrow();
    });

    it("throws on empty title update", () => {
      expect(() => sys.updateEntry("entry_1", { title: "" })).toThrow();
    });

    it("throws on empty body update", () => {
      expect(() => sys.updateEntry("entry_1", { body: "" })).toThrow();
    });

    it("allows partial update (only supplied fields change)", () => {
      sys.updateEntry("entry_1", { body: "New body text." });
      const e = sys.getEntry("entry_1")!;
      expect(e.title).toBe("A Found Note");
      expect(e.body).toBe("New body text.");
    });
  });

  // ── removeEntry ───────────────────────────────────────────────────────────

  describe("removeEntry", () => {
    it("removes an existing entry and returns true", () => {
      sys.addEntry(makeEntry());
      expect(sys.removeEntry("entry_1")).toBe(true);
      expect(sys.getEntry("entry_1")).toBeUndefined();
      expect(sys.entryCount).toBe(0);
    });

    it("returns false for an unknown id", () => {
      expect(sys.removeEntry("nonexistent")).toBe(false);
    });
  });

  // ── getEntry ──────────────────────────────────────────────────────────────

  describe("getEntry", () => {
    it("returns undefined for unknown id", () => {
      expect(sys.getEntry("unknown")).toBeUndefined();
    });

    it("returns a copy — external mutation does not affect store", () => {
      sys.addEntry(makeEntry());
      const e = sys.getEntry("entry_1")!;
      e.tags.push("injected");
      expect(sys.getEntry("entry_1")!.tags).not.toContain("injected");
    });
  });

  // ── toggleFavorite ────────────────────────────────────────────────────────

  describe("toggleFavorite", () => {
    it("toggles to true on first call", () => {
      sys.addEntry(makeEntry());
      expect(sys.toggleFavorite("entry_1")).toBe(true);
      expect(sys.getEntry("entry_1")!.favorite).toBe(true);
    });

    it("toggles back to false on second call", () => {
      sys.addEntry(makeEntry());
      sys.toggleFavorite("entry_1");
      expect(sys.toggleFavorite("entry_1")).toBe(false);
    });

    it("throws for unknown id", () => {
      expect(() => sys.toggleFavorite("nonexistent")).toThrow();
    });

    it("updates updatedAt", () => {
      sys.addEntry(makeEntry());
      advanceClock(200);
      sys.toggleFavorite("entry_1");
      expect(sys.getEntry("entry_1")!.updatedAt).toBe(1_000_200);
    });
  });

  // ── getFavorites ──────────────────────────────────────────────────────────

  describe("getFavorites", () => {
    it("returns only favorited entries", () => {
      sys.addEntry(makeEntry({ id: "a" }));
      sys.addEntry(makeEntry({ id: "b" }));
      sys.toggleFavorite("a");
      const favs = sys.getFavorites();
      expect(favs).toHaveLength(1);
      expect(favs[0].id).toBe("a");
    });

    it("returns empty array when no favorites", () => {
      sys.addEntry(makeEntry());
      expect(sys.getFavorites()).toHaveLength(0);
    });

    it("sorts by updatedAt descending", () => {
      sys.addEntry(makeEntry({ id: "a" }));
      sys.addEntry(makeEntry({ id: "b" }));
      sys.toggleFavorite("a");
      advanceClock(100);
      sys.toggleFavorite("b");
      // b was toggled later so has a newer updatedAt
      const favs = sys.getFavorites();
      expect(favs[0].id).toBe("b");
    });
  });

  // ── getByCategory ─────────────────────────────────────────────────────────

  describe("getByCategory", () => {
    it("returns entries with the given category", () => {
      sys.addEntry(makeEntry({ id: "lore1", category: "lore" }));
      sys.addEntry(makeEntry({ id: "quest1", category: "quest" }));
      sys.addEntry(makeEntry({ id: "lore2", category: "lore" }));
      const loreEntries = sys.getByCategory("lore");
      expect(loreEntries).toHaveLength(2);
      expect(loreEntries.every((e) => e.category === "lore")).toBe(true);
    });

    it("returns empty array when no entries in category", () => {
      sys.addEntry(makeEntry({ id: "note1", category: "note" }));
      expect(sys.getByCategory("rumor")).toHaveLength(0);
    });

    it("sorts by updatedAt descending", () => {
      sys.addEntry(makeEntry({ id: "old", category: "lore" }));
      advanceClock(500);
      sys.addEntry(makeEntry({ id: "new", category: "lore" }));
      const results = sys.getByCategory("lore");
      expect(results[0].id).toBe("new");
    });
  });

  // ── getByTags ─────────────────────────────────────────────────────────────

  describe("getByTags", () => {
    beforeEach(() => {
      sys.addEntry(makeEntry({ id: "a", tags: ["ancient", "ruin"] }));
      sys.addEntry(makeEntry({ id: "b", tags: ["ancient", "magic"] }));
      sys.addEntry(makeEntry({ id: "c", tags: ["ruin", "magic"] }));
    });

    it("returns entries with ALL specified tags", () => {
      const results = sys.getByTags(["ancient"]);
      expect(results.map((e) => e.id).sort()).toEqual(["a", "b"]);
    });

    it("matches case-insensitively", () => {
      const results = sys.getByTags(["ANCIENT"]);
      expect(results).toHaveLength(2);
    });

    it("returns all entries for empty tags array", () => {
      expect(sys.getByTags([])).toHaveLength(3);
    });

    it("returns entries matching all tags (AND logic)", () => {
      const results = sys.getByTags(["ancient", "magic"]);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("b");
    });

    it("returns empty array when no entries match all tags", () => {
      const results = sys.getByTags(["ancient", "ruin", "magic"]);
      expect(results).toHaveLength(0);
    });
  });

  // ── search ────────────────────────────────────────────────────────────────

  describe("search", () => {
    beforeEach(() => {
      sys.addEntry({ id: "a", title: "Dragon Shout Discovery", body: "Found a Word Wall.", category: "quest", tags: [] });
      advanceClock(100);
      sys.addEntry({ id: "b", title: "Old Note", body: "The dragon lurks in the east.", category: "lore", tags: [] });
      advanceClock(100);
      sys.addEntry({ id: "c", title: "Alchemy Recipe", body: "Mix nirnroot with...", category: "note", tags: [], summary: "Potion of dragon power" });
    });

    it("returns all entries for empty query", () => {
      expect(sys.search("")).toHaveLength(3);
    });

    it("matches title case-insensitively", () => {
      const results = sys.search("dragon shout");
      expect(results[0].id).toBe("a");
    });

    it("matches body case-insensitively", () => {
      const results = sys.search("word wall");
      expect(results.map((e) => e.id)).toContain("a");
    });

    it("matches summary field", () => {
      const results = sys.search("potion");
      expect(results.map((e) => e.id)).toContain("c");
    });

    it("title matches are ranked before body matches", () => {
      // "dragon" appears in title of "a" and body of "b" and summary of "c"
      const results = sys.search("dragon");
      expect(results[0].id).toBe("a");
    });

    it("returns empty array when nothing matches", () => {
      expect(sys.search("xyzzy_no_match")).toHaveLength(0);
    });

    it("returns all entries when query is only whitespace", () => {
      expect(sys.search("   ")).toHaveLength(3);
    });
  });

  // ── getAllEntries ─────────────────────────────────────────────────────────

  describe("getAllEntries", () => {
    it("returns all entries sorted by updatedAt descending", () => {
      sys.addEntry(makeEntry({ id: "first" }));
      advanceClock(100);
      sys.addEntry(makeEntry({ id: "second" }));
      const all = sys.getAllEntries();
      expect(all[0].id).toBe("second");
      expect(all[1].id).toBe("first");
    });

    it("returns empty array when no entries", () => {
      expect(sys.getAllEntries()).toHaveLength(0);
    });
  });

  // ── getAllTags ────────────────────────────────────────────────────────────

  describe("getAllTags", () => {
    it("returns all distinct tags sorted alphabetically", () => {
      sys.addEntry(makeEntry({ id: "a", tags: ["ruins", "ancient"] }));
      sys.addEntry(makeEntry({ id: "b", tags: ["magic", "ancient"] }));
      expect(sys.getAllTags()).toEqual(["ancient", "magic", "ruins"]);
    });

    it("returns empty array when no entries", () => {
      expect(sys.getAllTags()).toEqual([]);
    });

    it("returns empty array when no entry has tags", () => {
      sys.addEntry(makeEntry({ id: "a", tags: [] }));
      expect(sys.getAllTags()).toEqual([]);
    });
  });

  // ── snapshot / restore ────────────────────────────────────────────────────

  describe("getSnapshot / restoreSnapshot", () => {
    it("snapshot captures all entry data", () => {
      sys.addEntry(makeEntry({ id: "a", tags: ["ancient"] }));
      sys.toggleFavorite("a");
      const snap = sys.getSnapshot();
      expect(snap.entries).toHaveLength(1);
      const s = snap.entries[0];
      expect(s.id).toBe("a");
      expect(s.favorite).toBe(true);
      expect(s.tags).toEqual(["ancient"]);
    });

    it("restores entries accurately", () => {
      sys.addEntry(makeEntry({ id: "a" }));
      const snap = sys.getSnapshot();
      const sys2 = new JournalSystem(() => clock);
      sys2.restoreSnapshot(snap);
      expect(sys2.entryCount).toBe(1);
      expect(sys2.getEntry("a")!.title).toBe("A Found Note");
    });

    it("replaces existing entries on restore", () => {
      sys.addEntry(makeEntry({ id: "old" }));
      const snap: JournalSnapshot = {
        entries: [
          {
            id: "new",
            title: "New Entry",
            body: "Body text.",
            category: "misc",
            tags: [],
            createdAt: 1000,
            updatedAt: 1000,
            favorite: false,
          },
        ],
      };
      sys.restoreSnapshot(snap);
      expect(sys.entryCount).toBe(1);
      expect(sys.getEntry("old")).toBeUndefined();
      expect(sys.getEntry("new")).toBeDefined();
    });

    it("skips malformed entries (missing required fields)", () => {
      const snap: JournalSnapshot = {
        entries: [
          { id: "", title: "Bad", body: "Body", category: "misc", tags: [], createdAt: 0, updatedAt: 0, favorite: false },
          { id: "ok", title: "Good", body: "Body", category: "lore", tags: ["tag"], createdAt: 100, updatedAt: 200, favorite: true },
        ] as any,
      };
      sys.restoreSnapshot(snap);
      expect(sys.entryCount).toBe(1);
      expect(sys.getEntry("ok")!.favorite).toBe(true);
    });

    it("handles empty or null snapshot gracefully", () => {
      sys.addEntry(makeEntry());
      sys.restoreSnapshot({ entries: [] });
      expect(sys.entryCount).toBe(0);
    });

    it("round-trip snapshot preserves all fields", () => {
      sys.addEntry({
        id: "rt",
        title: "Round Trip",
        body: "Check all fields.",
        category: "quest",
        tags: ["cyrodiil", "main"],
        summary: "A brief summary.",
        favorite: true,
      });
      const snap = sys.getSnapshot();
      const sys2 = new JournalSystem(() => clock);
      sys2.restoreSnapshot(snap);
      const e = sys2.getEntry("rt")!;
      expect(e.title).toBe("Round Trip");
      expect(e.body).toBe("Check all fields.");
      expect(e.category).toBe("quest");
      expect(e.tags).toEqual(["cyrodiil", "main"]);
      expect(e.summary).toBe("A brief summary.");
      expect(e.favorite).toBe(true);
    });
  });
});
