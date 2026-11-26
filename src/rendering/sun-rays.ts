/**
 * Sun rays (god rays) as one screen-space pass, in GLSL and WGSL.
 *
 * Babylon's volumetric scattering pass has no WGSL, and running its GLSL on
 * WebGPU means fetching converters from a CDN, so WebGPU had no god rays.
 * This pass needs no extra geometry pass either: it blurs the bright parts
 * of the frame along lines toward the sun's position on screen, so the sky
 * around the sun streams past whatever stands in front of it (trees, roofs
 * and hills are darker, and break the rays up).
 *
 * The game uses it on WebGPU; WebGL keeps Babylon's occlusion-based pass.
 */
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Scene } from "@babylonjs/core/scene";

/** Samples along each ray (a fixed loop count, the same in both languages). */
export const SUN_RAY_SAMPLES = 48;

export const SUN_RAYS_GLSL = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 sunPos;
uniform float exposure;
uniform float decay;
uniform float density;
uniform float weight;
uniform float threshold;
void main(void) {
  vec4 base = texture2D(textureSampler, vUV);
  vec2 step = (vUV - sunPos) * (density / ${SUN_RAY_SAMPLES}.0);
  vec2 uv = vUV;
  float falloff = 1.0;
  vec3 rays = vec3(0.0);
  for (int i = 0; i < ${SUN_RAY_SAMPLES}; i++) {
    uv -= step;
    vec3 c = texture2D(textureSampler, clamp(uv, 0.0, 1.0)).rgb;
    float bright = smoothstep(threshold, 1.0, dot(c, vec3(0.2126, 0.7152, 0.0722)));
    rays += c * bright * falloff * weight;
    falloff *= decay;
  }
  gl_FragColor = vec4(base.rgb + rays * exposure, base.a);
}
`;

export const SUN_RAYS_WGSL = `
varying vUV: vec2f;
var textureSamplerSampler: sampler;
var textureSampler: texture_2d<f32>;
uniform sunPos: vec2f;
uniform exposure: f32;
uniform decay: f32;
uniform density: f32;
uniform weight: f32;
uniform threshold: f32;
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let base = textureSample(textureSampler, textureSamplerSampler, input.vUV);
  let step = (input.vUV - uniforms.sunPos) * (uniforms.density / ${SUN_RAY_SAMPLES}.0);
  var uv = input.vUV;
  var falloff = 1.0;
  var rays = vec3f(0.0);
  for (var i = 0; i < ${SUN_RAY_SAMPLES}; i++) {
    uv = uv - step;
    let c = textureSampleLevel(textureSampler, textureSamplerSampler, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0).rgb;
    let bright = smoothstep(uniforms.threshold, 1.0, dot(c, vec3f(0.2126, 0.7152, 0.0722)));
    rays = rays + c * bright * falloff * uniforms.weight;
    falloff = falloff * uniforms.decay;
  }
  fragmentOutputs.color = vec4f(base.rgb + rays * uniforms.exposure, base.a);
}
`;

function registerSunRays(): void {
  for (const suffix of ["PixelShader", "FragmentShader"]) {
    ShaderStore.ShadersStore[`sunRays${suffix}`] ??= SUN_RAYS_GLSL;
    ShaderStore.ShadersStoreWGSL[`sunRays${suffix}`] ??= SUN_RAYS_WGSL;
  }
}

/** Where on screen (post-process UV, y up) the sun is; null when it is behind the camera. */
export function sunScreenPosition(camera: Camera, towardSun: Vector3, scene: Scene): { x: number; y: number } | null {
  const far = camera.position.add(towardSun.normalizeToNew().scale(1000));
  const engine = scene.getEngine();
  const w = engine.getRenderWidth(), h = engine.getRenderHeight();
  const p = Vector3.Project(far, Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(w, h));
  if (p.z < 0 || p.z > 1) return null;
  // Post-process UVs have y up; projected screen y is down.
  return { x: p.x / w, y: 1 - p.y / h };
}

export class SunRaysPostProcess {
  public readonly postProcess: PostProcess;
  public exposure = 0.18;
  public decay = 0.965;
  public density = 0.9;
  public weight = 0.04;
  /** Luminance where a pixel starts to shine (the sky near the sun). */
  public threshold = 0.72;

  /** `towardSun`: the direction from the viewer to the sun, read every frame. */
  constructor(camera: Camera, scene: Scene, towardSun: () => Vector3, language: ShaderLanguage) {
    registerSunRays();
    this.postProcess = new PostProcess("sunRays", "sunRays", {
      uniforms: ["sunPos", "exposure", "decay", "density", "weight", "threshold"],
      samplers: [],
      size: 1,
      camera,
      engine: scene.getEngine(),
      shaderLanguage: language,
    });
    this.postProcess.onApply = (effect) => {
      const sun = sunScreenPosition(camera, towardSun(), scene);
      // Behind the camera, or the sun under the horizon: no rays.
      const visible = sun !== null && towardSun().y > 0;
      effect.setFloat2("sunPos", sun?.x ?? 0.5, sun?.y ?? 0.5);
      effect.setFloat("exposure", visible ? this.exposure : 0);
      effect.setFloat("decay", this.decay);
      effect.setFloat("density", this.density);
      effect.setFloat("weight", this.weight);
      effect.setFloat("threshold", this.threshold);
    };
  }

  public dispose(camera: Camera): void {
    this.postProcess.dispose(camera);
  }
}
