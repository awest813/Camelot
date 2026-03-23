// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { JournalUI, formatEntryDate } from "./journal-ui";
import { JournalSystem } from "../systems/journal-system";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSystem(): JournalSystem {
  return new JournalSystem(() => 1_000_000);
}

function seedEntries(sys: JournalSystem): void {
  sys.addEntry({ id: "q1", title: "Main Quest Start", body: "You have begun the main quest.", category: "quest", tags: ["main", "story"] });
  sys.addEntry({ id: "l1", title: "Myth of the Ancients", body: "Legends speak of a lost city.", category: "lore", tags: ["history"] });
  sys.addEntry({ id: "n1", title: "Merchant tip", body: "The merchant sells potions cheaply.", category: "note", tags: [] });
}

// ── formatEntryDate ───────────────────────────────────────────────────────────

describe("formatEntryDate()", () => {
  it("returns a non-empty string for any timestamp", () => {
    expect(typeof formatEntryDate(Date.now())).toBe("string");
    expect(formatEntryDate(Date.now()).length).toBeGreaterThan(0);
  });
});

// ── JournalUI ──────────────────────────────────────────────────────────────────

describe("JournalUI", () => {
  let ui: JournalUI;
  let sys: JournalSystem;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui  = new JournalUI();
    sys = makeSystem();
    seedEntries(sys);
  });

  // ── show() / hide() ──────────────────────────────────────────────────────────

  describe("show()", () => {
    it("creates the root DOM element", () => {
      ui.show();
      expect(document.querySelector(".journal-ui")).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.show();
      expect(ui.isVisible).toBe(true);
    });

    it("renders with display flex", () => {
      ui.show();
      const root = document.querySelector(".journal-ui") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("creates the DOM only once on repeated calls", () => {
      ui.show();
      ui.show();
      expect(document.querySelectorAll(".journal-ui").length).toBe(1);
    });
  });

  describe("hide()", () => {
    it("sets isVisible to false", () => {
      ui.show();
      ui.hide();
      expect(ui.isVisible).toBe(false);
    });

    it("hides the root element", () => {
      ui.show();
      ui.hide();
      const root = document.querySelector(".journal-ui") as HTMLElement;
      expect(root.style.display).toBe("none");
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────────

  describe("update()", () => {
    it("renders all entries in 'all' mode", () => {
      ui.show();
      ui.update(sys);
      const rows = document.querySelectorAll(".journal-ui__entry-row");
      expect(rows.length).toBe(3);
    });

    it("renders entry titles in the list", () => {
      ui.show();
      ui.update(sys);
      const titles = Array.from(document.querySelectorAll(".journal-ui__entry-title"))
        .map((el) => el.textContent);
      expect(titles).toContain("Main Quest Start");
    });

    it("renders category badges", () => {
      ui.show();
      ui.update(sys);
      const badges = document.querySelectorAll(".journal-ui__entry-badge");
      expect(badges.length).toBe(3);
    });

    it("shows 'No entries found.' when system is empty", () => {
      ui.show();
      ui.update(new JournalSystem());
      const empty = document.querySelector(".journal-ui__empty");
      expect(empty?.textContent).toBe("No entries found.");
    });

    it("renders tab buttons for all categories", () => {
      ui.show();
      ui.update(sys);
      const tabs = document.querySelectorAll(".journal-ui__tab");
      expect(tabs.length).toBe(8); // all/quest/lore/note/rumor/observation/misc/favorites
    });

    it("marks the active tab with is-active class", () => {
      ui.show();
      ui.update(sys);
      const activeTabs = document.querySelectorAll(".journal-ui__tab.is-active");
      expect(activeTabs.length).toBe(1);
      expect(activeTabs[0].textContent).toBe("All");
    });

    it("re-renders correctly when called multiple times", () => {
      ui.show();
      ui.update(sys);
      sys.addEntry({ id: "m1", title: "New Note", body: "A new note.", category: "misc", tags: [] });
      ui.update(sys);
      const rows = document.querySelectorAll(".journal-ui__entry-row");
      expect(rows.length).toBe(4);
    });
  });

  // ── category filtering ────────────────────────────────────────────────────────

  describe("category filtering", () => {
    it("filters to quest entries when the Quest tab is clicked", () => {
      ui.show();
      ui.update(sys);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".journal-ui__tab");
      const questTab = Array.from(tabs).find((t) => t.textContent === "Quest");
      questTab?.click();
      ui.update(sys); // refresh list from system
      const rows = document.querySelectorAll(".journal-ui__entry-row");
      expect(rows.length).toBe(1);
      const title = document.querySelector(".journal-ui__entry-title");
      expect(title?.textContent).toBe("Main Quest Start");
    });

    it("shows activeFilter === 'quest' after clicking Quest tab", () => {
      ui.show();
      ui.update(sys);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".journal-ui__tab");
      Array.from(tabs).find((t) => t.textContent === "Quest")?.click();
      expect(ui.activeFilter).toBe("quest");
    });

    it("shows favorites entries when Favorites tab is clicked", () => {
      sys.toggleFavorite("q1");
      ui.show();
      ui.update(sys);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".journal-ui__tab");
      Array.from(tabs).find((t) => t.textContent?.includes("Favorites"))?.click();
      ui.update(sys);
      const rows = document.querySelectorAll(".journal-ui__entry-row");
      expect(rows.length).toBe(1);
    });

    it("resets selection when switching tabs", () => {
      ui.show();
      ui.update(sys);
      // Click first entry row to select it
      const firstRow = document.querySelector<HTMLElement>(".journal-ui__entry-row");
      firstRow?.click();
      expect(ui.selectedId).not.toBeNull();
      // Switch to lore tab
      const tabs = document.querySelectorAll<HTMLButtonElement>(".journal-ui__tab");
      Array.from(tabs).find((t) => t.textContent === "Lore")?.click();
      expect(ui.selectedId).toBeNull();
    });
  });

  // ── entry selection + detail pane ─────────────────────────────────────────────

  describe("entry selection", () => {
    it("renders the entry title in the detail pane when a row is clicked", () => {
      ui.show();
      ui.update(sys);
      const row = document.querySelector<HTMLElement>(".journal-ui__entry-row");
      row?.click();
      const detailTitle = document.querySelector(".journal-ui__detail-title");
      expect(detailTitle?.textContent).toBeTruthy();
    });

    it("renders the entry body in the detail pane", () => {
      ui.show();
      ui.update(sys);
      const row = document.querySelector<HTMLElement>(".journal-ui__entry-row");
      row?.click();
      const body = document.querySelector(".journal-ui__detail-body");
      expect(body?.textContent).toBeTruthy();
    });

    it("renders tag chips in the detail pane for entries with tags", () => {
      ui.show();
      ui.update(sys);
      // Click the entry row for q1 which has tags
      const rows = document.querySelectorAll<HTMLElement>(".journal-ui__entry-row");
      const q1Row = Array.from(rows).find(
        (r) => r.dataset.entryId === "q1",
      );
      q1Row?.click();
      const chips = document.querySelectorAll(".journal-ui__tag-chip");
      expect(chips.length).toBe(2); // "main" and "story"
    });

    it("marks the clicked row as is-selected", () => {
      ui.show();
      ui.update(sys);
      const row = document.querySelector<HTMLElement>(".journal-ui__entry-row");
      row?.click();
      expect(row?.classList.contains("is-selected")).toBe(true);
    });

    it("updates selectedId when a row is clicked", () => {
      ui.show();
      ui.update(sys);
      const row = document.querySelector<HTMLElement>("[data-entry-id='q1']");
      row?.click();
      expect(ui.selectedId).toBe("q1");
    });
  });

  // ── favorite toggle ───────────────────────────────────────────────────────────

  describe("onFavoriteToggle callback", () => {
    it("fires with the entry id when the ☆ button is clicked", () => {
      ui.show();
      ui.update(sys);
      const fn = vi.fn();
      ui.onFavoriteToggle = fn;
      const favBtn = document.querySelector<HTMLButtonElement>(".journal-ui__fav-btn");
      favBtn?.click();
      expect(fn).toHaveBeenCalledWith(expect.any(String));
    });

    it("does not trigger row selection when the fav button is clicked", () => {
      ui.show();
      ui.update(sys);
      const fn = vi.fn();
      ui.onFavoriteToggle = fn;
      const favBtn = document.querySelector<HTMLButtonElement>(".journal-ui__fav-btn");
      favBtn?.click();
      // Detail pane should not have been populated just from fav click
      const detailTitle = document.querySelector(".journal-ui__detail-title");
      expect(detailTitle).toBeNull();
    });

    it("renders ⭐ on a favorited entry row", () => {
      sys.toggleFavorite("q1");
      ui.show();
      ui.update(sys);
      const q1Row = document.querySelector<HTMLElement>("[data-entry-id='q1']");
      const favBtn = q1Row?.querySelector(".journal-ui__fav-btn");
      expect(favBtn?.textContent).toBe("⭐");
    });
  });

  // ── accessibility ─────────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("root has role=dialog", () => {
      ui.show();
      expect(document.querySelector(".journal-ui")?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.show();
      expect(document.querySelector(".journal-ui")?.getAttribute("aria-modal")).toBe("true");
    });

    it("entry list has role=list", () => {
      ui.show();
      ui.update(sys);
      expect(document.querySelector(".journal-ui__list")?.getAttribute("role")).toBe("list");
    });

    it("tab buttons have role=tab", () => {
      ui.show();
      ui.update(sys);
      const tabs = document.querySelectorAll(".journal-ui__tab");
      tabs.forEach((t) => expect(t.getAttribute("role")).toBe("tab"));
    });

    it("fav button has aria-pressed attribute", () => {
      ui.show();
      ui.update(sys);
      const favBtns = document.querySelectorAll<HTMLButtonElement>(".journal-ui__fav-btn");
      favBtns.forEach((btn) => {
        expect(btn.getAttribute("aria-pressed")).not.toBeNull();
      });
    });

    it("detail pane has aria-live=polite", () => {
      ui.show();
      expect(document.querySelector(".journal-ui__detail")?.getAttribute("aria-live")).toBe("polite");
    });
  });

  // ── destroy() ─────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root element", () => {
      ui.show();
      ui.destroy();
      expect(document.querySelector(".journal-ui")).toBeNull();
    });

    it("sets isVisible to false", () => {
      ui.show();
      ui.destroy();
      expect(ui.isVisible).toBe(false);
    });

    it("does not throw when called before show()", () => {
      expect(() => ui.destroy()).not.toThrow();
    });
  });

  // ── close button ──────────────────────────────────────────────────────────────

  describe("close button", () => {
    it("hides the panel when clicked", () => {
      ui.show();
      const closeBtn = document.querySelector<HTMLButtonElement>(".journal-ui__close");
      closeBtn?.click();
      expect(ui.isVisible).toBe(false);
    });
  });
});
