import { describe, it, expect } from "vitest";
import { computeAtmosphere, sunDirection, moonDirection } from "./atmosphere";

describe("atmosphere", () => {
  it("puts the sun high at noon and below the horizon at midnight", () => {
    expect(sunDirection(13).elevation).toBeGreaterThan(0.8);
    expect(sunDirection(0).elevation).toBeLessThan(0);
    expect(sunDirection(6).elevation).toBeCloseTo(0, 2);
    expect(sunDirection(20).elevation).toBeCloseTo(0, 2);
  });

  it("rises in the east and sets in the west", () => {
    expect(sunDirection(7).dir[0]).toBeGreaterThan(0.5);
    expect(sunDirection(19).dir[0]).toBeLessThan(-0.5);
  });

  it("returns unit direction vectors", () => {
    for (let h = 0; h < 24; h += 0.5) {
      const d = sunDirection(h).dir;
      expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 5);
    }
  });

  it("moves continuously through the day", () => {
    let prev = sunDirection(0).dir;
    for (let h = 0.1; h <= 24; h += 0.1) {
      const d = sunDirection(h).dir;
      const step = Math.hypot(d[0] - prev[0], d[1] - prev[1], d[2] - prev[2]);
      expect(step).toBeLessThan(0.2);
      prev = d;
    }
  });

  it("has the moon up around midnight", () => {
    expect(moonDirection(1).elevation).toBeGreaterThan(0.5);
    expect(moonDirection(12).elevation).toBeLessThan(0);
  });

  it("matches fog to the horizon colour", () => {
    const s = computeAtmosphere(10);
    expect(s.fog).toEqual(s.horizon);
  });

  it("is bright by day and dark (but moonlit) by night", () => {
    const day = computeAtmosphere(12);
    const night = computeAtmosphere(1);
    expect(day.lightIntensity).toBeGreaterThan(0.8);
    expect(night.lightIntensity).toBeGreaterThan(0);
    expect(night.lightIntensity).toBeLessThan(0.4);
    expect(night.stars).toBeGreaterThan(0.9);
    expect(day.stars).toBe(0);
    expect(day.horizon[0]).toBeGreaterThan(night.horizon[0]);
  });

  it("always points the light downward", () => {
    for (let h = 0; h < 24; h += 0.25) {
      expect(computeAtmosphere(h).lightDir[1]).toBeLessThan(-0.1);
    }
  });

  it("warms the light near sunset", () => {
    const noon = computeAtmosphere(13).lightColor;
    const dusk = computeAtmosphere(19.6).lightColor;
    expect(dusk[2] / dusk[0]).toBeLessThan(noon[2] / noon[0]);
  });

  it("dims the sun and hides stars under heavy cloud", () => {
    const clear = computeAtmosphere(12, 0);
    const storm = computeAtmosphere(12, 1);
    expect(storm.lightIntensity).toBeLessThan(clear.lightIntensity * 0.5);
    expect(computeAtmosphere(1, 1).stars).toBe(0);
  });
});
