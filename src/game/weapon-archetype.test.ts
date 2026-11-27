import { describe, it, expect } from "vitest";
import { weaponArchetypeOf } from "./weapon-archetype";

const w = (id: string, name = id) => ({ id, name, description: "", stackable: false, quantity: 1 });

describe("weaponArchetypeOf", () => {
  it("reads the archetype from the weapon's id and name", () => {
    expect(weaponArchetypeOf(undefined)).toBe("sword");
    expect(weaponArchetypeOf(w("fae_bow"))).toBe("bow");
    expect(weaponArchetypeOf(w("x", "Oak Staff"))).toBe("staff");
    expect(weaponArchetypeOf(w("molten_dagger_01"))).toBe("dagger");
    expect(weaponArchetypeOf(w("x", "Two-Handed Claymore"))).toBe("greatsword");
    expect(weaponArchetypeOf(w("war_hammer"))).toBe("mace");
    expect(weaponArchetypeOf(w("frost_axe_01"))).toBe("axe");
    expect(weaponArchetypeOf(w("rune_sword_01"))).toBe("sword");
  });
});
