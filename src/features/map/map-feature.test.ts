import { describe, expect, it, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FastTravelKey, GameplayKey, ModalKey, PlayerKey, WorldInfoKey } from "../services";
import { MapFeature, MapKey } from "./map-feature";
import { project, ZOOM_CHUNKS } from "../../ui/map-panel";

function setup(canAct = true) {
  const k = new Kernel();
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(ModalKey, modal);
  k.services.provide(GameplayKey, { canAct: () => canAct });
  k.services.provide(PlayerKey, { position: () => ({ x: 120, z: -40 }), level: () => 1, heading: () => Math.PI / 2 });
  k.services.provide(WorldInfoKey, {
    chunkSize: 50, biome: (cx) => (cx < 0 ? "forest" : "plains"), pondAt: (cx, cz) => cx === 2 && cz === -1,
    seed: () => null, setSeed: () => {}, loadedChunks: () => 0,
  });
  k.services.provide(FastTravelKey, {
    isDiscovered: () => true, discover: () => true,
    places: () => [{ id: "village_a", name: "Ashford", x: 300, z: 10 }],
  });
  const feature = new MapFeature();
  k.install(feature);
  return { k, modal, map: k.services.get(MapKey), feature };
}

describe("project (world → sheet)", () => {
  it("puts the centre in the middle with north up", () => {
    expect(project({ x: 10, z: 20 }, { x: 10, z: 20 }, 2, 400, 300)).toEqual({ px: 200, py: 150 });
    const east = project({ x: 30, z: 20 }, { x: 10, z: 20 }, 2, 400, 300);
    const north = project({ x: 10, z: 40 }, { x: 10, z: 20 }, 2, 400, 300);
    expect(east.px).toBe(210);
    expect(north.py, "+z is up the page").toBe(140);
  });
  it("zoom levels widen", () => {
    expect([...ZOOM_CHUNKS]).toEqual([...ZOOM_CHUNKS].sort((a, b) => a - b));
  });
});

describe("MapFeature (headless, through the kernel)", () => {
  it("M opens the chart over play (loading it), marks the places and the player; M again closes it", async () => {
    const t = setup();
    t.map.toggle();
    await t.feature.panel.get();
    expect(t.map.isOpen).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
    expect(document.querySelector("#map-title")?.textContent).toBe("Map of the Realm");
    expect(Array.from(document.querySelectorAll(".map-panel__places-btn")).map((b) => b.textContent)).toEqual(["Ashford"]);
    expect(document.querySelector(".map-panel__place")?.getAttribute("aria-label")).toMatch(/^Ashford/);
    const me = document.querySelector<HTMLElement>(".map-panel__me")!;
    expect(me.style.transform).toContain(`rotate(${Math.PI / 2}rad)`);
    expect(document.querySelectorAll(".map-panel__legend li")).toHaveLength(7);
    t.map.toggle();
    expect(t.map.isOpen).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
    t.k.uninstall("map");
  });

  it("the ✕ closes it too; it won't open while play is blocked", async () => {
    const t = setup();
    t.map.toggle();
    await t.feature.panel.get();
    (document.querySelector(".map-panel .graphics-settings__close") as HTMLButtonElement).click();
    expect(t.map.isOpen).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
    t.k.uninstall("map");

    const u = setup(false);
    u.map.toggle();
    expect(u.map.isOpen).toBe(false);
    expect(u.modal.suspendGameplay).not.toHaveBeenCalled();
    u.k.uninstall("map");
  });
});

describe("map labels", () => {
  it("go beside their mark where nothing else is, and are left off with no room", async () => {
    const { labelSpots } = await import("../../ui/map-panel");
    const out = labelSpots([
      { id: "a", name: "Ashcombe Roost", px: 100, py: 100 },
      { id: "b", name: "Ashcombe Manor", px: 102, py: 104 },
      { id: "c", name: "Far Away", px: 400, py: 100 },
    ]);
    expect(out.get("a")).toEqual({ side: "right", dy: 0 });
    expect(out.get("b"), "a's label is taken: the next line").toEqual({ side: "right", dy: 16 });
    expect(out.get("c")).toEqual({ side: "right", dy: 0 });
    // Seven marks on one spot: the six spots fill, the seventh goes without.
    const crowd = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: "Place", px: 300, py: 300 + i * 0.1 }));
    const spots = labelSpots(crowd);
    expect([...spots.values()].filter((v) => v === null)).toHaveLength(1);
  });
});

describe("map marks", () => {
  it("every landmark kind the world builds has a mark, and villages theirs", async () => {
    const { PLACE_MARKS } = await import("../../ui/map-panel");
    const { WILD_SITES } = await import("../../content/sites");
    for (const spec of WILD_SITES) if (spec.landmark) expect(PLACE_MARKS[spec.id], spec.id).toBeDefined();
    expect(PLACE_MARKS.village).toBeDefined();
  });
});
