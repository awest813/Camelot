import { describe, it, expect } from "vitest";
import type { NpcArchetypeDefinition } from "../framework/content/content-types";
import { resolveDialogueIdForNpcMeshName } from "./dialogue-npc-resolve";

const baseArchetype = (overrides: Partial<NpcArchetypeDefinition>): NpcArchetypeDefinition => ({
  id: "x",
  name: "NPC",
  description: "",
  role: "villager",
  isHostile: false,
  isMerchant: false,
  baseHealth: 50,
  level: 1,
  ...overrides,
});

describe("resolveDialogueIdForNpcMeshName", () => {
  it("matches archetype name exactly", () => {
    const id = resolveDialogueIdForNpcMeshName("Town Guard", [
      baseArchetype({ id: "g", name: "Town Guard", dialogueId: "guard_intro" }),
    ]);
    expect(id).toBe("guard_intro");
  });

  it("matches archetype name with spawn suffix", () => {
    const id = resolveDialogueIdForNpcMeshName("Town Guard_12345", [
      baseArchetype({ id: "g", name: "Town Guard", dialogueId: "guard_intro" }),
    ]);
    expect(id).toBe("guard_intro");
  });

  it("prefers the longest matching archetype prefix", () => {
    const id = resolveDialogueIdForNpcMeshName("Town Guard_1", [
      baseArchetype({ id: "v", name: "Town", dialogueId: "wrong" }),
      baseArchetype({ id: "g", name: "Town Guard", dialogueId: "guard_intro" }),
    ]);
    expect(id).toBe("guard_intro");
  });

  it("falls back to guard_intro when mesh name denotes a guard", () => {
    expect(resolveDialogueIdForNpcMeshName("RuinGuard_0_1", [])).toBe("guard_intro");
    expect(resolveDialogueIdForNpcMeshName("Guard", [])).toBe("guard_intro");
  });

  it("returns null when no binding and not a guard", () => {
    expect(resolveDialogueIdForNpcMeshName("RandomNPC_9", [])).toBeNull();
  });

  it("ignores archetypes without dialogueId", () => {
    expect(
      resolveDialogueIdForNpcMeshName("Villager_1", [baseArchetype({ id: "v", name: "Villager" })]),
    ).toBeNull();
  });
});
