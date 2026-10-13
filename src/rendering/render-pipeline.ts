/**
 * render-pipeline — shadows and the post-processing stack, built from the
 * active GraphicsSystem tier.
 *
 *   Shadows:  cascaded shadow maps with PCF on medium+ (crisp near the player,
 *             still covering the far field), a single blurred map on low.
 *   Post FX:  HDR DefaultRenderingPipeline (bloom, FXAA/MSAA, sharpen,
 *             tone-mapping, colour curves, vignette, grain, chromatic
 *             aberration) + SSAO2 + volumetric god rays + a sun lens flare.
 */
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import { VolumetricLightScatteringPostProcess } from "@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { ColorCurves } from "@babylonjs/core/Materials/colorCurves";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { LensFlareSystem } from "@babylonjs/core/LensFlares/lensFlareSystem";
import { LensFlare } from "@babylonjs/core/LensFlares/lensFlare";
import "@babylonjs/core/LensFlares/lensFlareSystemSceneComponent";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { GraphicsSystem } from "../systems/graphics-system";
import type { AtmosphereState } from "./atmosphere";

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
    csm.shadowMaxZ = 150;
    csm.stabilizeCascades = true;
    csm.cascadeBlendPercentage = 0.08;
    csm.depthClamp = true;
    csm.usePercentageCloserFiltering = true;
    csm.filteringQuality = cascades >= 4 ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
    csm.bias = 0.0025;
    csm.normalBias = 0.018;
    // Shadows never go fully black — the sky still lights them.
    csm.darkness = 0.12;
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
  // Halve the caster-pass rate — a one-frame-old single shadow map is
  // imperceptible and the pass is a large share of frame time.
  const map = shadows.getShadowMap();
  if (map) map.refreshRate = 2;
  return shadows;
}

function isWebGL2OrBetter(scene: Scene): boolean {
  const engine = scene.getEngine() as { isWebGPU?: boolean; webGLVersion?: number };
  return !!engine.isWebGPU || (engine.webGLVersion ?? 1) >= 2;
}

// ── Procedural flare / glow sprites ──────────────────────────────────────────

/** Radial RGBA sprite: `profile(r)` → intensity for r ∈ [0, 1]. */
function radialSprite(scene: Scene, size: number, name: string, profile: (r: number) => number): RawTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1;
      const dy = (y + 0.5) / size * 2 - 1;
      const r = Math.sqrt(dx * dx + dy * dy);
      const v = r >= 1 ? 0 : Math.max(0, Math.min(1, profile(r)));
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255);
      data[i + 3] = Math.round(v * 255);
    }
  }
  const tex = RawTexture.CreateRGBATexture(data, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.name = name;
  tex.hasAlpha = true;
  return tex;
}

// ── Post FX ──────────────────────────────────────────────────────────────────

export interface PostFxHandle {
  pipeline: DefaultRenderingPipeline | null;
  ssao: SSAO2RenderingPipeline | null;
  godRays: VolumetricLightScatteringPostProcess | null;
  lensFlare: LensFlareSystem | null;
  /** Per-frame: move the sun emitters and fade flare/rays with the sky. */
  update(state: AtmosphereState, cloudiness: number): void;
  /** Indoors: no sun emitter, flare or god rays. */
  outdoors: boolean;
  dispose(): void;
}

/** Distance of the sun emitter from the camera (inside the 900 u sky dome). */
const SUN_EMITTER_DISTANCE = 700;

export function createPostFx(
  scene: Scene,
  camera: Camera,
  gfx: GraphicsSystem,
  skyDome: AbstractMesh | null,
): PostFxHandle {
  const engine = scene.getEngine();
  const fx = gfx.effects;
  const pp = gfx.postProcess;
  let pipeline: DefaultRenderingPipeline | null = null;
  let ssao: SSAO2RenderingPipeline | null = null;
  let godRays: VolumetricLightScatteringPostProcess | null = null;
  let lensFlare: LensFlareSystem | null = null;
  let sunMesh: Mesh | null = null;
  let flareTextures: RawTexture[] = [];

  const postEnabled = gfx.performance.postProcessEnabled && !engine.isWebGPU;

  // ── SSAO (before the default pipeline so AO is tone-mapped with the scene) ─
  if (postEnabled && fx.ssao && isWebGL2OrBetter(scene)) {
    try {
      ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camera], false);
      ssao.radius = 1.6;
      ssao.totalStrength = 1.15;
      ssao.base = 0.12;
      ssao.samples = 12;
      ssao.maxZ = 120;
      ssao.minZAspect = 0.5;
      ssao.expensiveBlur = true;
      ssao.bilateralSamples = 8;
    } catch (err) {
      console.warn("[render-pipeline] SSAO unavailable", err);
      ssao = null;
    }
  }

  // ── HDR pipeline ─────────────────────────────────────────────────────────
  if (postEnabled) {
    pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    // MSAA on the HDR target forms a framebuffer feedback loop with SSAO's
    // prepass (GL_INVALID_OPERATION spam) — FXAA covers AA when SSAO is on.
    const samples = ssao ? 1 : fx.msaaSamples;
    pipeline.samples = samples;

    pipeline.bloomEnabled = pp.bloom.enabled;
    pipeline.bloomThreshold = pp.bloom.threshold;
    pipeline.bloomWeight = pp.bloom.weight;
    pipeline.bloomKernel = pp.bloom.kernel;
    pipeline.bloomScale = pp.bloom.scale;

    pipeline.fxaaEnabled = pp.fxaa && samples <= 1;
    pipeline.sharpenEnabled = pp.sharpenEdgeAmount > 0;
    pipeline.sharpen.edgeAmount = pp.sharpenEdgeAmount;
    pipeline.sharpen.colorAmount = 1;
    pipeline.depthOfFieldEnabled = false;

    const ip = pipeline.imageProcessing;
    pipeline.imageProcessingEnabled = true;
    ip.toneMappingEnabled = pp.toneMappingType !== "none";
    ip.toneMappingType = pp.toneMappingType === "aces"
      ? ImageProcessingConfiguration.TONEMAPPING_ACES
      : ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
    ip.exposure = pp.exposure;
    ip.contrast = pp.contrast;
    ip.vignetteEnabled = pp.vignetteWeight > 0;
    ip.vignetteWeight = pp.vignetteWeight;
    ip.vignetteStretch = 0.15;
    ip.vignetteColor.set(0.02, 0.015, 0.03, 0);
    ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    // Cinematic grade: a touch more saturation, cool shadows, warm highlights.
    const curves = new ColorCurves();
    curves.globalSaturation = 14;
    curves.shadowsHue = 215;
    curves.shadowsDensity = 18;
    curves.shadowsSaturation = 30;
    curves.highlightsHue = 40;
    curves.highlightsDensity = 6;
    curves.highlightsSaturation = 15;
    ip.colorCurves = curves;
    ip.colorCurvesEnabled = true;

    pipeline.grainEnabled = fx.grain;
    if (fx.grain) {
      pipeline.grain.intensity = 4;
      pipeline.grain.animated = true;
    }
    pipeline.chromaticAberrationEnabled = fx.chromaticAberration;
    if (fx.chromaticAberration) {
      pipeline.chromaticAberration.aberrationAmount = 3;
      pipeline.chromaticAberration.radialIntensity = 1.4;
    }
  }

  // ── Sun emitter (god-ray source, flare anchor) ─────────────────────────────
  if (fx.godRays || fx.lensFlare) {
    sunMesh = MeshBuilder.CreatePlane("sunEmitter", { size: 70 }, scene);
    sunMesh.billboardMode = 7; // BILLBOARDMODE_ALL
    sunMesh.isPickable = false;
    sunMesh.applyFog = false;
    sunMesh.infiniteDistance = true;
    const mat = new StandardMaterial("sunEmitterMat", scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(1, 0.95, 0.85);
    const glow = radialSprite(scene, 64, "sunGlowSprite", (r) => Math.pow(1 - r, 3));
    flareTextures.push(glow);
    mat.opacityTexture = glow;
    mat.diffuseTexture = null;
    mat.alpha = 0.0; // invisible in the beauty pass; the sky shader draws the disc
    mat.disableDepthWrite = true;
    sunMesh.material = mat;
  }

  // God rays are created on the first live frame: building the scattering
  // pass while the game is still paused behind character creation produced
  // transient framebuffer feedback-loop errors alongside SSAO's prepass.
  let godRaysPending = postEnabled && fx.godRays && !!sunMesh;
  let liveFrames = 0;
  const createGodRays = (): void => {
    godRaysPending = false;
    if (!sunMesh) return;
    try {
      godRays = new VolumetricLightScatteringPostProcess(
        "godRays", { postProcessRatio: 1.0, passRatio: 0.5 }, camera, sunMesh, 64,
        Texture.BILINEAR_SAMPLINGMODE, engine, false, scene,
      );
      godRays.exposure = 0.22;
      godRays.decay = 0.965;
      godRays.weight = 0.55;
      godRays.density = 0.92;
      if (skyDome) godRays.excludedMeshes = [skyDome];
      handle.godRays = godRays;
    } catch (err) {
      console.warn("[render-pipeline] god rays unavailable", err);
      godRays = null;
    }
  };

  if (fx.lensFlare && sunMesh) {
    lensFlare = new LensFlareSystem("sunFlare", sunMesh, scene);
    lensFlare.borderLimit = 260;
    lensFlare.meshesSelectionPredicate = (m) =>
      m !== skyDome && m !== sunMesh && m.isVisible && m.isEnabled() && m.isPickable && !!m.material;
    const soft = radialSprite(scene, 128, "flareSoft", (r) => Math.pow(1 - r, 2.2));
    const ring = radialSprite(scene, 128, "flareRing", (r) => Math.exp(-Math.pow((r - 0.82) / 0.07, 2)) * 0.9);
    const disk = radialSprite(scene, 64, "flareDisk", (r) => (r < 0.8 ? 0.55 : Math.max(0, (1 - r) / 0.2 * 0.55)));
    flareTextures = flareTextures.concat([soft, ring, disk]);
    const specs: Array<[number, number, Color3, RawTexture]> = [
      [0.38, 0, new Color3(0.55, 0.5, 0.42), soft],
      [0.05, 0.32, new Color3(0.12, 0.16, 0.28), disk],
      [0.09, 0.55, new Color3(0.14, 0.24, 0.16), ring],
      [0.035, 0.72, new Color3(0.26, 0.19, 0.11), disk],
      [0.14, 1.05, new Color3(0.13, 0.11, 0.24), ring],
      [0.06, 1.35, new Color3(0.24, 0.14, 0.09), disk],
    ];
    for (const [size, pos, color, tex] of specs) {
      const flare = new LensFlare(size, pos, color, "", lensFlare);
      flare.texture = tex;
    }
  }

  const baseFlareColors = lensFlare?.lensFlares.map((f) => f.color.clone()) ?? [];

  const handle: PostFxHandle = {
    pipeline,
    ssao,
    godRays,
    lensFlare,
    outdoors: true,
    update(state: AtmosphereState, cloudiness: number): void {
      if (!sunMesh) return;
      if (godRaysPending && ++liveFrames > 30) createGodRays();
      if (!this.outdoors) {
        sunMesh.setEnabled(false);
        if (lensFlare) lensFlare.isEnabled = false;
        if (godRays) godRays.exposure = 0;
        return;
      }
      sunMesh.position.set(
        state.sunDir[0] * SUN_EMITTER_DISTANCE,
        state.sunDir[1] * SUN_EMITTER_DISTANCE,
        state.sunDir[2] * SUN_EMITTER_DISTANCE,
      );
      const above = Math.max(0, Math.min(1, (state.sunDir[1] + 0.02) / 0.1));
      const clear = Math.max(0, 1 - cloudiness * 1.1);
      const vis = above * clear;
      sunMesh.setEnabled(vis > 0.01);
      if (lensFlare) {
        lensFlare.isEnabled = vis > 0.01;
        lensFlare.lensFlares.forEach((f, i) => {
          const b = baseFlareColors[i];
          f.color.set(b.r * vis, b.g * vis, b.b * vis);
        });
      }
      if (godRays) {
        // Low sun → longer, warmer shafts.
        const low = 1 - Math.max(0, Math.min(1, state.sunElevation / 0.9));
        godRays.exposure = (0.12 + 0.18 * low) * vis;
        const m = sunMesh.material as StandardMaterial;
        m.emissiveColor.set(state.lightColor[0], state.lightColor[1], state.lightColor[2]);
      }
    },
    dispose(): void {
      lensFlare?.dispose();
      godRays?.dispose(camera);
      ssao?.dispose();
      pipeline?.dispose();
      sunMesh?.dispose();
      for (const t of flareTextures) t.dispose();
    },
  };
  return handle;
}
