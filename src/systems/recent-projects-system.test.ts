// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RecentProjectsSystem,
  MAX_RECENT_PROJECTS,
  STORAGE_KEY,
  type RecentProjectEntry,
} from "./recent-projects-system";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSystem(): RecentProjectsSystem {
  return new RecentProjectsSystem();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RecentProjectsSystem", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("starts with an empty list", () => {
      const sys = makeSystem();
      expect(sys.getProjects()).toEqual([]);
      expect(sys.count).toBe(0);
    });
  });

  // ── addProject ────────────────────────────────────────────────────────────

  describe("addProject()", () => {
    it("adds a project and returns the entry", () => {
      const sys = makeSystem();
      const entry = sys.addProject({ name: "My Mod" });
      expect(entry.name).toBe("My Mod");
      expect(entry.id).toBeTruthy();
      expect(entry.lastOpenedAt).toBeTruthy();
    });

    it("prepends newest entries", () => {
      const sys = makeSystem();
      sys.addProject({ name: "First" });
      sys.addProject({ name: "Second" });
      const projects = sys.getProjects();
      expect(projects[0].name).toBe("Second");
      expect(projects[1].name).toBe("First");
    });

    it("stores filePath when provided", () => {
      const sys = makeSystem();
      const entry = sys.addProject({ name: "Mod", filePath: "/home/user/mod.json" });
      expect(entry.filePath).toBe("/home/user/mod.json");
    });

    it("stores thumbnail when provided", () => {
      const sys = makeSystem();
      const entry = sys.addProject({ name: "Mod", thumbnail: "data:image/png;base64,abc" });
      expect(entry.thumbnail).toBe("data:image/png;base64,abc");
    });

    it("de-duplicates by filePath and moves to front", () => {
      const sys = makeSystem();
      sys.addProject({ name: "Old Name", filePath: "/a/b.json" });
      sys.addProject({ name: "Other" });
      const touched = sys.addProject({ name: "New Name", filePath: "/a/b.json" });
      expect(sys.count).toBe(2);
      expect(sys.getProjects()[0].name).toBe("New Name");
      expect(touched.name).toBe("New Name");
    });

    it("de-duplicate refreshes lastOpenedAt", () => {
      const sys = makeSystem();
      const first = sys.addProject({ name: "A", filePath: "/x" });
      const firstTime = first.lastOpenedAt;
      // Tiny delay so timestamp differs
      const touched = sys.addProject({ name: "A", filePath: "/x" });
      expect(touched.lastOpenedAt).toBeTruthy();
      // ID stays the same
      expect(touched.id).toBe(first.id);
    });

    it("de-duplicate updates thumbnail if provided", () => {
      const sys = makeSystem();
      sys.addProject({ name: "A", filePath: "/x", thumbnail: "old" });
      sys.addProject({ name: "A", filePath: "/x", thumbnail: "new" });
      expect(sys.getProjects()[0].thumbnail).toBe("new");
    });

    it("evicts oldest entries when exceeding MAX_RECENT_PROJECTS", () => {
      const sys = makeSystem();
      for (let i = 0; i < MAX_RECENT_PROJECTS + 3; i++) {
        sys.addProject({ name: `Project ${i}` });
      }
      expect(sys.count).toBe(MAX_RECENT_PROJECTS);
      // The newest should be at index 0
      expect(sys.getProjects()[0].name).toBe(`Project ${MAX_RECENT_PROJECTS + 2}`);
    });

    it("fires onChanged after adding", () => {
      const sys = makeSystem();
      const cb = vi.fn();
      sys.onChanged = cb;
      sys.addProject({ name: "X" });
      expect(cb).toHaveBeenCalledOnce();
    });

    it("persists to localStorage on add", () => {
      const sys = makeSystem();
      sys.addProject({ name: "Persisted" });
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Persisted");
    });
  });

  // ── getProject ────────────────────────────────────────────────────────────

  describe("getProject()", () => {
    it("returns the project by ID", () => {
      const sys = makeSystem();
      const entry = sys.addProject({ name: "Find Me" });
      expect(sys.getProject(entry.id)).toBeDefined();
      expect(sys.getProject(entry.id)!.name).toBe("Find Me");
    });

    it("returns undefined for unknown ID", () => {
      const sys = makeSystem();
      expect(sys.getProject("unknown")).toBeUndefined();
    });
  });

  // ── removeProject ─────────────────────────────────────────────────────────

  describe("removeProject()", () => {
    it("removes a project by ID and returns true", () => {
      const sys = makeSystem();
      const entry = sys.addProject({ name: "Gone" });
      expect(sys.removeProject(entry.id)).toBe(true);
      expect(sys.count).toBe(0);
    });

    it("returns false for unknown ID", () => {
      const sys = makeSystem();
      expect(sys.removeProject("nope")).toBe(false);
    });

    it("fires onChanged after removing", () => {
      const sys = makeSystem();
      const entry = sys.addProject({ name: "X" });
      const cb = vi.fn();
      sys.onChanged = cb;
      sys.removeProject(entry.id);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("persists removal to localStorage", () => {
      const sys = makeSystem();
      const entry = sys.addProject({ name: "Bye" });
      sys.removeProject(entry.id);
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(parsed).toHaveLength(0);
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────────

  describe("clear()", () => {
    it("empties the list", () => {
      const sys = makeSystem();
      sys.addProject({ name: "A" });
      sys.addProject({ name: "B" });
      sys.clear();
      expect(sys.count).toBe(0);
      expect(sys.getProjects()).toEqual([]);
    });

    it("fires onChanged when list was non-empty", () => {
      const sys = makeSystem();
      sys.addProject({ name: "A" });
      const cb = vi.fn();
      sys.onChanged = cb;
      sys.clear();
      expect(cb).toHaveBeenCalledOnce();
    });

    it("does not fire onChanged when list was already empty", () => {
      const sys = makeSystem();
      const cb = vi.fn();
      sys.onChanged = cb;
      sys.clear();
      expect(cb).not.toHaveBeenCalled();
    });

    it("persists clear to localStorage", () => {
      const sys = makeSystem();
      sys.addProject({ name: "A" });
      sys.clear();
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(parsed).toHaveLength(0);
    });
  });

  // ── restore ───────────────────────────────────────────────────────────────

  describe("restore()", () => {
    it("restores projects from localStorage", () => {
      const sys = makeSystem();
      sys.addProject({ name: "Saved" });
      const sys2 = makeSystem();
      sys2.restore();
      expect(sys2.count).toBe(1);
      expect(sys2.getProjects()[0].name).toBe("Saved");
    });

    it("silently no-ops when storage key is absent", () => {
      const sys = makeSystem();
      sys.restore();
      expect(sys.count).toBe(0);
    });

    it("silently no-ops on malformed JSON", () => {
      localStorage.setItem(STORAGE_KEY, "NOT JSON");
      const sys = makeSystem();
      sys.restore();
      expect(sys.count).toBe(0);
    });

    it("silently no-ops when stored value is not an array", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
      const sys = makeSystem();
      sys.restore();
      expect(sys.count).toBe(0);
    });

    it("filters out malformed entries", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { id: "ok", name: "Good", lastOpenedAt: "2025-01-01T00:00:00Z" },
          { id: 123, name: "Bad ID" }, // missing lastOpenedAt, bad id type
          null,
          "garbage",
        ]),
      );
      const sys = makeSystem();
      sys.restore();
      expect(sys.count).toBe(1);
      expect(sys.getProjects()[0].name).toBe("Good");
    });
  });

  // ── getSnapshot / restoreSnapshot ─────────────────────────────────────────

  describe("getSnapshot / restoreSnapshot", () => {
    it("round-trips state through snapshot", () => {
      const sys = makeSystem();
      sys.addProject({ name: "A", filePath: "/a" });
      sys.addProject({ name: "B" });
      const snap = sys.getSnapshot();

      const sys2 = makeSystem();
      sys2.restoreSnapshot(snap);
      expect(sys2.count).toBe(2);
      expect(sys2.getProjects()[0].name).toBe("B");
      expect(sys2.getProjects()[1].name).toBe("A");
    });

    it("snapshot is a deep copy — mutating it does not affect original", () => {
      const sys = makeSystem();
      sys.addProject({ name: "Orig" });
      const snap = sys.getSnapshot();
      snap[0].name = "Mutated";
      expect(sys.getProjects()[0].name).toBe("Orig");
    });

    it("restoreSnapshot is a deep copy — mutating source does not affect system", () => {
      const entries: RecentProjectEntry[] = [
        { id: "x", name: "X", lastOpenedAt: "2025-01-01T00:00:00Z" },
      ];
      const sys = makeSystem();
      sys.restoreSnapshot(entries);
      entries[0].name = "Mutated";
      expect(sys.getProjects()[0].name).toBe("X");
    });
  });

  // ── MAX_RECENT_PROJECTS constant ──────────────────────────────────────────

  describe("MAX_RECENT_PROJECTS", () => {
    it("is 10", () => {
      expect(MAX_RECENT_PROJECTS).toBe(10);
    });
  });

  // ── STORAGE_KEY constant ──────────────────────────────────────────────────

  describe("STORAGE_KEY", () => {
    it("equals camelot_recent_projects", () => {
      expect(STORAGE_KEY).toBe("camelot_recent_projects");
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("addProject without filePath does not de-duplicate", () => {
      const sys = makeSystem();
      sys.addProject({ name: "A" });
      sys.addProject({ name: "A" });
      expect(sys.count).toBe(2);
    });

    it("removeProject does not fire onChanged for unknown id", () => {
      const sys = makeSystem();
      const cb = vi.fn();
      sys.onChanged = cb;
      sys.removeProject("nonexistent");
      expect(cb).not.toHaveBeenCalled();
    });

    it("addProject with empty name still works", () => {
      const sys = makeSystem();
      const entry = sys.addProject({ name: "" });
      expect(entry.name).toBe("");
      expect(sys.count).toBe(1);
    });
  });
});
