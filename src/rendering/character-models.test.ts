import { describe, it, expect } from "vitest";
import { modelForNpcName, skeletalClipFor } from "./character-models";

describe("character model mapping", () => {
  it("picks models by archetype words", () => {
    // Undead stay KayKit skeletons; living humans are Quaternius outfit characters.
    expect(modelForNpcName("RuinGuard_1_2")).toBe("Skeleton_Warrior");
    expect(modelForNpcName("Barrow-dead Archer")).toBe("Skeleton_Rogue");
    expect(modelForNpcName("TowerGuard_1_2")).toMatch(/^Ranger_(Male|Female)$/);
    expect(modelForNpcName("Village Mage")).toMatch(/^Ranger_(Male|Female)$/);
    expect(modelForNpcName("Forest Archer")).toMatch(/^Ranger_(Male|Female)$/);
    expect(modelForNpcName("Bandit Chief")).toBe("Orc_Brute");
    expect(modelForNpcName("Innkeeper Bess")).toMatch(/^Peasant_(Male|Female)$/);
  });

  it("keeps an NPC's look stable across reloads (name-hashed gender)", () => {
    for (const name of ["Villager_123", "Innkeeper_9", "Guard", "Bandit_4"]) {
      expect(modelForNpcName(name)).toBe(modelForNpcName(name));
    }
    const looks = new Set(Array.from({ length: 40 }, (_, i) => modelForNpcName(`Villager_${i}`)));
    expect(looks).toEqual(new Set(["Peasant_Male", "Peasant_Female"]));
  });

  it("leaves dragons on their own visuals", () => {
    expect(modelForNpcName("DragonBoss_1_1")).toBeNull();
  });

  it("maps clips to looping / one-shot skeletal animations", () => {
    expect(skeletalClipFor("walk", "Knight")).toEqual({ name: "Walking_A", loop: true });
    expect(skeletalClipFor("death", "Knight").loop).toBe(false);
    expect(skeletalClipFor("telegraph", "Mage").name).toBe("Spellcast_Shoot");
    expect(skeletalClipFor("telegraph", "Rogue_Hooded").name).toBe("1H_Ranged_Shoot");
    expect(skeletalClipFor("walk", "Skeleton_Warrior").name).toBe("Walking_D_Skeletons");
    expect(skeletalClipFor("hit", "Skeleton_Warrior").name).toBe("Hit_A");
  });

  it("maps clips to Universal Animation Library clips for Quaternius humans", () => {
    expect(skeletalClipFor("walk", "Peasant_Male")).toEqual({ name: "Walk_Loop", loop: true });
    expect(skeletalClipFor("run", "Ranger_Female").name).toBe("Jog_Fwd_Loop");
    expect(skeletalClipFor("telegraph", "Ranger_Male").name).toBe("Sword_Attack");
    expect(skeletalClipFor("telegraph", "Peasant_Female").name).toBe("Punch_Jab");
    expect(skeletalClipFor("death", "Orc_Brute")).toEqual({ name: "Death01", loop: false });
  });
});
