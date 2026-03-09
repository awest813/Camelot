import { describe, it, expect } from "vitest";
import { ModLoader } from "./mod-loader";
import { RpgContentBundle } from "../content/content-types";

const baseContent: RpgContentBundle = {
  dialogues: [
    {
      id: "guard_intro",
      startNodeId: "a",
      nodes: [{ id: "a", speaker: "Guard", text: "Hi", choices: [] }],
    },
  ],
  quests: [],
  items: [{ id: "potion", name: "Potion", description: "HP", stackable: true }],
  factions: [{ id: "guard", name: "Guard" }],
  npcArchetypes: [],
};

describe("ModLoader", () => {
  it("loads mods from manifest and reports collisions", async () => {
    const fetchMap: Record<string, unknown> = {
      "https://mods.test/mods-manifest.json": {
        mods: [
          { id: "mod_a", url: "mod-a.json" },
          { id: "mod_b", url: "mod-b.json" },
        ],
      },
      "https://mods.test/mod-a.json": {
        id: "mod_a",
        content: {
          items: [{ id: "potion", name: "Strong Potion", description: "++", stackable: true }],
        },
      },
      "https://mods.test/mod-b.json": {
        id: "mod_b",
        content: {
          factions: [{ id: "mages", name: "Mages Guild" }],
        },
      },
    };

    const loader = new ModLoader(async (url: string) => {
      if (!(url in fetchMap)) {
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => fetchMap[url],
      };
    });

    const { content, report } = await loader.loadAndMerge(baseContent, "https://mods.test/mods-manifest.json");
    expect(report.loadedModIds).toEqual(["mod_a", "mod_b"]);
    expect(report.failures).toHaveLength(0);
    expect(report.collisions).toHaveLength(1);
    expect(report.collisions[0].domain).toBe("items");
    expect(content.items.find((item) => item.id === "potion")?.name).toBe("Strong Potion");
    expect(content.factions.find((faction) => faction.id === "mages")).toBeTruthy();
  });

  it("captures mod failures without crashing entire load", async () => {
    const loader = new ModLoader(async (url: string) => {
      if (url.endsWith("mods-manifest.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ mods: [{ id: "missing_mod", url: "missing.json" }] }),
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      };
    });

    const { report } = await loader.loadAndMerge(baseContent, "https://mods.test/mods-manifest.json");
    expect(report.loadedModIds).toEqual([]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].modId).toBe("missing_mod");
  });
});
