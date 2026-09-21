import { describe, it, expect } from "vitest";
import { VoronoiWorldGraph, type WorldSettlement } from "./voronoi-world";

describe("VoronoiWorldGraph — Seeded Settlement Generation", () => {
  it("places capital at origin (0, 0) and generates requested settlement count", () => {
    const settlements = VoronoiWorldGraph.generateSeededSettlements(12345, 7, 5);
    expect(settlements).toHaveLength(5);

    const capital = settlements[0];
    expect(capital.cx).toBe(0);
    expect(capital.cz).toBe(0);
    expect(capital.type).toBe("capital");
    expect(capital.name).toBe("Camelot");
  });

  it("produces deterministic settlements for the same seed", () => {
    const setA = VoronoiWorldGraph.generateSeededSettlements(777, 8, 6);
    const setB = VoronoiWorldGraph.generateSeededSettlements(777, 8, 6);

    expect(setA).toEqual(setB);
  });
});

describe("VoronoiWorldGraph — Triangulation & Voronoi Provinces", () => {
  it("builds road network and Voronoi province polygons from settlements", () => {
    const settlements: WorldSettlement[] = [
      { id: "s1", name: "Alpha", type: "capital", cx: 0, cz: 0, faction: "crown" },
      { id: "s2", name: "Beta", type: "town", cx: 4, cz: 0, faction: "crown" },
      { id: "s3", name: "Gamma", type: "castle", cx: 0, cz: 4, faction: "knights" },
      { id: "s4", name: "Delta", type: "shrine", cx: 4, cz: 4, faction: "druids" },
    ];

    const graph = new VoronoiWorldGraph(settlements);

    expect(graph.roads.length).toBeGreaterThanOrEqual(4);
    for (const road of graph.roads) {
      expect(road.distance).toBeGreaterThan(0);
      expect(road.fromId).not.toBe(road.toId);
    }

    expect(graph.provinces).toHaveLength(4);
    for (const province of graph.provinces) {
      expect(province.name).toContain("Province of");
      expect(province.color).toBeDefined();
    }
  });

  it("handles small settlement sets gracefully without crashing", () => {
    const graph = new VoronoiWorldGraph([
      { id: "s1", name: "Solo", type: "town", cx: 0, cz: 0, faction: "crown" },
    ]);
    expect(graph.roads).toHaveLength(0);
    expect(graph.provinces).toHaveLength(0);
  });
});

describe("VoronoiWorldGraph — Route Finding", () => {
  it("finds the shortest path between settlements on the road graph", () => {
    const settlements: WorldSettlement[] = [
      { id: "a", name: "Castle A", type: "castle", cx: 0, cz: 0, faction: "crown" },
      { id: "b", name: "Town B", type: "town", cx: 3, cz: 0, faction: "crown" },
      { id: "c", name: "Outpost C", type: "outpost", cx: 6, cz: 0, faction: "crown" },
    ];

    const graph = new VoronoiWorldGraph(settlements);
    // Add linear roads connecting A -> B -> C
    graph.roads = [
      { fromId: "a", toId: "b", distance: 3 },
      { fromId: "b", toId: "c", distance: 3 },
    ];

    const route = graph.findShortestRoute("a", "c");
    expect(route).toEqual(["a", "b", "c"]);
  });

  it("returns single element if start and end are identical", () => {
    const graph = new VoronoiWorldGraph();
    expect(graph.findShortestRoute("same", "same")).toEqual(["same"]);
  });
});
