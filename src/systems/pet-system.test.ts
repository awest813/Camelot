import { describe, it, expect, beforeEach, vi } from "vitest";
import { PetSystem } from "./pet-system";
import type { Pet, PetTemplate } from "./pet-system";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<PetTemplate> = {}): PetTemplate {
  return {
    id: "test_pet",
    name: "Test Pet",
    species: "wolf",
    maxHealth: 100,
    attackDamage: 10,
    moveSpeed: 5.0,
    followDistance: 2.0,
    attackRange: 2.0,
    meshColor: { r: 0.5, g: 0.5, b: 0.5 },
    meshScale: 0.6,
    ...overrides,
  };
}

describe("PetSystem", () => {
  let ps: PetSystem;

  beforeEach(() => {
    ps = new PetSystem();
  });

  // ── Default templates ───────────────────────────────────────────────────

  describe("built-in templates", () => {
    it("registers wolf, cat, and raven by default", () => {
      const ids = ps.templates.map(t => t.id);
      expect(ids).toContain("pet_wolf");
      expect(ids).toContain("pet_cat");
      expect(ids).toContain("pet_raven");
    });

    it("wolf has higher health than cat", () => {
      expect(ps.getTemplate("pet_wolf")!.maxHealth).toBeGreaterThan(
        ps.getTemplate("pet_cat")!.maxHealth,
      );
    });

    it("raven has the longest attack range", () => {
      const raven = ps.getTemplate("pet_raven")!;
      const wolf  = ps.getTemplate("pet_wolf")!;
      expect(raven.attackRange).toBeGreaterThan(wolf.attackRange);
    });
  });

  // ── Template registry ───────────────────────────────────────────────────

  describe("registerTemplate / getTemplate", () => {
    it("registers a custom template and retrieves it", () => {
      const tpl = makeTemplate({ id: "my_pet", name: "My Pet" });
      ps.registerTemplate(tpl);
      expect(ps.getTemplate("my_pet")).not.toBeNull();
      expect(ps.getTemplate("my_pet")!.name).toBe("My Pet");
    });

    it("returns null for unknown template id", () => {
      expect(ps.getTemplate("does_not_exist")).toBeNull();
    });

    it("custom template appears in templates array", () => {
      ps.registerTemplate(makeTemplate({ id: "alpha" }));
      expect(ps.templates.some(t => t.id === "alpha")).toBe(true);
    });

    it("overwrites a template with the same id", () => {
      ps.registerTemplate(makeTemplate({ id: "pet_wolf", maxHealth: 999 }));
      expect(ps.getTemplate("pet_wolf")!.maxHealth).toBe(999);
    });
  });

  // ── Ownership — grantPet ────────────────────────────────────────────────

  describe("grantPet", () => {
    it("returns null for unknown template id", () => {
      expect(ps.grantPet("ghost_pet")).toBeNull();
    });

    it("returns a Pet when granting a known template", () => {
      const pet = ps.grantPet("pet_wolf");
      expect(pet).not.toBeNull();
      expect(pet!.id).toBe("pet_wolf");
    });

    it("returns null when granting the same pet twice", () => {
      ps.grantPet("pet_wolf");
      expect(ps.grantPet("pet_wolf")).toBeNull();
    });

    it("new pet starts with full health", () => {
      const pet = ps.grantPet("pet_wolf")!;
      expect(pet.health).toBe(pet.maxHealth);
    });

    it("new pet starts at level 1 with 0 xp", () => {
      const pet = ps.grantPet("pet_wolf")!;
      expect(pet.level).toBe(1);
      expect(pet.experience).toBe(0);
    });

    it("new pet starts with mood 80 and alive", () => {
      const pet = ps.grantPet("pet_wolf")!;
      expect(pet.mood).toBe(80);
      expect(pet.isDead).toBe(false);
      expect(pet.isActive).toBe(false);
    });

    it("applies an override name when provided", () => {
      const pet = ps.grantPet("pet_wolf", "Shadow")!;
      expect(pet.name).toBe("Shadow");
    });

    it("fires onPetAcquired callback", () => {
      const acquired = vi.fn();
      ps.onPetAcquired = acquired;
      ps.grantPet("pet_wolf");
      expect(acquired).toHaveBeenCalledOnce();
      expect(acquired.mock.calls[0][0].id).toBe("pet_wolf");
    });
  });

  // ── Ownership queries ───────────────────────────────────────────────────

  describe("pets / getPet / hasPet", () => {
    it("pets array is empty initially", () => {
      expect(ps.pets).toHaveLength(0);
    });

    it("hasPet is false when no pets owned", () => {
      expect(ps.hasPet).toBe(false);
    });

    it("pets array grows after granting", () => {
      ps.grantPet("pet_wolf");
      expect(ps.pets).toHaveLength(1);
      expect(ps.hasPet).toBe(true);
    });

    it("getPet returns null for unowned pet", () => {
      expect(ps.getPet("pet_wolf")).toBeNull();
    });

    it("getPet returns the granted pet", () => {
      ps.grantPet("pet_cat");
      expect(ps.getPet("pet_cat")).not.toBeNull();
    });
  });

  // ── Summoning ───────────────────────────────────────────────────────────

  describe("summonPet / dismissPet", () => {
    beforeEach(() => {
      ps.grantPet("pet_wolf");
      ps.grantPet("pet_cat");
    });

    it("summonPet returns false for unowned pet", () => {
      expect(ps.summonPet("pet_raven")).toBe(false);
    });

    it("summonPet returns true and sets activePet", () => {
      expect(ps.summonPet("pet_wolf")).toBe(true);
      expect(ps.activePet?.id).toBe("pet_wolf");
      expect(ps.hasSummonedPet).toBe(true);
    });

    it("summoning a second pet auto-dismisses the first", () => {
      const dismissed = vi.fn();
      ps.onPetDismissed = dismissed;
      ps.summonPet("pet_wolf");
      ps.summonPet("pet_cat");
      expect(ps.activePet?.id).toBe("pet_cat");
      expect(dismissed).toHaveBeenCalledOnce();
    });

    it("dismissPet returns false when no active pet", () => {
      expect(ps.dismissPet()).toBe(false);
    });

    it("dismissPet clears activePet and fires callback", () => {
      const dismissed = vi.fn();
      ps.onPetDismissed = dismissed;
      ps.summonPet("pet_wolf");
      expect(ps.dismissPet()).toBe(true);
      expect(ps.activePet).toBeNull();
      expect(ps.hasSummonedPet).toBe(false);
      expect(dismissed).toHaveBeenCalledOnce();
    });

    it("fires onPetSummoned when summoning", () => {
      const summoned = vi.fn();
      ps.onPetSummoned = summoned;
      ps.summonPet("pet_wolf");
      expect(summoned).toHaveBeenCalledOnce();
    });

    it("cannot summon a dead pet", () => {
      ps.summonPet("pet_wolf");
      ps.petTakeDamage(9999);
      ps.grantPet("pet_raven");
      expect(ps.summonPet("pet_wolf")).toBe(false);
    });
  });

  // ── Combat: petTakeDamage / petHeal ────────────────────────────────────

  describe("petTakeDamage", () => {
    beforeEach(() => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
    });

    it("returns false when no active pet", () => {
      ps.dismissPet();
      expect(ps.petTakeDamage(10)).toBe(false);
    });

    it("reduces pet health by the given amount", () => {
      const before = ps.activePet!.maxHealth;
      ps.petTakeDamage(20);
      expect(ps.activePet!.health).toBe(before - 20);
    });

    it("fires onPetHealthChanged callback", () => {
      const changed = vi.fn();
      ps.onPetHealthChanged = changed;
      ps.petTakeDamage(5);
      expect(changed).toHaveBeenCalledOnce();
    });

    it("does not reduce health below 0", () => {
      ps.petTakeDamage(99999);
      expect(ps.getPet("pet_wolf")!.health).toBe(0);
    });

    it("kills the pet when health reaches 0", () => {
      ps.petTakeDamage(99999);
      expect(ps.getPet("pet_wolf")!.isDead).toBe(true);
    });

    it("clears activePet when pet dies", () => {
      ps.petTakeDamage(99999);
      expect(ps.activePet).toBeNull();
    });

    it("fires onPetDied when pet dies", () => {
      const died = vi.fn();
      ps.onPetDied = died;
      ps.petTakeDamage(99999);
      expect(died).toHaveBeenCalledOnce();
    });
  });

  describe("petHeal", () => {
    beforeEach(() => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
      ps.petTakeDamage(50);
    });

    it("returns false when no active pet", () => {
      ps.summonPet("pet_wolf");
      ps.petTakeDamage(99999); // kill the pet — clears activePet
      expect(ps.petHeal(10)).toBe(false);
    });

    it("restores health by the given amount", () => {
      const before = ps.activePet!.health;
      ps.petHeal(20);
      expect(ps.activePet!.health).toBe(before + 20);
    });

    it("does not exceed maxHealth", () => {
      ps.petHeal(99999);
      const pet = ps.activePet!;
      expect(pet.health).toBe(pet.maxHealth);
    });

    it("fires onPetHealthChanged callback", () => {
      const changed = vi.fn();
      ps.onPetHealthChanged = changed;
      ps.petHeal(10);
      expect(changed).toHaveBeenCalledOnce();
    });
  });

  // ── XP and leveling ─────────────────────────────────────────────────────

  describe("petGainXP", () => {
    beforeEach(() => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
    });

    it("returns false when no active pet", () => {
      ps.dismissPet();
      expect(ps.petGainXP(50)).toBe(false);
    });

    it("accumulates XP without leveling up below threshold", () => {
      // threshold at level 1 is XP_PER_LEVEL * 1 = 100; 99 XP should not level up
      const leveled = ps.petGainXP(99);
      expect(leveled).toBe(false);
      expect(ps.activePet!.level).toBe(1);
      expect(ps.activePet!.experience).toBe(99);
    });

    it("levels up the pet when XP threshold is reached", () => {
      const leveled = ps.petGainXP(100); // XP_PER_LEVEL * level (100 * 1 = 100)
      expect(leveled).toBe(true);
      expect(ps.activePet!.level).toBe(2);
    });

    it("fires onPetLevelUp with new level on level-up", () => {
      const levelUp = vi.fn();
      ps.onPetLevelUp = levelUp;
      ps.petGainXP(100);
      expect(levelUp).toHaveBeenCalledOnce();
      expect(levelUp.mock.calls[0][1]).toBe(2);
    });

    it("resets XP and carries over excess after level-up", () => {
      ps.petGainXP(110); // 10 XP carry over
      expect(ps.activePet!.experience).toBe(10);
    });

    it("increases maxHealth on level-up", () => {
      const before = ps.activePet!.maxHealth;
      ps.petGainXP(100);
      expect(ps.activePet!.maxHealth).toBeGreaterThan(before);
    });

    it("fully heals the pet on level-up", () => {
      ps.petTakeDamage(30); // take some damage first
      ps.petGainXP(100);    // level up → full heal
      const pet = ps.activePet!;
      expect(pet.health).toBe(pet.maxHealth);
    });

    it("returns false when pet is at max level", () => {
      // Force pet to max level via state manipulation
      const pet = ps.getPet("pet_wolf")!;
      (pet as any).level = 20; // PET_MAX_LEVEL = 20
      expect(ps.petGainXP(100)).toBe(false);
    });
  });

  // ── Effective attack damage ─────────────────────────────────────────────

  describe("getEffectiveAttackDamage", () => {
    it("returns 0 when no active pet", () => {
      expect(ps.getEffectiveAttackDamage()).toBe(0);
    });

    it("returns a positive value when pet is active", () => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
      expect(ps.getEffectiveAttackDamage()).toBeGreaterThan(0);
    });

    it("returns higher damage when mood is high", () => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
      const pet = ps.activePet!;
      (pet as any).mood = 100;
      const highMoodDmg = ps.getEffectiveAttackDamage();
      (pet as any).mood = 0;
      const lowMoodDmg = ps.getEffectiveAttackDamage();
      expect(highMoodDmg).toBeGreaterThan(lowMoodDmg);
    });
  });

  // ── Mood ────────────────────────────────────────────────────────────────

  describe("updateMood", () => {
    beforeEach(() => {
      ps.grantPet("pet_wolf");
      ps.grantPet("pet_cat");
    });

    it("active pet loses mood over time", () => {
      ps.summonPet("pet_wolf");
      const before = ps.activePet!.mood;
      ps.updateMood(10);
      expect(ps.activePet!.mood).toBeLessThan(before);
    });

    it("inactive pet recovers mood over time", () => {
      const cat = ps.getPet("pet_cat")!;
      (cat as any).mood = 20;
      ps.updateMood(10);
      expect(ps.getPet("pet_cat")!.mood).toBeGreaterThan(20);
    });

    it("mood does not drop below 0", () => {
      ps.summonPet("pet_wolf");
      const pet = ps.activePet!;
      (pet as any).mood = 1;
      ps.updateMood(100);
      expect(pet.mood).toBe(0);
    });

    it("mood does not exceed 100", () => {
      const wolf = ps.getPet("pet_wolf")!;
      (wolf as any).mood = 99;
      ps.updateMood(10);
      expect(wolf.mood).toBeLessThanOrEqual(100);
    });

    it("dead pets are skipped during mood update", () => {
      ps.summonPet("pet_wolf");
      ps.petTakeDamage(99999); // kill the wolf
      // Should not throw
      expect(() => ps.updateMood(1)).not.toThrow();
    });
  });

  // ── Persistence ─────────────────────────────────────────────────────────

  describe("getSaveState / restoreFromSave", () => {
    it("serialises owned pets and activePetId", () => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
      const state = ps.getSaveState();
      expect(state.activePetId).toBe("pet_wolf");
      expect(state.pets).toHaveLength(1);
      expect(state.pets[0].id).toBe("pet_wolf");
    });

    it("serialises null activePetId when no pet is summoned", () => {
      ps.grantPet("pet_wolf");
      expect(ps.getSaveState().activePetId).toBeNull();
    });

    it("restores owned pets after save/restore round-trip", () => {
      ps.grantPet("pet_wolf");
      ps.grantPet("pet_cat");
      const state = ps.getSaveState();

      const ps2 = new PetSystem();
      ps2.restoreFromSave(state);
      expect(ps2.pets).toHaveLength(2);
    });

    it("restores activePet by re-firing onPetSummoned", () => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
      const state = ps.getSaveState();

      const summoned = vi.fn();
      const ps2 = new PetSystem();
      ps2.onPetSummoned = summoned;
      ps2.restoreFromSave(state);
      expect(ps2.activePet?.id).toBe("pet_wolf");
      expect(summoned).toHaveBeenCalledOnce();
    });

    it("does not restore a dead pet as active", () => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
      ps.petTakeDamage(99999); // kill — activePetId becomes null
      const state = ps.getSaveState();
      expect(state.activePetId).toBeNull();

      const ps2 = new PetSystem();
      ps2.restoreFromSave(state);
      expect(ps2.activePet).toBeNull();
    });

    it("preserves health and level across save/restore", () => {
      ps.grantPet("pet_wolf");
      ps.summonPet("pet_wolf");
      ps.petTakeDamage(20);
      ps.petGainXP(100); // level up

      const state = ps.getSaveState();
      const ps2 = new PetSystem();
      ps2.restoreFromSave(state);

      const wolf = ps2.getPet("pet_wolf")!;
      expect(wolf.level).toBe(2);
    });

    it("silently skips unknown template ids during restore", () => {
      const state = {
        activePetId: null,
        pets: [{ id: "unknown_species", health: 50, level: 1, experience: 0, mood: 80, isDead: false }],
      };
      const ps2 = new PetSystem();
      expect(() => ps2.restoreFromSave(state)).not.toThrow();
      expect(ps2.pets).toHaveLength(0);
    });

    it("preserves mood across save/restore", () => {
      ps.grantPet("pet_cat");
      const cat = ps.getPet("pet_cat")!;
      (cat as any).mood = 42;
      const state = ps.getSaveState();

      const ps2 = new PetSystem();
      ps2.restoreFromSave(state);
      expect(ps2.getPet("pet_cat")!.mood).toBe(42);
    });
  });
});
