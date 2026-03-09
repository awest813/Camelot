import { describe, it, expect } from "vitest";
import { mergeContent } from "./content-merge";
import { RpgContentBundle } from "../content/content-types";
import { RpgMod } from "./mod-types";

describe("mergeContent", () => {
  const createBaseContent = (): RpgContentBundle => ({
    dialogues: [{ id: "base_dialogue", startNodeId: "1", nodes: [] }],
    quests: [{ id: "base_quest", name: "Base Quest", nodes: [] }],
    items: [{ id: "base_item", name: "Base Item", description: "A base item", stackable: true }],
    factions: [{ id: "base_faction", name: "Base Faction" }],
    npcArchetypes: [{ id: "base_npc", name: "Base NPC", role: "villager", isHostile: false, isMerchant: false, baseHealth: 100, level: 1 }],
  });

  it("returns base content unmodified when merging no mods", () => {
    const base = createBaseContent();
    const result = mergeContent(base, []);
    expect(result.merged).toEqual(base);
    expect(result.collisions).toHaveLength(0);
  });

  it("adds new content from a mod", () => {
    const base = createBaseContent();
    const mod: RpgMod = {
      id: "mod_new_content",
      content: {
        items: [{ id: "mod_item", name: "Mod Item", description: "A mod item", stackable: false }],
        factions: [{ id: "mod_faction", name: "Mod Faction" }],
      },
    };

    const result = mergeContent(base, [mod]);

    // Check original items are intact
    expect(result.merged.items.some(i => i.id === "base_item")).toBe(true);
    expect(result.merged.factions.some(f => f.id === "base_faction")).toBe(true);

    // Check new items are added
    expect(result.merged.items.some(i => i.id === "mod_item")).toBe(true);
    expect(result.merged.factions.some(f => f.id === "mod_faction")).toBe(true);

    // No collisions should be reported
    expect(result.collisions).toHaveLength(0);
  });

  it("overrides base content and reports collision when IDs match", () => {
    const base = createBaseContent();
    const mod: RpgMod = {
      id: "mod_override",
      content: {
        items: [{ id: "base_item", name: "Overridden Base Item", description: "Changed description", stackable: true }],
      },
    };

    const result = mergeContent(base, [mod]);

    // Check the item was overridden
    const overriddenItem = result.merged.items.find(i => i.id === "base_item");
    expect(overriddenItem?.name).toBe("Overridden Base Item");

    // Check collision is reported
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]).toEqual({
      domain: "items",
      id: "base_item",
      replacedSource: "base",
      incomingSource: "mod_override",
    });
  });

  it("handles multiple mods modifying the same content sequentially", () => {
    const base = createBaseContent();
    const mod1: RpgMod = {
      id: "mod1",
      content: {
        items: [{ id: "base_item", name: "Mod 1 Base Item", description: "Changed by Mod 1", stackable: true }],
      },
    };
    const mod2: RpgMod = {
      id: "mod2",
      content: {
        items: [{ id: "base_item", name: "Mod 2 Base Item", description: "Changed by Mod 2", stackable: true }],
      },
    };

    const result = mergeContent(base, [mod1, mod2]);

    // Check the item has the value from the last mod
    const overriddenItem = result.merged.items.find(i => i.id === "base_item");
    expect(overriddenItem?.name).toBe("Mod 2 Base Item");

    // Check collisions are reported in order
    expect(result.collisions).toHaveLength(2);
    expect(result.collisions[0]).toEqual({
      domain: "items",
      id: "base_item",
      replacedSource: "base",
      incomingSource: "mod1",
    });
    expect(result.collisions[1]).toEqual({
      domain: "items",
      id: "base_item",
      replacedSource: "mod1",
      incomingSource: "mod2",
    });
  });

  it("handles missing/undefined domains gracefully", () => {
    const base = createBaseContent();
    const mod: RpgMod = {
      id: "mod_partial",
      content: {
        // Only items are provided
        items: [{ id: "mod_item", name: "Mod Item", description: "A mod item", stackable: false }],
      },
    };

    const result = mergeContent(base, [mod]);
    expect(result.merged.dialogues).toEqual(base.dialogues);
    expect(result.merged.quests).toEqual(base.quests);
    expect(result.merged.factions).toEqual(base.factions);
    expect(result.merged.npcArchetypes).toEqual(base.npcArchetypes);
    expect(result.merged.items).toHaveLength(2); // base + mod
    expect(result.collisions).toHaveLength(0);
  });

  it("deep clones merged objects, protecting against original data mutation", () => {
    const base = createBaseContent();
    const mod: RpgMod = {
      id: "mod_clone_test",
      content: {
        items: [{ id: "mod_item", name: "Mod Item", description: "A mod item", stackable: false }],
        quests: [{ id: "base_quest", name: "Overridden Quest", nodes: [] }], // Override base
      },
    };

    const result = mergeContent(base, [mod]);

    // Mutate base and mod content
    base.items[0].name = "Mutated Base Item";
    mod.content.items![0].name = "Mutated Mod Item";
    mod.content.quests![0].name = "Mutated Overridden Quest";

    // Verify result is unmutated
    const resultBaseItem = result.merged.items.find(i => i.id === "base_item");
    const resultModItem = result.merged.items.find(i => i.id === "mod_item");
    const resultOverriddenQuest = result.merged.quests.find(q => q.id === "base_quest");

    expect(resultBaseItem?.name).toBe("Base Item");
    expect(resultModItem?.name).toBe("Mod Item");
    expect(resultOverriddenQuest?.name).toBe("Overridden Quest");
  });

  it("handles empty npcArchetypes array in base content correctly", () => {
    // Some consumers might pass an object without `npcArchetypes` initialized
    // We mock that case to ensure the fallback logic in mergeContent works
    const base: any = createBaseContent();
    delete base.npcArchetypes;

    const mod: RpgMod = {
      id: "mod_npc",
      content: {
        npcArchetypes: [{ id: "mod_npc", name: "Mod NPC", role: "guard", isHostile: false, isMerchant: false, baseHealth: 100, level: 1 }],
      },
    };

    const result = mergeContent(base as RpgContentBundle, [mod]);
    expect(result.merged.npcArchetypes).toHaveLength(1);
    expect(result.merged.npcArchetypes[0].id).toBe("mod_npc");
  });
});
