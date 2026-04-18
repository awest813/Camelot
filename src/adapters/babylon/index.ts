/**
 * Babylon Adapter Layer — barrel export.
 *
 * This directory contains classes that bridge between the headless game core
 * (entities, systems, framework) and the Babylon.js runtime.  Each adapter
 * encapsulates a Babylon-specific concern:
 *
 *   - **BabylonInputAdapter** — Maps keyboard/mouse events to named input
 *     actions.  Can be driven headlessly for testing.
 *
 *   - **BabylonCharacterControllerAdapter** — First-person movement state
 *     (position, velocity, crouch, sprint, swim, mount).  Pure TypeScript;
 *     Babylon reads the state each frame and applies it to the camera/physics.
 *
 *   - **BabylonSceneHost** — Scene-level visual configuration (lighting, sky,
 *     fog, shadows, post-processing).  Pure data; can be validated and
 *     snapshot/restored without a live engine.
 */
export {
  BabylonInputAdapter,
  type InputAction,
  type InputBinding,
  type ActionCallback,
  DEFAULT_BINDINGS,
} from "./babylon-input-adapter";

export {
  BabylonCharacterControllerAdapter,
  type Vec3,
  type CharacterControllerSnapshot,
} from "./babylon-controller-adapter";

export {
  BabylonSceneHost,
  type SceneHostConfig,
  type LightingConfig,
  type FogConfig,
  type ShadowConfig,
  type SkyConfig,
  type PostProcessingConfig,
  type ClearColor,
  type ColorRGB,
  DEFAULT_CLEAR_COLOR,
  DEFAULT_LIGHTING,
  DEFAULT_FOG,
  DEFAULT_SHADOW,
  DEFAULT_SKY,
  DEFAULT_POST_PROCESSING,
} from "./babylon-scene-host";
