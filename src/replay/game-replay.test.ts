import { describe, expect, it } from "vitest";
import { GameReplay, REPLAY_LOG_KEY, digestDiff, makeEvent, type GameReplayLog } from "./game-replay";

const fakeEngine = () => ({ getDeltaTime: () => 33, isPointerLock: false }) as never;
const fakeScene = () => ({ useConstantAnimationDeltaTime: false, render: () => {} }) as never;

describe("GameReplay (no scene)", () => {
  it("play mode without a log asks for a log file", () => {
    document.body.innerHTML = "";
    new GameReplay("play", fakeEngine(), fakeScene(), document.createElement("canvas"), null);
    const picker = document.querySelector<HTMLElement>(".replay-pick");
    expect(picker?.getAttribute("role")).toBe("dialog");
    expect(picker?.querySelector("input[type=file]")).not.toBeNull();
  });

  it("playback puts back the storage the recording started with (keeping the log)", () => {
    localStorage.clear();
    localStorage.setItem("stale", "1");
    const log: GameReplayLog = {
      version: 1, kind: "camelot-game", stepMs: 16, frames: 0, inputs: [],
      choice: { name: "R", raceId: "hillfolk", birthsignId: "sword_stone", classId: "warrior", skipGameplayTips: true, worldSeed: null },
      storage: { camelot_save: '{"version":29}' },
    };
    localStorage.setItem(REPLAY_LOG_KEY, JSON.stringify(log));
    const engine = fakeEngine();
    new GameReplay("play", engine, fakeScene(), document.createElement("canvas"), log);
    expect(localStorage.getItem("stale")).toBeNull();
    expect(localStorage.getItem("camelot_save")).toBe('{"version":29}');
    expect(localStorage.getItem(REPLAY_LOG_KEY), "the log stays").not.toBeNull();
    expect((engine as { getDeltaTime(): number }).getDeltaTime(), "fixed frame step").toBe(16);
  });

  it("synthetic key events carry keyCode (Babylon's camera reads it)", () => {
    const ev = makeEvent("keydown", { key: "w", code: "KeyW", keyCode: 87, which: 87 }) as KeyboardEvent;
    expect([ev.key, ev.keyCode, ev.which, ev.bubbles]).toEqual(["w", 87, 87, true]);
  });

  it("digestDiff names the first difference", () => {
    expect(digestDiff({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBeNull();
    expect(digestDiff({ a: { b: [1, 2] } }, { a: { b: [1, 3] } })).toBe("a.b.1: 2 ≠ 3");
  });
});
