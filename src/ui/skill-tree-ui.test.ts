// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SkillTreeUI, renderRankPips } from "./skill-tree-ui";
import type { SkillTree } from "../systems/skill-tree-system";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeTree(overrides: Partial<SkillTree> = {}): SkillTree {
  return {
    name: "Combat",
    skills: [
      {
        id: "iron_skin",
        name: "Iron Skin",
        description: "+5 Armor per rank",
        maxRank: 3,
        currentRank: 0,
        effect: () => {},
      },
      {
        id: "warriors_edge",
        name: "Warrior's Edge",
        description: "+5 melee dmg per rank",
        maxRank: 3,
        currentRank: 0,
        effect: () => {},
        prerequisites: [{ skillId: "iron_skin", minRank: 1 }],
      },
    ],
    ...overrides,
  };
}

function makeTrees(): SkillTree[] {
  return [
    makeTree({ name: "Combat" }),
    {
      name: "Magic",
      skills: [
        {
          id: "arcane_power",
          name: "Arcane Power",
          description: "+5 magic dmg per rank",
          maxRank: 3,
          currentRank: 0,
          effect: () => {},
        },
      ],
    },
  ];
}

// ── renderRankPips ─────────────────────────────────────────────────────────────

describe("renderRankPips()", () => {
  it("returns all empty pips when rank is 0", () => {
    expect(renderRankPips(0, 3)).toBe("○○○");
  });

  it("returns all filled pips at max rank", () => {
    expect(renderRankPips(3, 3)).toBe("●●●");
  });

  it("returns a mix of filled and empty pips", () => {
    expect(renderRankPips(2, 3)).toBe("●●○");
  });

  it("handles maxRank of 1", () => {
    expect(renderRankPips(0, 1)).toBe("○");
    expect(renderRankPips(1, 1)).toBe("●");
  });

  it("never returns negative characters on over-rank edge case", () => {
    expect(renderRankPips(0, 0)).toBe("");
  });
});

// ── SkillTreeUI ────────────────────────────────────────────────────────────────

describe("SkillTreeUI", () => {
  let ui: SkillTreeUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new SkillTreeUI();
  });

  // ── show() / hide() ──────────────────────────────────────────────────────────

  describe("show()", () => {
    it("creates the root DOM element", () => {
      ui.show();
      const root = document.querySelector(".skill-tree-ui");
      expect(root).not.toBeNull();
    });

    it("sets isVisible to true", () => {
      ui.show();
      expect(ui.isVisible).toBe(true);
    });

    it("renders the panel with display flex", () => {
      ui.show();
      const root = document.querySelector(".skill-tree-ui") as HTMLElement;
      expect(root.style.display).toBe("flex");
    });

    it("creates the panel only once on repeated calls", () => {
      ui.show();
      ui.show();
      const panels = document.querySelectorAll(".skill-tree-ui");
      expect(panels.length).toBe(1);
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
      const root = document.querySelector(".skill-tree-ui") as HTMLElement;
      expect(root.style.display).toBe("none");
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────────

  describe("update()", () => {
    it("renders a tab for each tree", () => {
      ui.show();
      ui.update(makeTrees(), 3);
      const tabs = document.querySelectorAll(".skill-tree-ui__tab");
      expect(tabs.length).toBe(2);
      expect(tabs[0].textContent).toBe("Combat");
      expect(tabs[1].textContent).toBe("Magic");
    });

    it("renders skill cards for the active tab (first by default)", () => {
      ui.show();
      ui.update(makeTrees(), 3);
      const cards = document.querySelectorAll(".skill-tree-ui__card");
      expect(cards.length).toBe(2); // Combat has 2 skills
    });

    it("displays the skill points label", () => {
      ui.show();
      ui.update(makeTrees(), 5);
      const label = document.querySelector(".skill-tree-ui__points");
      expect(label?.textContent).toContain("5");
    });

    it("shows rank pips on each card", () => {
      ui.show();
      ui.update(makeTrees(), 3);
      const pips = document.querySelectorAll(".skill-tree-ui__pips");
      expect(pips.length).toBeGreaterThan(0);
      // Iron Skin rank 0/3 should show ○○○
      expect(pips[0].textContent).toBe("○○○");
    });

    it("marks skill cards as locked when prereqs are not met", () => {
      ui.show();
      // Always return false for prereq check
      ui.update(makeTrees(), 3, () => false);
      const cards = document.querySelectorAll(".skill-tree-ui__card");
      cards.forEach((c) => expect(c.classList.contains("is-locked")).toBe(true));
    });

    it("shows description with lock icon for locked skills", () => {
      ui.show();
      ui.update(makeTrees(), 3, () => false);
      const descs = document.querySelectorAll(".skill-tree-ui__skill-desc");
      expect(descs[0].textContent).toContain("🔒");
    });

    it("does NOT mark unlocked skill cards as locked", () => {
      ui.show();
      ui.update(makeTrees(), 3, () => true);
      const cards = document.querySelectorAll(".skill-tree-ui__card");
      cards.forEach((c) => expect(c.classList.contains("is-locked")).toBe(false));
    });

    it("shows 'Max' badge when skill is at max rank", () => {
      const trees = makeTrees();
      trees[0].skills[0].currentRank = 3; // maxRank is also 3
      ui.show();
      ui.update(trees, 3);
      const badge = document.querySelector(".skill-tree-ui__maxed-badge");
      expect(badge?.textContent).toBe("Max");
    });

    it("marks maxed card with is-maxed class", () => {
      const trees = makeTrees();
      trees[0].skills[0].currentRank = 3;
      ui.show();
      ui.update(trees, 3);
      const cards = document.querySelectorAll(".skill-tree-ui__card");
      expect(cards[0].classList.contains("is-maxed")).toBe(true);
    });

    it("disables the upgrade button when no skill points remain", () => {
      ui.show();
      ui.update(makeTrees(), 0, () => true);
      const btns = document.querySelectorAll<HTMLButtonElement>(".skill-tree-ui__upgrade-btn");
      btns.forEach((btn) => expect(btn.disabled).toBe(true));
    });

    it("enables the upgrade button when skill points > 0 and prereqs are met", () => {
      ui.show();
      ui.update(makeTrees(), 2, () => true);
      const firstBtn = document.querySelector<HTMLButtonElement>(".skill-tree-ui__upgrade-btn");
      expect(firstBtn?.disabled).toBe(false);
    });

    it("renders correctly with an empty tree list", () => {
      ui.show();
      expect(() => ui.update([], 0)).not.toThrow();
      const tabs = document.querySelectorAll(".skill-tree-ui__tab");
      expect(tabs.length).toBe(0);
    });
  });

  // ── tab switching ─────────────────────────────────────────────────────────────

  describe("tab switching", () => {
    it("switches the active pane when a tab is clicked", () => {
      ui.show();
      ui.update(makeTrees(), 3);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".skill-tree-ui__tab");
      // Click the second tab (Magic)
      tabs[1].click();
      const cards = document.querySelectorAll(".skill-tree-ui__card");
      // Magic tree has 1 skill
      expect(cards.length).toBe(1);
      const cardName = document.querySelector(".skill-tree-ui__skill-name");
      expect(cardName?.textContent).toBe("Arcane Power");
    });

    it("marks the clicked tab as active", () => {
      ui.show();
      ui.update(makeTrees(), 3);
      const tabs = document.querySelectorAll<HTMLButtonElement>(".skill-tree-ui__tab");
      tabs[1].click();
      // Tabs are re-created on click, so query fresh references.
      const freshTabs = document.querySelectorAll<HTMLButtonElement>(".skill-tree-ui__tab");
      expect(freshTabs[1].classList.contains("is-active")).toBe(true);
      expect(freshTabs[1].getAttribute("aria-selected")).toBe("true");
    });
  });

  // ── onPurchase callback ───────────────────────────────────────────────────────

  describe("onPurchase callback", () => {
    it("fires with correct treeIndex and skillIndex on upgrade click", () => {
      ui.show();
      ui.update(makeTrees(), 3, () => true);
      const fn = vi.fn();
      ui.onPurchase = fn;
      const btn = document.querySelector<HTMLButtonElement>(".skill-tree-ui__upgrade-btn");
      btn?.click();
      expect(fn).toHaveBeenCalledWith(0, 0);
    });

    it("does not fire when the button is disabled", () => {
      ui.show();
      ui.update(makeTrees(), 0); // no skill points
      const fn = vi.fn();
      ui.onPurchase = fn;
      const btn = document.querySelector<HTMLButtonElement>(".skill-tree-ui__upgrade-btn");
      btn?.click();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  // ── accessibility ─────────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("root has role=dialog", () => {
      ui.show();
      const root = document.querySelector(".skill-tree-ui");
      expect(root?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      ui.show();
      const root = document.querySelector(".skill-tree-ui");
      expect(root?.getAttribute("aria-modal")).toBe("true");
    });

    it("tab buttons have role=tab", () => {
      ui.show();
      ui.update(makeTrees(), 3);
      const tabs = document.querySelectorAll(".skill-tree-ui__tab");
      tabs.forEach((t) => expect(t.getAttribute("role")).toBe("tab"));
    });

    it("pane has role=tabpanel", () => {
      ui.show();
      ui.update(makeTrees(), 3);
      const pane = document.querySelector(".skill-tree-ui__pane");
      expect(pane?.getAttribute("role")).toBe("tabpanel");
    });

    it("pip span has aria-label with rank info", () => {
      ui.show();
      ui.update(makeTrees(), 3);
      const pips = document.querySelector(".skill-tree-ui__pips");
      expect(pips?.getAttribute("aria-label")).toContain("Rank 0 of 3");
    });
  });

  // ── destroy() ─────────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("removes the root element from the DOM", () => {
      ui.show();
      ui.destroy();
      const root = document.querySelector(".skill-tree-ui");
      expect(root).toBeNull();
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
      const closeBtn = document.querySelector<HTMLButtonElement>(".skill-tree-ui__close");
      closeBtn?.click();
      expect(ui.isVisible).toBe(false);
    });
  });
});
