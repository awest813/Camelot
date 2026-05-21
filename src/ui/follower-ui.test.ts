import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FollowerUI } from "./follower-ui";
import type { FollowerTemplate, ActiveFollowerState } from "../systems/follower-system";

describe("FollowerUI", () => {
  let ui: FollowerUI;

  const mockTemplates: FollowerTemplate[] = [
    { id: "tmpl_1", name: "Lydia", combatRole: "warrior", level: 10, hireCost: 500, description: "Housecarl", homeLocationId: "whiterun", carryWeightBonus: 100 },
    { id: "tmpl_2", name: "Faendal", combatRole: "archer", level: 5, hireCost: 0, description: "Archer", homeLocationId: "riverwood", carryWeightBonus: 50 }
  ];

  const mockActive: ActiveFollowerState = {
    templateId: "tmpl_1",
    name: "Lydia",
    health: 100,
    maxHealth: 100,
    level: 10,
    command: "follow",
    isAlive: true,
    attackDamage: 20
  };

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new FollowerUI();
  });

  afterEach(() => {
    ui.close();
  });

  describe("active follower commands", () => {
    it("uses aria-disabled instead of native disabled for active command button", () => {
      ui.open(mockTemplates, mockActive, [], 1000);

      // Find the Follow button - it should be aria-disabled since the command is already 'follow'
      const followBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Follow");
      expect(followBtn).toBeDefined();
      expect(followBtn?.disabled).toBe(false);
      expect(followBtn?.getAttribute("aria-disabled")).toBe("true");

      // Wait button should NOT be disabled
      const waitBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Wait");
      expect(waitBtn).toBeDefined();
      expect(waitBtn?.disabled).toBe(false);
      expect(waitBtn?.getAttribute("aria-disabled")).toBe("false");
    });

    it("does not trigger onCommand when aria-disabled is true", () => {
      ui.open(mockTemplates, mockActive, [], 1000);
      const fn = vi.fn();
      ui.onCommand = fn;

      const followBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Follow");
      followBtn?.click();

      expect(fn).not.toHaveBeenCalled();

      const waitBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Wait");
      waitBtn?.click();

      expect(fn).toHaveBeenCalledWith("wait");
    });
  });

  describe("follower recruitment", () => {
    it("uses aria-disabled for recruit button when player cannot afford", () => {
      // 0 gold, needs 500
      ui.open(mockTemplates, null, [], 0);

      const recruitBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.startsWith("Recruit"));
      expect(recruitBtn).toBeDefined();

      expect(recruitBtn?.disabled).toBe(false);
      expect(recruitBtn?.getAttribute("aria-disabled")).toBe("true");
      expect(recruitBtn?.title).toBe("You need 500 gold to hire this follower.");
    });

    it("uses aria-disabled for recruit button when player already has an active follower", () => {
      // 1000 gold, but already has active follower
      ui.open(mockTemplates, mockActive, [], 1000);

      const recruitBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.startsWith("Recruit"));
      expect(recruitBtn).toBeDefined();

      expect(recruitBtn?.disabled).toBe(false);
      expect(recruitBtn?.getAttribute("aria-disabled")).toBe("true");
      expect(recruitBtn?.title).toBe("You already have an active follower. Dismiss them first.");
    });

    it("does not trigger onRecruit when aria-disabled is true", () => {
      ui.open(mockTemplates, null, [], 0); // Can't afford
      const fn = vi.fn();
      ui.onRecruit = fn;

      const recruitBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.startsWith("Recruit"));
      recruitBtn?.click();

      expect(fn).not.toHaveBeenCalled();
    });
  });
});
