// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CharacterCreationUI, type CharacterCreationResult } from "./character-creation-ui";
import { WorldSeed } from "../world/world-seed";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run the UI through every step and resolve with the given seed input. */
async function completeFlow(opts: {
  seedInput?: string;
  worldType?: string;
  biomeScale?: string;
  structureDensity?: string;
  startingBiome?: string;
} = {}): Promise<CharacterCreationResult> {
  const ui = new CharacterCreationUI();
  const promise = ui.open();

  // Step 1 – Welcome: click Continue
  const continueBtn = () =>
    document.querySelector<HTMLButtonElement>(".character-create__button:not(.character-create__button--secondary)")!;

  continueBtn().click();
  await Promise.resolve(); // flush microtasks

  // Step 2 – World: optionally fill seed and selects
  if (opts.seedInput !== undefined) {
    const seedInput = document.querySelector<HTMLInputElement>("#world-seed-input")!;
    seedInput.value = opts.seedInput;
    seedInput.dispatchEvent(new Event("input"));
  }
  if (opts.worldType !== undefined) {
    const sel = document.querySelector<HTMLSelectElement>("#world-type-select")!;
    sel.value = opts.worldType;
    sel.dispatchEvent(new Event("change"));
  }
  if (opts.biomeScale !== undefined) {
    const sel = document.querySelector<HTMLSelectElement>("#biome-scale-select")!;
    sel.value = opts.biomeScale;
    sel.dispatchEvent(new Event("change"));
  }
  if (opts.structureDensity !== undefined) {
    const sel = document.querySelector<HTMLSelectElement>("#structure-density-select")!;
    sel.value = opts.structureDensity;
    sel.dispatchEvent(new Event("change"));
  }
  if (opts.startingBiome !== undefined) {
    const sel = document.querySelector<HTMLSelectElement>("#starting-biome-select")!;
    sel.value = opts.startingBiome;
    sel.dispatchEvent(new Event("change"));
  }
  continueBtn().click();
  await Promise.resolve();

  // Step 3 – Name
  const nameInput = document.querySelector<HTMLInputElement>(".character-create__name-input")!;
  nameInput.value = "Arion";
  nameInput.dispatchEvent(new Event("input"));
  continueBtn().click();
  await Promise.resolve();

  // Step 4 – Race: pick first card
  document.querySelector<HTMLButtonElement>(".character-create__card")!.click();
  continueBtn().click();
  await Promise.resolve();

  // Step 5 – Birthsign: pick first card
  document.querySelector<HTMLButtonElement>(".character-create__card")!.click();
  continueBtn().click();
  await Promise.resolve();

  // Step 6 – Class: pick first card, then Begin adventure
  document.querySelector<HTMLButtonElement>(".character-create__card")!.click();
  continueBtn().click();

  return promise;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CharacterCreationUI", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    // Ensure Math.random is predictable only where needed
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  // ── DOM structure ──────────────────────────────────────────────────────────

  describe("initial render", () => {
    it("mounts the root element on open()", () => {
      const ui = new CharacterCreationUI();
      ui.open();
      expect(document.querySelector(".character-create")).not.toBeNull();
    });

    it("root has role=dialog", () => {
      const ui = new CharacterCreationUI();
      ui.open();
      expect(document.querySelector(".character-create")?.getAttribute("role")).toBe("dialog");
    });

    it("root has aria-modal=true", () => {
      const ui = new CharacterCreationUI();
      ui.open();
      expect(document.querySelector(".character-create")?.getAttribute("aria-modal")).toBe("true");
    });

    it("shows 'Begin Your Journey' title", () => {
      const ui = new CharacterCreationUI();
      ui.open();
      const title = document.querySelector(".character-create__title");
      expect(title?.textContent).toBe("Begin Your Journey");
    });

    it("renders six step pills including World", () => {
      const ui = new CharacterCreationUI();
      ui.open();
      const pills = document.querySelectorAll(".character-create__step-pill");
      expect(pills.length).toBe(6);
      const labels = Array.from(pills).map((p) => p.textContent);
      expect(labels).toContain("World");
    });

    it("Welcome pill is active on open", () => {
      const ui = new CharacterCreationUI();
      ui.open();
      const activePill = document.querySelector(".character-create__step-pill.is-active");
      expect(activePill?.textContent).toBe("Welcome");
    });
  });

  // ── World step rendering ───────────────────────────────────────────────────

  describe("World step", () => {
    async function openWorldStep() {
      const ui = new CharacterCreationUI();
      ui.open();
      const continueBtn = document.querySelector<HTMLButtonElement>(
        ".character-create__button:not(.character-create__button--secondary)",
      )!;
      continueBtn.click();
      await Promise.resolve();
    }

    it("navigates to World step when Continue is clicked from Welcome", async () => {
      await openWorldStep();
      const activePill = document.querySelector(".character-create__step-pill.is-active");
      expect(activePill?.textContent).toBe("World");
    });

    it("renders a seed text input", async () => {
      await openWorldStep();
      expect(document.querySelector("#world-seed-input")).not.toBeNull();
    });

    it("renders the Randomize button", async () => {
      await openWorldStep();
      expect(document.querySelector(".character-create__world-random-btn")).not.toBeNull();
    });

    it("renders world type select with four options", async () => {
      await openWorldStep();
      const sel = document.querySelector<HTMLSelectElement>("#world-type-select")!;
      expect(sel).not.toBeNull();
      expect(sel.options.length).toBe(4);
    });

    it("world type select contains normal, flat, amplified, island", async () => {
      await openWorldStep();
      const sel = document.querySelector<HTMLSelectElement>("#world-type-select")!;
      const values = Array.from(sel.options).map((o) => o.value);
      expect(values).toEqual(expect.arrayContaining(["normal", "flat", "amplified", "island"]));
    });

    it("biome scale select defaults to medium", async () => {
      await openWorldStep();
      const sel = document.querySelector<HTMLSelectElement>("#biome-scale-select")!;
      expect(sel.value).toBe("medium");
    });

    it("biome scale select contains four options", async () => {
      await openWorldStep();
      const sel = document.querySelector<HTMLSelectElement>("#biome-scale-select")!;
      expect(sel.options.length).toBe(4);
    });

    it("structure density select defaults to normal", async () => {
      await openWorldStep();
      const sel = document.querySelector<HTMLSelectElement>("#structure-density-select")!;
      expect(sel.value).toBe("normal");
    });

    it("structure density select contains four options", async () => {
      await openWorldStep();
      const sel = document.querySelector<HTMLSelectElement>("#structure-density-select")!;
      expect(sel.options.length).toBe(4);
    });

    it("starting biome select has a blank/random option", async () => {
      await openWorldStep();
      const sel = document.querySelector<HTMLSelectElement>("#starting-biome-select")!;
      const hasBlank = Array.from(sel.options).some((o) => o.value === "");
      expect(hasBlank).toBe(true);
    });

    it("starting biome select contains plains, forest, desert, tundra", async () => {
      await openWorldStep();
      const sel = document.querySelector<HTMLSelectElement>("#starting-biome-select")!;
      const values = Array.from(sel.options).map((o) => o.value);
      expect(values).toEqual(expect.arrayContaining(["plains", "forest", "desert", "tundra"]));
    });

    it("Randomize button fills the seed input with a numeric value", async () => {
      await openWorldStep();
      const btn = document.querySelector<HTMLButtonElement>(".character-create__world-random-btn")!;
      btn.click();
      const seedInput = document.querySelector<HTMLInputElement>("#world-seed-input")!;
      expect(seedInput.value).toMatch(/^\d+$/);
    });

    it("Back button returns to Welcome step from World step", async () => {
      await openWorldStep();
      const backBtn = document.querySelector<HTMLButtonElement>(".character-create__button--secondary")!;
      backBtn.click();
      const activePill = document.querySelector(".character-create__step-pill.is-active");
      expect(activePill?.textContent).toBe("Welcome");
    });

    it("World pill is active on the World step", async () => {
      await openWorldStep();
      const activePill = document.querySelector(".character-create__step-pill.is-active");
      expect(activePill?.textContent).toBe("World");
    });
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  describe("step navigation", () => {
    it("flows Welcome → World → Name when Continue is clicked twice", async () => {
      const ui = new CharacterCreationUI();
      ui.open();
      const continueBtn = () =>
        document.querySelector<HTMLButtonElement>(
          ".character-create__button:not(.character-create__button--secondary)",
        )!;

      continueBtn().click();
      await Promise.resolve();
      expect(document.querySelector(".character-create__step-pill.is-active")?.textContent).toBe("World");

      continueBtn().click();
      await Promise.resolve();
      expect(document.querySelector(".character-create__step-pill.is-active")?.textContent).toBe("Name");
    });

    it("Back on Name step goes to World step", async () => {
      const ui = new CharacterCreationUI();
      ui.open();
      const continueBtn = () =>
        document.querySelector<HTMLButtonElement>(
          ".character-create__button:not(.character-create__button--secondary)",
        )!;
      const backBtn = () =>
        document.querySelector<HTMLButtonElement>(".character-create__button--secondary")!;

      continueBtn().click(); // → World
      await Promise.resolve();
      continueBtn().click(); // → Name
      await Promise.resolve();
      backBtn().click(); // → World
      expect(document.querySelector(".character-create__step-pill.is-active")?.textContent).toBe("World");
    });
  });

  // ── Result: worldSeed field ────────────────────────────────────────────────

  describe("CharacterCreationResult.worldSeed", () => {
    it("result includes a WorldSeed instance", async () => {
      const result = await completeFlow({ seedInput: "42" });
      expect(result.worldSeed).toBeInstanceOf(WorldSeed);
    });

    it("worldSeed.seedString matches explicit input", async () => {
      const result = await completeFlow({ seedInput: "hello world" });
      expect(result.worldSeed!.seedString).toBe("hello world");
    });

    it("worldSeed uses a numeric seed verbatim", async () => {
      const result = await completeFlow({ seedInput: "99999" });
      expect(result.worldSeed!.seedValue).toBe(99999);
    });

    it("generates a random seed when input is left blank", async () => {
      const result = await completeFlow({ seedInput: "" });
      expect(result.worldSeed).not.toBeNull();
      // Seed value must be a valid 32-bit non-negative integer
      expect(result.worldSeed!.seedValue).toBeGreaterThanOrEqual(0);
    });

    it("worldSeed.options.worldType reflects the selected world type", async () => {
      const result = await completeFlow({ seedInput: "1", worldType: "island" });
      expect(result.worldSeed!.options.worldType).toBe("island");
    });

    it("worldSeed.options.biomeScale reflects the selected biome scale", async () => {
      const result = await completeFlow({ seedInput: "1", biomeScale: "huge" });
      expect(result.worldSeed!.options.biomeScale).toBe("huge");
    });

    it("worldSeed.options.structureDensity reflects the selected density", async () => {
      const result = await completeFlow({ seedInput: "1", structureDensity: "abundant" });
      expect(result.worldSeed!.options.structureDensity).toBe("abundant");
    });

    it("worldSeed.options.startingBiome is null when 'random' is chosen", async () => {
      const result = await completeFlow({ seedInput: "1", startingBiome: "" });
      expect(result.worldSeed!.options.startingBiome).toBeNull();
    });

    it("worldSeed.options.startingBiome reflects chosen biome pin", async () => {
      const result = await completeFlow({ seedInput: "1", startingBiome: "tundra" });
      expect(result.worldSeed!.options.startingBiome).toBe("tundra");
    });

    it("worldSeed.options default to normal/medium/normal when unchanged", async () => {
      const result = await completeFlow({ seedInput: "1" });
      expect(result.worldSeed!.options.worldType).toBe("normal");
      expect(result.worldSeed!.options.biomeScale).toBe("medium");
      expect(result.worldSeed!.options.structureDensity).toBe("normal");
    });

    it("two flows with the same explicit seed produce the same seedValue", async () => {
      document.body.innerHTML = "";
      const r1 = await completeFlow({ seedInput: "camelot" });
      document.body.innerHTML = "";
      const r2 = await completeFlow({ seedInput: "camelot" });
      expect(r1.worldSeed!.seedValue).toBe(r2.worldSeed!.seedValue);
    });
  });

  // ── Other result fields still work ────────────────────────────────────────

  describe("existing result fields", () => {
    it("result.name is set from name input", async () => {
      const result = await completeFlow({ seedInput: "1" });
      expect(result.name).toBe("Arion");
    });

    it("result.raceId is set", async () => {
      const result = await completeFlow({ seedInput: "1" });
      expect(typeof result.raceId).toBe("string");
      expect(result.raceId.length).toBeGreaterThan(0);
    });

    it("result.birthsignId is set", async () => {
      const result = await completeFlow({ seedInput: "1" });
      expect(typeof result.birthsignId).toBe("string");
      expect(result.birthsignId.length).toBeGreaterThan(0);
    });

    it("result.classId is set", async () => {
      const result = await completeFlow({ seedInput: "1" });
      expect(typeof result.classId).toBe("string");
      expect(result.classId.length).toBeGreaterThan(0);
    });

    it("result.skipGameplayTips defaults to false", async () => {
      const result = await completeFlow({ seedInput: "1" });
      expect(result.skipGameplayTips).toBe(false);
    });
  });

  // ── WorldManager/StructureManager setSeed ─────────────────────────────────

  describe("WorldManager.setSeed / StructureManager.setSeed", () => {
    it("WorldManager exposes a setSeed method", async () => {
      const { WorldManager } = await import("../world/world-manager");
      const wm = new WorldManager(null as never, null);
      expect(typeof wm.setSeed).toBe("function");
    });

    it("WorldManager.setSeed updates getBiome output (flat world returns plains)", async () => {
      const { WorldManager } = await import("../world/world-manager");
      const { WorldSeed: WS } = await import("../world/world-seed");
      const wm = new WorldManager(null as never, null);
      wm.setSeed(new WS("test", { worldType: "flat" }));
      expect(wm.getBiome(0, 0)).toBe("plains");
      expect(wm.getBiome(5, 5)).toBe("plains");
    });

    it("WorldManager.setSeed(null) reverts to unseeded biome logic", async () => {
      const { WorldManager } = await import("../world/world-manager");
      const { WorldSeed: WS } = await import("../world/world-seed");
      const wm = new WorldManager(null as never, null);
      wm.setSeed(new WS("test", { worldType: "flat" }));
      wm.setSeed(null);
      // With no seed the legacy formula is used — result must be a valid biome
      const biome = wm.getBiome(0, 0);
      expect(["plains", "forest", "desert", "tundra"]).toContain(biome);
    });

    it("StructureManager exposes a setSeed method", async () => {
      const { StructureManager } = await import("../world/structure-manager");
      const sm = new StructureManager(null as never, null);
      expect(typeof sm.setSeed).toBe("function");
    });

    it("StructureManager.setSeed with none density suppresses all structures", async () => {
      const { StructureManager } = await import("../world/structure-manager");
      const { WorldSeed: WS } = await import("../world/world-seed");
      const sm = new StructureManager(null as never, null);
      sm.setSeed(new WS("test", { structureDensity: "none" }));
      for (let cx = -5; cx <= 5; cx++) {
        for (let cz = -5; cz <= 5; cz++) {
          expect(sm.hasStructureAt(cx, cz)).toBe(false);
        }
      }
    });
  });
});
