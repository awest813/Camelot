/**
 * Gamepad support loads when the first gamepad connects (most players never
 * use one), keeping it out of the start-up bundle.  The system then follows
 * connects and disconnects itself.  A pad already plugged in reports itself
 * on its first button press.
 */
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import type { BabylonInputAdapter } from "../adapters/babylon/babylon-input-adapter";
import type { GamepadInputSystem } from "./gamepad-input-system";

export function loadGamepadOnConnect(
  adapter: BabylonInputAdapter,
  camera: () => UniversalCamera,
  ready: (pad: GamepadInputSystem) => void,
): void {
  if (typeof window === "undefined") return;
  const onPad = (e: GamepadEvent) => {
    window.removeEventListener("gamepadconnected", onPad);
    void import("./gamepad-input-system").then(({ GamepadInputSystem }) => {
      const pad = new GamepadInputSystem(adapter);
      pad.setCamera(camera());
      pad.connect();
      pad.adopt(e.gamepad.index);
      ready(pad);
    });
  };
  window.addEventListener("gamepadconnected", onPad);
}
