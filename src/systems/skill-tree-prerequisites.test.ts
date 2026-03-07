import { describe, it, expect, beforeEach, vi } from "vitest";
import { SkillTreeSystem } from "./skill-tree-system";

function makePlayer() {
  return {
    health: 100,
    maxHealth: 100,
    magicka: 100,
    maxMagicka: 100,
    stamina: 100,
    maxStamina: 100,
    healthRegen: 0.5,
    magickaRegen: 2,
    staminaRegen: 5,
    bonusArmor: 0,
    bonusDamage: 0,
    bonusMagicDamage: 0,
    skillPoints: 3,
  } as any;
}

function makeUI() {
  return {
    showNotification: vi.fn(),
    refreshSkillTree: vi.fn(),
    toggleSkillTree: vi.fn(),
  } as any;
}

describe("SkillTreeSystem — prerequisites", () => {
  let player: any;
  let ui: any;
  let sys: SkillTreeSystem;

  beforeEach(() => {
    player = makePlayer();
    ui = makeUI();
    sys = new SkillTreeSystem(player, ui);
  });

  it("can purchase a skill with no prerequisites", () => {
    const ok = sys.purchaseSkill(0, 0); // Iron Skin (no prereq)
    expect(ok).toBe(true);
  });

  it("blocks purchasing a skill whose prerequisite is unmet", () => {
    // warrior's_edge requires iron_skin rank 1
    const ok = sys.purchaseSkill(0, 1); // Warrior's Edge
    expect(ok).toBe(false);
    expect(ui.showNotification).toHaveBeenCalledWith(expect.stringContaining("Requires"), 2500);
  });

  it("allows purchasing a skill after meeting the prerequisite", () => {
    sys.purchaseSkill(0, 0); // Iron Skin rank 1
    const ok = sys.purchaseSkill(0, 1); // Warrior's Edge (now meets prereq)
    expect(ok).toBe(true);
  });

  it("arePrerequisitesMet returns false when prereq unmet", () => {
    expect(sys.arePrerequisitesMet(0, 1)).toBe(false);
  });

  it("arePrerequisitesMet returns true after meeting prereq", () => {
    sys.purchaseSkill(0, 0); // Iron Skin rank 1
    expect(sys.arePrerequisitesMet(0, 1)).toBe(true);
  });

  it("arePrerequisitesMet returns true for skills with no prerequisites", () => {
    expect(sys.arePrerequisitesMet(0, 0)).toBe(true); // Iron Skin
    expect(sys.arePrerequisitesMet(1, 0)).toBe(true); // Arcane Power
  });

  it("blocks magic tree mana_flow before arcane_power", () => {
    // mana_flow (tree 1, index 2) requires arcane_power rank 1
    expect(sys.arePrerequisitesMet(1, 2)).toBe(false);
    sys.purchaseSkill(1, 0); // Arcane Power rank 1
    expect(sys.arePrerequisitesMet(1, 2)).toBe(true);
  });

  it("blocks survival second_wind before swift_recovery", () => {
    expect(sys.arePrerequisitesMet(2, 2)).toBe(false);
    sys.purchaseSkill(2, 1); // Swift Recovery rank 1
    expect(sys.arePrerequisitesMet(2, 2)).toBe(true);
  });
});
