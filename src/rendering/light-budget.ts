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
 *
 * The PBR classes (the glTF models' materials) are pinned when the glTF
 * loader loads (`pinPbrLightLimit`, called from rendering/gltf-loading.ts):
 * importing them here put Babylon's whole PBR material code in the
 * start-up bundle, before any model needs it.
 */
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

/** Sky + sun + the fire pool's four lights. */
export const LIGHTS_PER_MATERIAL = 6;

type MaterialClass = { prototype: object };

/** The field the shaders read is always the budget; the public setter always passes it. */
export function pinClasses(fieldOwners: readonly MaterialClass[], setterOwners: readonly MaterialClass[]): void {
  for (const C of fieldOwners) {
    Object.defineProperty(C.prototype, "_maxSimultaneousLights", {
      configurable: true,
      get: () => LIGHTS_PER_MATERIAL,
      set: () => {},
    });
  }
  for (const C of setterOwners) {
    const d = Object.getOwnPropertyDescriptor(C.prototype, "maxSimultaneousLights");
    if (!d?.set || !d.configurable) continue;
    const set = d.set;
    Object.defineProperty(C.prototype, "maxSimultaneousLights", { ...d, set(this: object) { set.call(this, LIGHTS_PER_MATERIAL); } });
  }
}

let pinned = false;

/** Pin the light limit of the standard material (once per page; before any material is made). */
export function pinLightLimit(): void {
  if (pinned) return;
  pinned = true;
  pinClasses([StandardMaterial], [StandardMaterial]);
}

let pbrPinned: Promise<void> | null = null;

/** Pin the PBR classes' light limit (once; before the first model makes a PBR material). */
export function pinPbrLightLimit(): Promise<void> {
  pbrPinned ??= Promise.all([
    import("@babylonjs/core/Materials/PBR/pbrBaseMaterial"),
    import("@babylonjs/core/Materials/PBR/pbrMaterial"),
    import("@babylonjs/core/Materials/PBR/pbrBaseSimpleMaterial"),
  ]).then(([{ PBRBaseMaterial }, { PBRMaterial }, { PBRBaseSimpleMaterial }]) => {
    pinClasses([PBRBaseMaterial], [PBRMaterial, PBRBaseSimpleMaterial]);
  });
  return pbrPinned;
}
