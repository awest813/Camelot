import { describe, it, expect } from "vitest";
import { modelForNpcName, skeletalClipFor } from "./character-models";

describe("character model mapping", () => {
  it("picks models by archetype words", () => {
    expect(modelForNpcName("TowerGuard_1_2")).toBe("Knight");
    expect(modelForNpcName("RuinGuard_1_2")).toBe("Skeleton_Warrior");
    expect(modelForNpcName("Draugr Archer")).toBe("Skeleton_Rogue");
    expect(modelForNpcName("Village Mage")).toBe("Mage");
    expect(modelForNpcName("Bandit Chief")).toBe("Barbarian");
    expect(modelForNpcName("Forest Archer")).toBe("Rogue_Hooded");
    expect(modelForNpcName("Innkeeper Bess")).toBe("Rogue");
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
});
