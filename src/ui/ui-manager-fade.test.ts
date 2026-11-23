import { describe, it, expect, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { UIManager } from "./ui-manager";

describe("UIManager.playScreenFadeSequence", () => {
  it("still moves the player when one slow frame steps past the whole hold", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const ui = new UIManager(scene);
    vi.spyOn(engine, "getDeltaTime").mockReturnValue(1000); // a 1 fps frame
    const onBlack = vi.fn(), onComplete = vi.fn();
    ui.playScreenFadeSequence({ fadeOutMs: 400, holdMs: 120, fadeInMs: 450, onBlack, onComplete });
    scene.onBeforeRenderObservable.notifyObservers(scene);
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(onBlack).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(ui.isScreenFadeActive).toBe(false);
  });
});
