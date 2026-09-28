import type { AdvancedDynamicTexture } from "@babylonjs/gui/2D";

/** The slice of a Babylon engine this helper needs (keeps test mocks small). */
interface ScalingEngineLike {
  getHardwareScalingLevel(): number;
  onResizeObservable?: { add(callback: () => void): unknown };
}

/**
 * Keep a fullscreen GUI rendering at CSS-pixel resolution regardless of the
 * engine's hardware scaling level.
 *
 * The low graphics tier renders the 3D scene at 0.75× (`hardwareScalingLevel`
 * 1.33). A fullscreen ADT sizes itself from the engine's render size, so it
 * inherited that too: every HUD glyph was rasterised at 75 % and upscaled —
 * blurry, and 33 % larger than its layout, which pushed panels sized from
 * `window.innerHeight` off-screen. Setting `renderScale` to the scaling level
 * restores a 1:1 CSS-pixel texture; Babylon's pointer picking already divides
 * by the texture/render-size ratio, so hit-testing stays correct.
 *
 * (`adjustToEngineHardwareScalingLevel` fixes the size but lowers resolution
 * further when the level is > 1, so it is not used here.)
 */
export function keepGuiAtCssResolution(
  ui: AdvancedDynamicTexture,
  engine: ScalingEngineLike | null | undefined,
): void {
  if (!engine || typeof engine.getHardwareScalingLevel !== "function") return;
  const sync = () => {
    const level = engine.getHardwareScalingLevel();
    const target = Number.isFinite(level) && level > 1 ? level : 1;
    if (ui.renderScale !== target) ui.renderScale = target;
  };
  sync();
  // setHardwareScalingLevel() resizes the engine, so a tier change mid-game
  // arrives here too.
  engine.onResizeObservable?.add(sync);
}
