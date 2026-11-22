import { describe, it, expect } from "vitest";
import {
  DialogueCamera,
  dialogueFov,
  lookAngles,
  DIALOGUE_FRAME_HEIGHT,
  DIALOGUE_MIN_FOV,
  DIALOGUE_FACE_LIFT,
} from "./dialogue-camera";

function view(fov = 0.9) {
  return { fov, rotation: { x: 0, y: 0 }, position: { x: 0, y: 1.7, z: 0 } };
}

const run = (cam: DialogueCamera, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) cam.update(1 / 60);
};

describe("dialogueFov", () => {
  it("frames head and shoulders, never wider than normal or tighter than the floor", () => {
    const fov = dialogueFov(2, 0.9);
    expect(2 * 2 * Math.tan(fov / 2)).toBeCloseTo(DIALOGUE_FRAME_HEIGHT, 5);
    expect(dialogueFov(0.4, 0.9)).toBe(0.9);          // right up close: no zoom
    expect(dialogueFov(50, 0.9)).toBe(DIALOGUE_MIN_FOV);
  });
});

describe("lookAngles", () => {
  it("uses the free-camera convention (yaw 0 = +Z, positive pitch looks down)", () => {
    const from = { x: 0, y: 1.7, z: 0 };
    expect(lookAngles(from, { x: 0, y: 1.7, z: 5 }).yaw).toBeCloseTo(0);
    expect(lookAngles(from, { x: 5, y: 1.7, z: 0 }).yaw).toBeCloseTo(Math.PI / 2);
    expect(lookAngles(from, { x: 0, y: 0.7, z: 1 }).pitch).toBeGreaterThan(0);
  });
});

describe("DialogueCamera", () => {
  it("turns to the speaker's face and zooms in, then eases the zoom back out", () => {
    const v = view();
    const cam = new DialogueCamera();
    const head = { x: 2, y: 1.6, z: 2 };
    cam.begin(v, () => head);
    expect(cam.phase).toBe("in");
    run(cam, 1);
    const want = lookAngles(v.position, { ...head, y: head.y - DIALOGUE_FRAME_HEIGHT * DIALOGUE_FACE_LIFT });
    expect(v.rotation.y).toBeCloseTo(want.yaw, 3);
    expect(v.rotation.x).toBeCloseTo(want.pitch, 3);
    expect(v.fov).toBeCloseTo(dialogueFov(want.distance, 0.9), 3);
    expect(v.fov).toBeLessThan(0.9);

    cam.end();
    expect(cam.phase).toBe("out");
    const yawWhenDone = v.rotation.y;
    run(cam, 1);
    expect(v.fov).toBe(0.9);
    expect(cam.phase).toBe("idle");
    expect(v.rotation.y, "left facing the speaker").toBe(yawWhenDone);
  });

  it("takes the short way round when turning", () => {
    const v = view();
    v.rotation.y = Math.PI - 0.1;                       // facing almost -Z
    const cam = new DialogueCamera();
    cam.begin(v, () => ({ x: -0.3, y: 1.7, z: -5 }));    // just past ±π
    cam.update(1 / 60);
    expect(v.rotation.y).toBeGreaterThan(Math.PI - 0.1); // turned through π, not back through 0
  });

  it("keeps the original FOV when a new conversation starts during the ease-out", () => {
    const v = view(1.0);
    const cam = new DialogueCamera();
    cam.begin(v, () => ({ x: 0, y: 1.6, z: 3 }));
    run(cam, 1);
    cam.end();
    cam.update(1 / 60);                                  // part-way back out
    cam.begin(v, () => ({ x: 0, y: 1.6, z: 3 }));
    expect(cam.baseFov).toBe(1.0);
    cam.reset();
    expect(v.fov).toBe(1.0);
    expect(cam.phase).toBe("idle");
  });

  it("holds the framing while the focus is unavailable", () => {
    const v = view();
    const cam = new DialogueCamera();
    cam.begin(v, () => null);
    run(cam, 0.5);
    expect(v.fov).toBe(0.9);
    expect(v.rotation.y).toBe(0);
  });
});
