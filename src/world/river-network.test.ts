import { describe, it, expect } from "vitest";
import { RiverNetworkGenerator } from "./river-network";
import { SimplexTerrainGenerator } from "./simplex-terrain";

describe("RiverNetworkGenerator", () => {
  const mockElevationSlope = (cx: number, cz: number) => {
    // Slopes downhill from south-east (+cz, +cx) to north-west (-cz, -cx)
    return (cx + cz) * 0.1;
  };

  it("initializes with default and custom configurations", () => {
    const net = new RiverNetworkGenerator({ seed: "Avalon" });
    expect(net.seed).toBeTypeOf("number");
    expect(net.minFlowThreshold).toBe(3);
    expect(net.sourceElevationMin).toBe(0.15);
    expect(net.seaLevel).toBe(-0.15);
  });

  it("is fully deterministic for identical seeds and bounds", () => {
    const genA = new RiverNetworkGenerator({ seed: 12345 });
    const genB = new RiverNetworkGenerator({ seed: 12345 });

    const terrain = new SimplexTerrainGenerator(12345);
    const elev = (cx: number, cz: number) => terrain.getHeightAt(cx * 16, cz * 16);

    const resA = genA.generate(-10, 10, -10, 10, elev);
    const resB = genB.generate(-10, 10, -10, 10, elev);

    expect(resA.rivers.length).toBe(resB.rivers.length);
    expect(resA.lakes.length).toBe(resB.lakes.length);
    if (resA.rivers.length > 0) {
      expect(resA.rivers[0].name).toBe(resB.rivers[0].name);
      expect(resA.rivers[0].waypoints.length).toBe(resB.rivers[0].waypoints.length);
    }
  });

  it("downhill flow moves towards lower or equal elevation", () => {
    const gen = new RiverNetworkGenerator({ seed: 999, minFlowThreshold: 2, sourceElevationMin: 0 });
    const { rivers } = gen.generate(-5, 5, -5, 5, mockElevationSlope);

    for (const river of rivers) {
      expect(river.waypoints.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < river.waypoints.length; i++) {
        const prev = river.waypoints[i - 1];
        const curr = river.waypoints[i];
        // Elevation must decrease or stay equal downhill
        expect(curr.elevation).toBeLessThanOrEqual(prev.elevation);
      }
    }
  });

  it("accumulates flow downstream", () => {
    const gen = new RiverNetworkGenerator({ seed: 999, minFlowThreshold: 2, sourceElevationMin: 0 });
    const { rivers } = gen.generate(-5, 5, -5, 5, mockElevationSlope);

    for (const river of rivers) {
      // Flow volume should increase or remain constant as tributaries merge downstream
      for (let i = 1; i < river.waypoints.length; i++) {
        expect(river.waypoints[i].flow).toBeGreaterThanOrEqual(river.waypoints[i - 1].flow);
      }
    }
  });

  it("identifies inland depressions as lake basins", () => {
    // Create an artificial basin / crater in the center (cx=0, cz=0) surrounded by high rim
    const craterElevation = (cx: number, cz: number) => {
      const dist = Math.hypot(cx, cz);
      if (dist === 0) return 0.1; // basin floor (above sea level)
      return 0.1 + dist * 0.2; // rising crater walls
    };

    const gen = new RiverNetworkGenerator({ seed: 777 });
    const { lakes } = gen.generate(-4, 4, -4, 4, craterElevation);

    expect(lakes.length).toBeGreaterThanOrEqual(1);
    const centerLake = lakes.find((l) => l.cx === 0 && l.cz === 0);
    expect(centerLake).toBeDefined();
    expect(centerLake?.waterFlow).toBeGreaterThanOrEqual(2);
    expect(centerLake?.name).toBeTruthy();
  });

  it("provides water info queries via getWaterInfoAt", () => {
    const gen = new RiverNetworkGenerator({ seed: 555, minFlowThreshold: 2, sourceElevationMin: 0 });
    const { rivers } = gen.generate(-5, 5, -5, 5, mockElevationSlope);

    if (rivers.length > 0) {
      const wp = rivers[0].waypoints[0];
      const info = gen.getWaterInfoAt(wp.cx, wp.cz);
      expect(info.isWater).toBe(true);
      expect(info.flow).toBeGreaterThan(0);
      expect(info.name).toBe(rivers[0].name);
    }

    // Unsampled or dry cell
    const dryInfo = gen.getWaterInfoAt(999, 999);
    expect(dryInfo.isWater).toBe(false);
    expect(dryInfo.flow).toBe(0);
  });
});
