/**
 * Every lit material shades a fixed number of lights.
 *
 * Only six lights are ever on: the sky (hemispheric), the sun, and the fire
 * pool's four point lights (`particles-fx.ts` lights the nearest fires;
 * every torch, candle and campfire keeps its own light switched off).  But
 * Babylon's glTF loader, each time a model finishes loading, raises every
 * material's `maxSimultaneousLights` to the scene's whole light count, off
 * lights included, which grows as chunks stream in torches and candles.
 * Each raise marks every material's lights dirty, and they rebuild their
 * shaders during play.
 *
 * So the limit is pinned on the lit material classes: the field the shader
 * code reads (`_maxSimultaneousLights`) always reads LIGHTS_PER_MATERIAL and
 * ignores writes (the constructors' default of 4 included), and the public
 * setter always passes the budget, so the loader's raise is equal to what
 * is there and marks nothing dirty.
 */
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRBaseMaterial } from "@babylonjs/core/Materials/PBR/pbrBaseMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { PBRBaseSimpleMaterial } from "@babylonjs/core/Materials/PBR/pbrBaseSimpleMaterial";

/** Sky + sun + the fire pool's four lights. */
export const LIGHTS_PER_MATERIAL = 6;

let pinned = false;

/** Pin the light limit of the lit material classes (once per page; before any material is made). */
export function pinLightLimit(): void {
  if (pinned) return;
  pinned = true;
  for (const C of [StandardMaterial, PBRBaseMaterial]) {
    Object.defineProperty(C.prototype, "_maxSimultaneousLights", {
      configurable: true,
      get: () => LIGHTS_PER_MATERIAL,
      set: () => {},
    });
  }
  for (const C of [StandardMaterial, PBRMaterial, PBRBaseSimpleMaterial]) {
    const d = Object.getOwnPropertyDescriptor(C.prototype, "maxSimultaneousLights");
    if (!d?.set || !d.configurable) continue;
    const set = d.set;
    Object.defineProperty(C.prototype, "maxSimultaneousLights", { ...d, set(this: object) { set.call(this, LIGHTS_PER_MATERIAL); } });
  }
}
