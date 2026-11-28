/**
 * render-pipeline — the sun's shadows, built from the active GraphicsSystem
 * tier: cascaded shadow maps with PCF on medium+ (crisp near the player,
 * still covering the far field), a single blurred map on low.
 *
 * The post-processing stack is post-fx.ts (loaded after the world is set up).
 */
import type { Scene } from "@babylonjs/core/scene";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { GraphicsSystem } from "../systems/graphics-system";

// ── Shadows ───────────────────────────────────────────────────────────────────

/**
 * Build the sun's shadow generator for the active tier.  Returns null when
 * the tier disables shadows.  The result is always a `ShadowGenerator`
 * (CascadedShadowGenerator extends it), so `addShadowCaster` call sites work
 * unchanged.
 */
export function createSunShadows(
  scene: Scene,
  sun: DirectionalLight,
  gfx: GraphicsSystem,
): ShadowGenerator | null {
  if (!gfx.performance.shadowsEnabled) return null;
  const engine = scene.getEngine();
  const cascades = gfx.effects.shadowCascades;
  const webgl2 = isWebGL2OrBetter(scene);

  if (cascades > 0 && webgl2) {
    const csm = new CascadedShadowGenerator(gfx.shadow.mapSize, sun);
    csm.numCascades = cascades;
    csm.lambda = 0.82;
    csm.shadowMaxZ = 90;
    csm.stabilizeCascades = true;
    csm.cascadeBlendPercentage = 0.08;
    csm.depthClamp = true;
    csm.usePercentageCloserFiltering = true;
    csm.filteringQuality = cascades >= 4 ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
    csm.bias = 0.0025;
    csm.normalBias = 0.018;
    // Shadows never go fully black — the sky still lights them.
    csm.darkness = 0.12;
    cullCascadeCasters(csm);
    // Every other frame, like the single map below: the cascade matrices are
    // recomputed only when the map renders, so map and matrices stay
    // consistent and shadows trail the camera by one frame at most.  The
    // caster pass is the larger half of a village's draw calls.
    const csmMap = csm.getShadowMap();
    if (csmMap) csmMap.refreshRate = 2;
    return csm;
  }

  const shadows = new ShadowGenerator(gfx.shadow.mapSize, sun);
  if (gfx.performance.softShadows && webgl2) {
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
  } else if (gfx.performance.softShadows) {
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = gfx.shadow.blurKernel;
  }
  shadows.bias = 0.0015;
  shadows.normalBias = 0.02;
  shadows.darkness = 0.12;
  fixSingleMapArea(sun, shadows);
  // Halve the caster-pass rate — a one-frame-old single shadow map is
  // imperceptible and the pass is a large share of frame time.
  const map = shadows.getShadowMap();
  if (map) map.refreshRate = 2;
  return shadows;
}

/** Metres across the single (non-cascaded) shadow map: the ground around the player. */
export const SINGLE_MAP_AREA = 100;

/**
 * The single shadow map covers a fixed square around the player instead of
 * Babylon's default, which stretches it to fit every caster in the loaded
 * world (a few metres per texel, and all of them drawn).  The sun follows
 * the player (world-environment); `snapSunToTexels` keeps the square on the
 * map's texel grid so shadows don't shimmer as the player walks.  Only the
 * casters over the square are drawn into it.
 */
export function fixSingleMapArea(sun: DirectionalLight, shadows: ShadowGenerator): void {
  sun.autoUpdateExtends = false;
  sun.shadowFrustumSize = SINGLE_MAP_AREA;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 400;
  const map = shadows.getShadowMap();
  if (!map) return;
  const out: AbstractMesh[] = [];
  const half = SINGLE_MAP_AREA / 2;
  const axes = { x: new Vector3(), y: new Vector3() };
  const d = new Vector3();
  map.getCustomRenderList = (_layer, renderList, renderListLength) => {
    if (!renderList) return null;
    if (!lightAxes(sun.direction, axes)) return null;
    out.length = 0;
    for (let i = 0; i < renderListLength; i++) {
      const mesh = renderList[i];
      const sphere = mesh.getBoundingInfo().boundingSphere;
      sphere.centerWorld.subtractToRef(sun.position, d);
      const r = sphere.radiusWorld;
      if (Math.abs(Vector3.Dot(d, axes.x)) - r > half || Math.abs(Vector3.Dot(d, axes.y)) - r > half) continue;
      out.push(mesh);
    }
    return out;
  };
}

/** The light view's right and up axes (as Babylon's LookAtLH builds them); false when the sun is straight up or down. */
export function lightAxes(dir: Vector3, out: { x: Vector3; y: Vector3 }): boolean {
  // x = normalize(up × dir), y = dir × x
  out.x.set(dir.z, 0, -dir.x);
  const len = out.x.length();
  if (len < 1e-4) return false;
  out.x.scaleInPlace(1 / len);
  Vector3.CrossToRef(dir, out.x, out.y);
  out.y.normalize();
  return true;
}

/** Move the sun's position onto the single shadow map's texel grid (in light space). */
export function snapSunToTexels(sun: DirectionalLight, mapSize: number): void {
  const axes = { x: new Vector3(), y: new Vector3() };
  if (!lightAxes(sun.direction, axes)) return;
  const texel = SINGLE_MAP_AREA / mapSize;
  for (const axis of [axes.x, axes.y]) {
    const u = Vector3.Dot(sun.position, axis);
    const snapped = Math.round(u / texel) * texel;
    sun.position.addInPlace(axis.scale(snapped - u));
  }
}

/**
 * Smallest caster (bounding-sphere radius, m) drawn into each cascade.  The
 * far cascades cover tens of metres per texel row; a lantern's or a barrel's
 * shadow there is a few texels at most, so it is left out.
 */
const CASCADE_MIN_CASTER_RADIUS = [0.2, 1.0, 2.0, 2.5];

/**
 * Per-cascade caster lists: only casters whose bounds overlap a cascade's
 * light-space rectangle (and aren't past its far plane), and — beyond the
 * first cascade — big enough to matter.  Without this every caster is drawn
 * into every cascade.  Casters between the light and the cascade are kept:
 * with depth clamping they still cast into it.
 */
export function cullCascadeCasters(csm: CascadedShadowGenerator): void {
  const map = csm.getShadowMap();
  if (!map) return;
  const lists: AbstractMesh[][] = [];
  const p = new Vector3();
  map.getCustomRenderList = (layer, renderList, renderListLength) => {
    if (!renderList) return null;
    const view = csm.getCascadeViewMatrix(layer);
    const min = csm.getCascadeMinExtents(layer);
    const max = csm.getCascadeMaxExtents(layer);
    if (!view || !min || !max) return null;
    const minRadius = CASCADE_MIN_CASTER_RADIUS[Math.min(layer, CASCADE_MIN_CASTER_RADIUS.length - 1)];
    const out = (lists[layer] ??= []);
    out.length = 0;
    for (let i = 0; i < renderListLength; i++) {
      const mesh = renderList[i];
      const sphere = mesh.getBoundingInfo().boundingSphere;
      const r = sphere.radiusWorld;
      if (r < minRadius) continue;
      Vector3.TransformCoordinatesToRef(sphere.centerWorld, view, p);
      if (p.x + r < min.x || p.x - r > max.x || p.y + r < min.y || p.y - r > max.y) continue;
      if (p.z - r > max.z) continue;
      out.push(mesh);
    }
    return out;
  };
}

export function isWebGL2OrBetter(scene: Scene): boolean {
  const engine = scene.getEngine() as { isWebGPU?: boolean; webGLVersion?: number };
  return !!engine.isWebGPU || (engine.webGLVersion ?? 1) >= 2;
}

