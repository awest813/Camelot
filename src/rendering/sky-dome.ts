import type { Scene } from "@babylonjs/core/scene";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { MeshBuilder } from "./mesh-builder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import type { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { computeAtmosphere, type AtmosphereState } from "./atmosphere";
import { UniformCache } from "./uniform-cache";
import { registerShaders, shaderLanguageFor } from "./shader-language";

const SKY_VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  vec4 p = worldViewProjection * vec4(position, 1.0);
  // Pin the dome to the far plane so it never clips or occludes geometry.
  gl_Position = p.xyww;
}
`;

const SKY_FRAGMENT = `
precision highp float;
varying vec3 vDir;
uniform vec3 zenithColor;
uniform vec3 horizonColor;
uniform vec3 sunDir;
uniform vec3 moonDir;
uniform vec3 sunGlow;
uniform vec3 sunDisc;
uniform float starIntensity;
uniform float cloudCover;
uniform float time;
uniform vec3 cloudLit;
uniform vec3 cloudShade;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += vnoise(p) * a;
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

void main(void) {
  vec3 dir = normalize(vDir);
  float up = dir.y;

  // ── Gradient ────────────────────────────────────────────────────────────
  float t = pow(clamp(up, 0.0, 1.0), 0.42);
  vec3 col = mix(horizonColor, zenithColor, t);
  // Below the horizon: hold the horizon colour (fog takes over there).
  col = mix(col, horizonColor * 0.92, 1.0 - smoothstep(-0.08, 0.0, up));

  // ── Sun scattering ──────────────────────────────────────────────────────
  float sd = max(dot(dir, sunDir), 0.0);
  float sunAbove = smoothstep(-0.18, 0.05, sunDir.y);
  float horizonBand = 1.0 - smoothstep(0.0, 0.45, abs(up));
  col += sunGlow * (pow(sd, 8.0) * 0.18 + pow(sd, 64.0) * 0.45) * sunAbove;
  col += sunGlow * pow(sd, 2.0) * horizonBand * 0.35 * sunAbove * (1.0 - smoothstep(0.1, 0.5, sunDir.y));

  // ── Stars ───────────────────────────────────────────────────────────────
  if (starIntensity > 0.001 && up > 0.0) {
    vec3 cell = floor(dir * 180.0);
    float h = hash13(cell);
    if (h > 0.9965) {
      vec3 center = (cell + 0.5) / 180.0;
      float d = length(dir - normalize(center)) * 180.0;
      float tw = 0.6 + 0.4 * sin(time * (1.5 + h * 6.0) + h * 40.0);
      col += vec3(0.9, 0.95, 1.0) * (1.0 - smoothstep(0.0, 0.6, d)) * tw * starIntensity * smoothstep(0.0, 0.15, up) * 1.6;
    }
  }

  // ── Moon ────────────────────────────────────────────────────────────────
  float md = dot(dir, moonDir);
  float moonDisc = smoothstep(0.99935, 0.99955, md);
  float moonMare = vnoise(dir.xz * 900.0) * 0.25;
  float night = starIntensity;
  col += vec3(0.85, 0.9, 1.0) * moonDisc * (1.6 - moonMare) * max(night, 0.15) * step(0.0, moonDir.y);
  col += vec3(0.25, 0.32, 0.5) * pow(max(md, 0.0), 180.0) * 0.45 * night;

  // ── Sun disc ────────────────────────────────────────────────────────────
  float disc = smoothstep(0.99955, 0.99975, sd);
  vec3 sunCol = sunDisc * disc;

  // ── Clouds ──────────────────────────────────────────────────────────────
  if (up > 0.0) {
    vec2 uv = dir.xz / (up + 0.18) * 1.6;
    vec2 wind = vec2(time * 0.006, time * 0.0025);
    // Domain warp gives billowy cumulus edges instead of round blobs.
    vec2 warp = vec2(fbm(uv * 0.7 + wind), fbm(uv * 0.7 + wind + 5.2)) - 0.5;
    float n = fbm(uv + wind + warp * 0.9);
    float detail = fbm(uv * 3.1 - wind * 1.7);
    float shape = n * 0.8 + detail * 0.2;
    float cover = mix(0.6, 0.3, cloudCover);
    float dens = smoothstep(cover, cover + mix(0.12, 0.3, cloudCover), shape);
    // Thinner toward the horizon so it dissolves into haze.
    dens *= smoothstep(0.0, 0.2, up);
    // Self-shadowing approximation: denser toward the sun → darker underside.
    float toward = fbm(uv + wind + warp * 0.9 + sunDir.xz * 0.15);
    float shade = clamp((shape - toward) * 4.0 + 0.6, 0.0, 1.0);
    vec3 cc = mix(cloudShade, cloudLit, shade);
    // Silver lining when back-lit by the sun.
    cc += sunGlow * pow(sd, 10.0) * (1.0 - dens) * 1.2 * sunAbove;
    col = mix(col, cc, dens * 0.92);
    sunCol *= 1.0 - dens;
  }

  col += sunCol;
  gl_FragColor = vec4(col, 1.0);
}
`;

/* The same sky in WGSL, for the WebGPU engine (keep the two in step). */

const SKY_VERTEX_WGSL = `
attribute position: vec3f;
uniform worldViewProjection: mat4x4f;
varying vDir: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  vertexOutputs.vDir = vertexInputs.position;
  let p = uniforms.worldViewProjection * vec4f(vertexInputs.position, 1.0);
  // Pin the dome to the far plane so it never clips or occludes geometry.
  vertexOutputs.position = p.xyww;
}
`;

const SKY_FRAGMENT_WGSL = `
varying vDir: vec3f;
uniform zenithColor: vec3f;
uniform horizonColor: vec3f;
uniform sunDir: vec3f;
uniform moonDir: vec3f;
uniform sunGlow: vec3f;
uniform sunDisc: vec3f;
uniform starIntensity: f32;
uniform cloudCover: f32;
uniform time: f32;
uniform cloudLit: vec3f;
uniform cloudShade: vec3f;

fn hash12(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
fn hash13(q: vec3f) -> f32 {
  var p3 = fract(q * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2f(1.0, 0.0)), u.x),
             mix(hash12(i + vec2f(0.0, 1.0)), hash12(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn fbm(q: vec2f) -> f32 {
  var p = q;
  var s = 0.0;
  var a = 0.5;
  for (var i = 0; i < 5; i++) {
    s += vnoise(p) * a;
    p = p * 2.03 + vec2f(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let dir = normalize(fragmentInputs.vDir);
  let up = dir.y;
  let sunDir = uniforms.sunDir;
  let sunGlow = uniforms.sunGlow;
  let starIntensity = uniforms.starIntensity;
  let time = uniforms.time;

  // Gradient
  let t = pow(clamp(up, 0.0, 1.0), 0.42);
  var col = mix(uniforms.horizonColor, uniforms.zenithColor, t);
  col = mix(col, uniforms.horizonColor * 0.92, 1.0 - smoothstep(-0.08, 0.0, up));

  // Sun scattering
  let sd = max(dot(dir, sunDir), 0.0);
  let sunAbove = smoothstep(-0.18, 0.05, sunDir.y);
  let horizonBand = 1.0 - smoothstep(0.0, 0.45, abs(up));
  col += sunGlow * (pow(sd, 8.0) * 0.18 + pow(sd, 64.0) * 0.45) * sunAbove;
  col += sunGlow * pow(sd, 2.0) * horizonBand * 0.35 * sunAbove * (1.0 - smoothstep(0.1, 0.5, sunDir.y));

  // Stars
  if (starIntensity > 0.001 && up > 0.0) {
    let cell = floor(dir * 180.0);
    let h = hash13(cell);
    if (h > 0.9965) {
      let center = (cell + vec3f(0.5)) / 180.0;
      let d = length(dir - normalize(center)) * 180.0;
      let tw = 0.6 + 0.4 * sin(time * (1.5 + h * 6.0) + h * 40.0);
      col += vec3f(0.9, 0.95, 1.0) * (1.0 - smoothstep(0.0, 0.6, d)) * tw * starIntensity * smoothstep(0.0, 0.15, up) * 1.6;
    }
  }

  // Moon
  let md = dot(dir, uniforms.moonDir);
  let moonDisc = smoothstep(0.99935, 0.99955, md);
  let moonMare = vnoise(dir.xz * 900.0) * 0.25;
  let night = starIntensity;
  col += vec3f(0.85, 0.9, 1.0) * moonDisc * (1.6 - moonMare) * max(night, 0.15) * step(0.0, uniforms.moonDir.y);
  col += vec3f(0.25, 0.32, 0.5) * pow(max(md, 0.0), 180.0) * 0.45 * night;

  // Sun disc
  let disc = smoothstep(0.99955, 0.99975, sd);
  var sunCol = uniforms.sunDisc * disc;

  // Clouds
  if (up > 0.0) {
    let uv = dir.xz / (up + 0.18) * 1.6;
    let wind = vec2f(time * 0.006, time * 0.0025);
    let warp = vec2f(fbm(uv * 0.7 + wind), fbm(uv * 0.7 + wind + vec2f(5.2))) - vec2f(0.5);
    let n = fbm(uv + wind + warp * 0.9);
    let detail = fbm(uv * 3.1 - wind * 1.7);
    let cloudShape = n * 0.8 + detail * 0.2;
    let cover = mix(0.6, 0.3, uniforms.cloudCover);
    var dens = smoothstep(cover, cover + mix(0.12, 0.3, uniforms.cloudCover), cloudShape);
    dens *= smoothstep(0.0, 0.2, up);
    let toward = fbm(uv + wind + warp * 0.9 + sunDir.xz * 0.15);
    let shade = clamp((cloudShape - toward) * 4.0 + 0.6, 0.0, 1.0);
    var cc = mix(uniforms.cloudShade, uniforms.cloudLit, shade);
    cc += sunGlow * pow(sd, 10.0) * (1.0 - dens) * 1.2 * sunAbove;
    col = mix(col, cc, dens * 0.92);
    sunCol *= 1.0 - dens;
  }

  col += sunCol;
  fragmentOutputs.color = vec4f(col, 1.0);
}
`;

/**
 * Owns the procedural sky dome and drives the scene's lights and fog from the
 * {@link computeAtmosphere} day/night model.
 */
export class AtmosphereController {
  public readonly mesh: Mesh;
  public readonly material: ShaderMaterial;
  /** Latest computed state (read by other renderers: clouds, flare, grass). */
  public state: AtmosphereState;
  /** 0 clear … 1 storm; set from WeatherSystem each frame. */
  public cloudiness = 0.15;
  private readonly _uniforms = new UniformCache();
  /** Fog colour blended toward this when the weather has its own fog colour. */
  public weatherFog: Color3 | null = null;
  /** How strongly weather fog overrides the clear-sky horizon colour. */
  public weatherFogWeight = 0;

  private _time = 0;
  private readonly _sunDirV = new Vector3();
  private readonly _moonDirV = new Vector3();

  constructor(private readonly _scene: Scene) {
    registerShaders("camelotSky", { vertex: SKY_VERTEX, fragment: SKY_FRAGMENT }, { vertex: SKY_VERTEX_WGSL, fragment: SKY_FRAGMENT_WGSL });
    this.mesh = MeshBuilder.CreateSphere("skyDome", { diameter: 1800, segments: 24, sideOrientation: 1 }, _scene);
    this.mesh.infiniteDistance = true;
    this.mesh.isPickable = false;
    this.mesh.applyFog = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.doNotSyncBoundingInfo = true;

    this.material = new ShaderMaterial("skyDomeMat", _scene, { vertex: "camelotSky", fragment: "camelotSky" }, {
      attributes: ["position"],
      uniforms: [
        "worldViewProjection", "zenithColor", "horizonColor", "sunDir", "moonDir", "sunGlow", "sunDisc",
        "starIntensity", "cloudCover", "time", "cloudLit", "cloudShade",
      ],
      shaderLanguage: shaderLanguageFor(_scene),
    });
    this.material.backFaceCulling = false;
    this.material.disableDepthWrite = true;
    this.mesh.material = this.material;
    this.state = computeAtmosphere(8);
  }

  /**
   * Recompute and apply the atmosphere.
   *
   * @param hour  fractional hour of day (0–24)
   * @param dt    real seconds since the last update (cloud drift, twinkle)
   */
  public update(
    hour: number,
    dt: number,
    lights: {
      sun: DirectionalLight | null;
      ambient: HemisphericLight | null;
      sunBase: number;
      ambientBase: number;
      /** WeatherSystem's sun/ambient scales (1 = clear). */
      sunWeatherScale?: number;
      ambientWeatherScale?: number;
    },
  ): AtmosphereState {
    this._time += dt;
    const s = computeAtmosphere(hour, this.cloudiness);
    this.state = s;

    // Fog = horizon, optionally pulled toward the weather's own fog colour.
    let fr = s.fog[0], fg = s.fog[1], fb = s.fog[2];
    if (this.weatherFog && this.weatherFogWeight > 0) {
      const w = this.weatherFogWeight;
      const dim = 0.25 + 0.75 * Math.min(1, s.ambientIntensity);
      fr += (this.weatherFog.r * dim - fr) * w;
      fg += (this.weatherFog.g * dim - fg) * w;
      fb += (this.weatherFog.b * dim - fb) * w;
    }
    const m = this.material;
    this._scene.fogColor.set(fr, fg, fb);

    // (Separate objects per uniform — setColor3 keeps a reference.)
    const u = this._uniforms;
    m.setColor3("zenithColor", u.color("zenithColor", s.zenith[0], s.zenith[1], s.zenith[2]));
    m.setColor3("horizonColor", u.color("horizonColor", fr, fg, fb));
    m.setVector3("sunDir", this._sunDirV.set(s.sunDir[0], s.sunDir[1], s.sunDir[2]));
    m.setVector3("moonDir", this._moonDirV.set(s.moonDir[0], s.moonDir[1], s.moonDir[2]));
    m.setColor3("sunGlow", u.color("sunGlow", s.sunGlow[0], s.sunGlow[1], s.sunGlow[2]));
    m.setColor3("sunDisc", u.color("sunDisc", s.sunDisc[0], s.sunDisc[1], s.sunDisc[2]));
    m.setFloat("starIntensity", s.stars);
    m.setFloat("cloudCover", this.cloudiness);
    m.setFloat("time", this._time);
    // Clouds: sunlit tops pick up the light colour; undersides take the zenith.
    const day = Math.min(1, s.ambientIntensity);
    m.setColor3("cloudLit", u.color("cloudLit",
      Math.min(1.4, 0.35 + s.lightColor[0] * s.lightIntensity * 1.05 + s.horizon[0] * 0.3) * (0.4 + 0.6 * day),
      Math.min(1.4, 0.35 + s.lightColor[1] * s.lightIntensity * 1.0 + s.horizon[1] * 0.3) * (0.4 + 0.6 * day),
      Math.min(1.4, 0.38 + s.lightColor[2] * s.lightIntensity * 0.95 + s.horizon[2] * 0.3) * (0.4 + 0.6 * day),
    ));
    const shadeK = 0.85 - this.cloudiness * 0.4;
    m.setColor3("cloudShade", u.color("cloudShade",
      (s.horizon[0] * 0.6 + s.zenith[0] * 0.4) * shadeK + 0.02,
      (s.horizon[1] * 0.6 + s.zenith[1] * 0.4) * shadeK + 0.02,
      (s.horizon[2] * 0.6 + s.zenith[2] * 0.4) * shadeK + 0.03,
    ));

    const sun = lights.sun;
    if (sun) {
      sun.direction.set(s.lightDir[0], s.lightDir[1], s.lightDir[2]);
      sun.diffuse.set(s.lightColor[0], s.lightColor[1], s.lightColor[2]);
      sun.specular.set(s.lightColor[0] * 0.6, s.lightColor[1] * 0.6, s.lightColor[2] * 0.6);
      sun.intensity = lights.sunBase * s.lightIntensity * (lights.sunWeatherScale ?? 1);
    }
    const amb = lights.ambient;
    if (amb) {
      amb.diffuse.set(s.ambientSky[0], s.ambientSky[1], s.ambientSky[2]);
      amb.groundColor.set(s.ambientGround[0], s.ambientGround[1], s.ambientGround[2]);
      amb.intensity = lights.ambientBase * s.ambientIntensity * (lights.ambientWeatherScale ?? 1);
    }
    return s;
  }

  public dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }
}
