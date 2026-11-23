import { describe, it, expect } from "vitest";
import { CameraDirector, DeathCamera, DEATH_ROLL, type CameraShot } from "./camera-director";

const shot = (id: string, on: () => boolean, log: string[]): CameraShot => ({
  id, get active() { return on(); }, update: () => log.push(id),
});

describe("CameraDirector", () => {
  it("the highest active shot drives; otherwise the player's own view", () => {
    const log: string[] = [];
    let talking = false, dead = false;
    const d = new CameraDirector();
    d.add(shot("dialogue", () => talking, log));
    d.add(shot("death", () => dead, log));
    expect(d.current).toBe("gameplay");
    talking = true;
    d.update(0.016);
    dead = true;
    d.update(0.016);
    expect(d.current).toBe("death");
    dead = false;
    d.update(0.016);
    expect(log).toEqual(["dialogue", "death", "dialogue"]);
  });
});

describe("DeathCamera", () => {
  it("sags and rolls while down, then eases back upright and lets go", () => {
    const view = { rotation: { x: 0.1, z: 0 } };
    const cam = new DeathCamera(() => view);
    cam.fall();
    for (let i = 0; i < 300; i++) cam.update(1 / 60);
    expect(view.rotation.z).toBeCloseTo(DEATH_ROLL, 2);
    expect(view.rotation.x).toBeGreaterThan(0.5);
    cam.rise();
    for (let i = 0; i < 300 && cam.active; i++) cam.update(1 / 60);
    expect(cam.active).toBe(false);
    expect(view.rotation.z).toBe(0);
    expect(view.rotation.x).toBeCloseTo(0.1, 5);
  });
});
