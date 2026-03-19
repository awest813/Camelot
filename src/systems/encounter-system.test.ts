import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncounterSystem } from "./encounter-system";
import type {
  EncounterTemplate,
  EncounterContext,
  EncounterSnapshot,
} from "./encounter-system";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<EncounterContext> = {}): EncounterContext {
  return { gameTimeHours: 12, playerLevel: 5, ...overrides };
}

const wolfTemplate: EncounterTemplate = {
  id: "wolves",
  label: "Wolf Pack",
  tableId: "forest_wolves",
  biomeIds: ["forest"],
  minCount: 2,
  maxCount: 4,
  cooldownHours: 2,
};

const banditTemplate: EncounterTemplate = {
  id: "bandits",
  label: "Bandit Ambush",
  tableId: "road_bandits",
  biomeIds: ["plains", "road"],
  minCount: 1,
  maxCount: 3,
  cooldownHours: 4,
};

const bossTemplate: EncounterTemplate = {
  id: "dragon",
  label: "Dragon",
  tableId: "boss_dragon",
  biomeIds: ["mountain"],
  minCount: 1,
  maxCount: 1,
  minLevel: 10,
  cooldownHours: 24,
};

// Deterministic RNGs
const rngAlwaysMin = () => 0;   // always picks minCount
const rngAlwaysMax = () => 0.9999; // always picks maxCount

// ── Tests: CRUD ───────────────────────────────────────────────────────────────

describe("EncounterSystem — CRUD", () => {
  it("registers a template and retrieves it", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    expect(sys.getTemplate("wolves")).toEqual(wolfTemplate);
  });

  it("replaces an existing template with the same id, resetting state", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    sys.triggerEncounter("wolves", makeCtx());
    expect(sys.getTriggerCount("wolves")).toBe(1);

    const updated: EncounterTemplate = { ...wolfTemplate, label: "Wolf Pack v2" };
    sys.addTemplate(updated);
    expect(sys.getTemplate("wolves")?.label).toBe("Wolf Pack v2");
    expect(sys.getTriggerCount("wolves")).toBe(0); // reset
    expect(sys.getLastTriggeredAt("wolves")).toBeNull(); // reset
  });

  it("removeTemplate deletes a registered template", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    sys.removeTemplate("wolves");
    expect(sys.getTemplate("wolves")).toBeUndefined();
    expect(sys.templates).toHaveLength(0);
  });

  it("removeTemplate on unknown id does not throw", () => {
    const sys = new EncounterSystem();
    expect(() => sys.removeTemplate("ghost")).not.toThrow();
  });

  it("templates getter returns all registered templates", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    sys.addTemplate(banditTemplate);
    expect(sys.templates).toHaveLength(2);
    expect(sys.templates.map((t) => t.id)).toContain("wolves");
    expect(sys.templates.map((t) => t.id)).toContain("bandits");
  });

  it("clear() removes all templates", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    sys.addTemplate(banditTemplate);
    sys.clear();
    expect(sys.templates).toHaveLength(0);
  });
});

// ── Tests: triggerEncounter ───────────────────────────────────────────────────

describe("EncounterSystem — triggerEncounter", () => {
  it("triggers an encounter and fires onEncounterStarted", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate);

    const result = sys.triggerEncounter("wolves", makeCtx(), rngAlwaysMin);
    expect(result).not.toBeNull();
    expect(result?.templateId).toBe("wolves");
    expect(result?.tableId).toBe("forest_wolves");
    expect(cb).toHaveBeenCalledWith(result);
  });

  it("returns null for an unknown template id", () => {
    const sys = new EncounterSystem();
    const result = sys.triggerEncounter("ghost", makeCtx());
    expect(result).toBeNull();
  });

  it("resolves count using minCount when rng returns 0", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    const result = sys.triggerEncounter("wolves", makeCtx(), rngAlwaysMin);
    expect(result?.count).toBe(2); // minCount
  });

  it("resolves count using maxCount when rng returns ~1", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    const result = sys.triggerEncounter("wolves", makeCtx(), rngAlwaysMax);
    expect(result?.count).toBe(4); // maxCount
  });

  it("defaults to count 1 when minCount / maxCount are absent", () => {
    const sys = new EncounterSystem();
    sys.addTemplate({
      id: "rat",
      label: "Rat",
      tableId: "rat_table",
      cooldownHours: 0,
    });
    const result = sys.triggerEncounter("rat", makeCtx(), rngAlwaysMin);
    expect(result?.count).toBe(1);
  });

  it("records lastTriggeredAt after a trigger", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 8 }));
    expect(sys.getLastTriggeredAt("wolves")).toBe(8);
  });

  it("increments triggerCount after each successful trigger", () => {
    const sys = new EncounterSystem();
    sys.addTemplate({ ...wolfTemplate, cooldownHours: 0 });
    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 1 }));
    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 2 }));
    expect(sys.getTriggerCount("wolves")).toBe(2);
  });

  it("captures playerLevel in the result", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    const result = sys.triggerEncounter("wolves", makeCtx({ playerLevel: 7 }));
    expect(result?.playerLevel).toBe(7);
  });

  it("defaults playerLevel to 1 when context omits it", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    const result = sys.triggerEncounter("wolves", { gameTimeHours: 12 });
    expect(result?.playerLevel).toBe(1);
  });
});

// ── Tests: Cooldown ───────────────────────────────────────────────────────────

describe("EncounterSystem — cooldown", () => {
  it("does not re-trigger before cooldown elapses", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate); // cooldown 2h

    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 1 }));
    const result = sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 2 })); // only 1h elapsed
    expect(result).toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("re-triggers after cooldown elapses", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate); // cooldown 2h

    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 1 }));
    const result = sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 3 })); // 2h elapsed
    expect(result).not.toBeNull();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("zero cooldown allows repeated triggers", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate({ ...wolfTemplate, cooldownHours: 0 });

    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 1 }));
    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 1 }));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("handles cooldown wrap across midnight", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate); // cooldown 2h

    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 23 }));
    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 0.5 })); // only 1.5h wrapped
    expect(cb).toHaveBeenCalledTimes(1);

    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 1.5 })); // 2.5h elapsed
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

// ── Tests: Level gate ─────────────────────────────────────────────────────────

describe("EncounterSystem — level gate", () => {
  it("does not trigger when player is below minLevel", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(bossTemplate); // minLevel 10

    const result = sys.triggerEncounter("dragon", makeCtx({ playerLevel: 9 }));
    expect(result).toBeNull();
  });

  it("triggers when player meets minLevel", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(bossTemplate); // minLevel 10

    const result = sys.triggerEncounter("dragon", makeCtx({ playerLevel: 10 }));
    expect(result).not.toBeNull();
  });

  it("does not trigger when player exceeds maxLevel", () => {
    const sys = new EncounterSystem();
    sys.addTemplate({
      ...wolfTemplate,
      minLevel: 1,
      maxLevel: 5,
    });

    const result = sys.triggerEncounter("wolves", makeCtx({ playerLevel: 6 }));
    expect(result).toBeNull();
  });

  it("triggers when player is within minLevel–maxLevel range", () => {
    const sys = new EncounterSystem();
    sys.addTemplate({
      ...wolfTemplate,
      minLevel: 1,
      maxLevel: 10,
    });

    const result = sys.triggerEncounter("wolves", makeCtx({ playerLevel: 5 }));
    expect(result).not.toBeNull();
  });
});

// ── Tests: update() auto-scheduling ──────────────────────────────────────────

describe("EncounterSystem — update()", () => {
  it("auto-triggers a template whose biome is active", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate);

    const fired = sys.update(makeCtx(), ["forest"]);
    expect(fired).toHaveLength(1);
    expect(fired[0].templateId).toBe("wolves");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not auto-trigger when no active biome matches", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate);

    const fired = sys.update(makeCtx(), ["desert"]);
    expect(fired).toHaveLength(0);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not auto-trigger a template with no biomeIds", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate({ ...wolfTemplate, biomeIds: [] });

    const fired = sys.update(makeCtx(), ["forest"]);
    expect(fired).toHaveLength(0);
  });

  it("can trigger multiple templates in one update", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate);       // biome: forest
    sys.addTemplate({ ...banditTemplate, biomeIds: ["forest"] }); // also forest

    const fired = sys.update(makeCtx(), ["forest"]);
    expect(fired).toHaveLength(2);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("respects spawnChance — never fires when chance is 0", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate({ ...wolfTemplate, spawnChance: 0 });

    const fired = sys.update(makeCtx(), ["forest"], () => 0.5);
    expect(fired).toHaveLength(0);
  });

  it("respects spawnChance — always fires when chance is 1.0", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate({ ...wolfTemplate, spawnChance: 1.0 });

    const fired = sys.update(makeCtx(), ["forest"], () => 0.5);
    expect(fired).toHaveLength(1);
  });

  it("respects cooldown in update()", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate); // cooldown 2h

    sys.update(makeCtx({ gameTimeHours: 1 }), ["forest"]);
    sys.update(makeCtx({ gameTimeHours: 2 }), ["forest"]); // only 1h elapsed
    expect(cb).toHaveBeenCalledTimes(1);

    sys.update(makeCtx({ gameTimeHours: 3 }), ["forest"]); // 2h elapsed
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

// ── Tests: getTemplatesForBiome ───────────────────────────────────────────────

describe("EncounterSystem — getTemplatesForBiome", () => {
  it("returns templates registered for a biome", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);    // biome: forest
    sys.addTemplate(banditTemplate);  // biomes: plains, road

    expect(sys.getTemplatesForBiome("forest").map((t) => t.id)).toEqual(["wolves"]);
    expect(sys.getTemplatesForBiome("plains").map((t) => t.id)).toEqual(["bandits"]);
  });

  it("returns empty array for an unregistered biome", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    expect(sys.getTemplatesForBiome("desert")).toHaveLength(0);
  });

  it("returns multiple templates for a shared biome", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    sys.addTemplate({ ...banditTemplate, biomeIds: ["forest"] });
    expect(sys.getTemplatesForBiome("forest")).toHaveLength(2);
  });
});

// ── Tests: getEligibleTemplates ───────────────────────────────────────────────

describe("EncounterSystem — getEligibleTemplates", () => {
  it("returns templates that are off-cooldown and within level range", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);   // level unrestricted
    sys.addTemplate(bossTemplate);   // minLevel 10

    const eligible = sys.getEligibleTemplates(makeCtx({ playerLevel: 5 }));
    expect(eligible.map((t) => t.id)).toContain("wolves");
    expect(eligible.map((t) => t.id)).not.toContain("dragon");
  });

  it("does not return templates still on cooldown", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate); // cooldown 2h

    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 1 }));
    const eligible = sys.getEligibleTemplates(makeCtx({ gameTimeHours: 2 }));
    expect(eligible).toHaveLength(0);
  });

  it("does not fire onEncounterStarted when querying eligibility", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate);

    sys.getEligibleTemplates(makeCtx());
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── Tests: Snapshot / restore ─────────────────────────────────────────────────

describe("EncounterSystem — snapshot / restore", () => {
  it("getSnapshot captures lastTriggeredAt and triggerCount", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 6 }));
    const snap = sys.getSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]).toEqual({ id: "wolves", lastTriggeredAt: 6, triggerCount: 1 });
  });

  it("getSnapshot returns null lastTriggeredAt for untriggered templates", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    const snap = sys.getSnapshot();
    expect(snap[0].lastTriggeredAt).toBeNull();
    expect(snap[0].triggerCount).toBe(0);
  });

  it("restoreSnapshot rehydrates lastTriggeredAt and triggerCount", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate);
    const snapshots: EncounterSnapshot[] = [
      { id: "wolves", lastTriggeredAt: 10, triggerCount: 3 },
    ];
    sys.restoreSnapshot(snapshots);
    expect(sys.getLastTriggeredAt("wolves")).toBe(10);
    expect(sys.getTriggerCount("wolves")).toBe(3);
  });

  it("restoreSnapshot ignores unknown ids", () => {
    const sys = new EncounterSystem();
    expect(() =>
      sys.restoreSnapshot([{ id: "ghost", lastTriggeredAt: 5, triggerCount: 1 }])
    ).not.toThrow();
  });

  it("does not fire onEncounterStarted during restore", () => {
    const sys = new EncounterSystem();
    const cb = vi.fn();
    sys.onEncounterStarted = cb;
    sys.addTemplate(wolfTemplate);
    sys.restoreSnapshot([{ id: "wolves", lastTriggeredAt: 3, triggerCount: 2 }]);
    expect(cb).not.toHaveBeenCalled();
  });

  it("restored cooldown prevents immediate re-trigger", () => {
    const sys = new EncounterSystem();
    sys.addTemplate(wolfTemplate); // cooldown 2h
    sys.restoreSnapshot([{ id: "wolves", lastTriggeredAt: 11, triggerCount: 1 }]);
    const result = sys.triggerEncounter("wolves", makeCtx({ gameTimeHours: 12 })); // only 1h elapsed
    expect(result).toBeNull();
  });

  it("round-trips snapshot through addTemplate + restoreSnapshot", () => {
    const sys1 = new EncounterSystem();
    sys1.addTemplate({ ...wolfTemplate, cooldownHours: 0 });
    sys1.triggerEncounter("wolves", makeCtx({ gameTimeHours: 4 }));
    sys1.triggerEncounter("wolves", makeCtx({ gameTimeHours: 5 }));
    const snap = sys1.getSnapshot();

    const sys2 = new EncounterSystem();
    sys2.addTemplate({ ...wolfTemplate, cooldownHours: 0 });
    sys2.restoreSnapshot(snap);

    expect(sys2.getTriggerCount("wolves")).toBe(sys1.getTriggerCount("wolves"));
    expect(sys2.getLastTriggeredAt("wolves")).toBe(sys1.getLastTriggeredAt("wolves"));
  });
});
