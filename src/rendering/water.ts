/**
 * water — ponds: carved terrain basins + a sky-matched water surface.
 *
 * The shader reflects the same sky gradient the atmosphere renders (so water
 * and sky always agree), adds HDR sun glints for bloom, animated ripple
 * normals pushed by the wind, a depth tint toward the middle, a soft shoreline
 * fade, and the scene's EXP2 fog.
 */
import type { Scene } from "@babylonjs/core/scene";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { MeshBuilder } from "./mesh-builder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Vector2, Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import type { AtmosphereState } from "./atmosphere";
import { UniformCache } from "./uniform-cache";
import { registerShaders, shaderLanguageFor } from "./shader-language";

export interface Pond {
  x: number;
  z: number;
  radius: number;
  depth: number;
}

/** Water surface height relative to the (flat) ground plane. */
export const POND_WATER_LEVEL = -0.12;

/** Basin depth at a horizontal distance from the pond centre (≥ 0). */
export function pondDepthAt(pond: Pond, dist: number): number {
  const t = Math.min(1, Math.max(0, (pond.radius * 1.12 - dist) / (pond.radius * 0.62)));
  return pond.depth * t * t * (3 - 2 * t);
}

/** True when (x, z) is inside the pond's footprint plus `margin`. */
export function insidePond(pond: Pond | null, x: number, z: number, margin = 0): boolean {
  if (!pond) return false;
  const dx = x - pond.x, dz = z - pond.z;
  const r = pond.radius + margin;
  return dx * dx + dz * dz < r * r;
}

/** Lower a ground mesh's vertices into the pond basin and refresh normals. */
export function carvePond(ground: Mesh, pond: Pond): void {
  const pos = ground.getVerticesData(VertexBuffer.PositionKind);
  const idx = ground.getIndices();
  if (!pos || !idx) return;
  const ox = ground.position.x, oz = ground.position.z;
  let changed = false;
  for (let i = 0; i < pos.length; i += 3) {
    const d = Math.hypot(pos[i] + ox - pond.x, pos[i + 2] + oz - pond.z);
    const depth = pondDepthAt(pond, d);
    if (depth > 0) {
      pos[i + 1] -= depth;
      changed = true;
    }
  }
  if (!changed) return;
  // CreateGround buffers are not updatable — replace them.
  ground.setVerticesData(VertexBuffer.PositionKind, pos, false);
  const normals = new Float32Array(pos.length);
  VertexData.ComputeNormals(pos, idx, normals);
  ground.setVerticesData(VertexBuffer.NormalKind, normals, false);
  ground.refreshBoundingInfo();
}

const VERTEX = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vWorld;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = viewProjection * w;
}
`;

const FRAGMENT = `
precision highp float;
varying vec3 vWorld;
uniform vec3 cameraPos;
uniform float time;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec4 pond;      // x, z, radius, depth
uniform vec2 wind;
uniform vec3 ambient;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
float heightAt(vec2 p) {
  vec2 w = wind * time;
  return n2(p * 0.45 + w * 0.5) * 0.5
       + n2(p * 1.2 - w * 0.7 + 7.0) * 0.3
       + n2(p * 2.9 + w * 1.1 + 3.0) * 0.12
       + sin(dot(p, vec2(0.7, 0.4)) * 1.6 + time * 1.2) * 0.04;
}

void main(void) {
  vec2 p = vWorld.xz;
  float e = 0.06;
  float hc = heightAt(p);
  vec3 n = normalize(vec3(hc - heightAt(p + vec2(e, 0.0)), e * 6.0, hc - heightAt(p + vec2(0.0, e))));
  vec3 v = normalize(cameraPos - vWorld);
  float fres = 0.02 + 0.8 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  vec3 sky = mix(horizon, zenith, pow(clamp(r.y, 0.0, 1.0), 0.45)) * 0.85;
  float spec = pow(max(dot(r, sunDir), 0.0), 220.0) * 4.0 + pow(max(dot(r, sunDir), 0.0), 24.0) * 0.12;

  float dist = length(p - pond.xy);
  float centre = 1.0 - smoothstep(0.0, pond.z, dist);
  vec3 shallow = vec3(0.13, 0.2, 0.15);
  vec3 deep = vec3(0.02, 0.06, 0.07);
  vec3 body = mix(shallow, deep, centre) * (0.35 + ambient * 0.8);

  vec3 col = mix(body, sky, fres) + sunColor * spec;
  // Soft shoreline: fade out over the outer rim; foam-ish brightening at the edge.
  float shore = 1.0 - smoothstep(pond.z * 0.82, pond.z * 1.02, dist);
  float edge = smoothstep(pond.z * 0.78, pond.z * 0.95, dist) * shore;
  col += vec3(0.12) * edge * (0.5 + 0.5 * n2(p * 4.0 + time));
  float alpha = mix(0.62, 0.95, fres) * shore;

  float d = length(cameraPos - vWorld);
  float f = exp(-pow(fogDensity * d, 2.0));
  col = mix(fogColor, col, f);
  gl_FragColor = vec4(col, alpha);
}
`;

/* The same water in WGSL, for the WebGPU engine (keep the two in step). */

const VERTEX_WGSL = `
attribute position: vec3f;
uniform world: mat4x4f;
uniform viewProjection: mat4x4f;
varying vWorld: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
  let w = uniforms.world * vec4f(vertexInputs.position, 1.0);
  vertexOutputs.vWorld = w.xyz;
  vertexOutputs.position = uniforms.viewProjection * w;
}
`;

const FRAGMENT_WGSL = `
varying vWorld: vec3f;
uniform cameraPos: vec3f;
uniform time: f32;
uniform sunDir: vec3f;
uniform sunColor: vec3f;
uniform zenith: vec3f;
uniform horizon: vec3f;
uniform fogColor: vec3f;
uniform fogDensity: f32;
uniform pond: vec4f;
uniform wind: vec2f;
uniform ambient: vec3f;

fn h(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn n2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2f(1.0, 0.0)), u.x), mix(h(i + vec2f(0.0, 1.0)), h(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn heightAt(p: vec2f) -> f32 {
  let time = uniforms.time;
  let w = uniforms.wind * time;
  return n2(p * 0.45 + w * 0.5) * 0.5
       + n2(p * 1.2 - w * 0.7 + vec2f(7.0)) * 0.3
       + n2(p * 2.9 + w * 1.1 + vec2f(3.0)) * 0.12
       + sin(dot(p, vec2f(0.7, 0.4)) * 1.6 + time * 1.2) * 0.04;
}

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
  let world = fragmentInputs.vWorld;
  let p = world.xz;
  let pond = uniforms.pond;
  let e = 0.06;
  let hc = heightAt(p);
  let n = normalize(vec3f(hc - heightAt(p + vec2f(e, 0.0)), e * 6.0, hc - heightAt(p + vec2f(0.0, e))));
  let v = normalize(uniforms.cameraPos - world);
  let fres = 0.02 + 0.8 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  let r = reflect(-v, n);
  let sky = mix(uniforms.horizon, uniforms.zenith, pow(clamp(r.y, 0.0, 1.0), 0.45)) * 0.85;
  let spec = pow(max(dot(r, uniforms.sunDir), 0.0), 220.0) * 4.0 + pow(max(dot(r, uniforms.sunDir), 0.0), 24.0) * 0.12;

  let dist = length(p - pond.xy);
  let centre = 1.0 - smoothstep(0.0, pond.z, dist);
  let shallow = vec3f(0.13, 0.2, 0.15);
  let deep = vec3f(0.02, 0.06, 0.07);
  let waterBody = mix(shallow, deep, centre) * (vec3f(0.35) + uniforms.ambient * 0.8);

  var col = mix(waterBody, sky, fres) + uniforms.sunColor * spec;
  // Soft shoreline: fade out over the outer rim; foam-ish brightening at the edge.
  let shore = 1.0 - smoothstep(pond.z * 0.82, pond.z * 1.02, dist);
  let edge = smoothstep(pond.z * 0.78, pond.z * 0.95, dist) * shore;
  col += vec3f(0.12) * edge * (0.5 + 0.5 * n2(p * 4.0 + vec2f(uniforms.time)));
  let alpha = mix(0.62, 0.95, fres) * shore;

  let d = length(uniforms.cameraPos - world);
  let fogF = exp(-pow(uniforms.fogDensity * d, 2.0));
  col = mix(uniforms.fogColor, col, fogF);
  fragmentOutputs.color = vec4f(col, alpha);
}
`;

/** Shared material + per-pond meshes; update once per frame. */
export class WaterRenderer {
  private readonly _meshes = new Set<{ mesh: Mesh; mat: ShaderMaterial }>();
  private _time = 0;
  private readonly _uniforms = new UniformCache();
  private readonly _tmpW = new Vector2();

  constructor(private readonly _scene: Scene) {
    registerShaders("camelotWater", { vertex: VERTEX, fragment: FRAGMENT }, { vertex: VERTEX_WGSL, fragment: FRAGMENT_WGSL });
  }

  /** Build the water surface for a pond.  Disposed with the returned mesh. */
  public createPond(name: string, pond: Pond): Mesh {
    const mesh = MeshBuilder.CreateDisc(name, { radius: pond.radius * 1.05, tessellation: 48 }, this._scene);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(pond.x, POND_WATER_LEVEL, pond.z);
    mesh.isPickable = false;
    const mat = new ShaderMaterial(`${name}_mat`, this._scene, { vertex: "camelotWater", fragment: "camelotWater" }, {
      attributes: ["position"],
      uniforms: [
        "world", "viewProjection", "cameraPos", "time", "sunDir", "sunColor", "zenith", "horizon",
        "fogColor", "fogDensity", "pond", "wind", "ambient",
      ],
      shaderLanguage: shaderLanguageFor(this._scene),
      needAlphaBlending: true,
    });
    mat.backFaceCulling = false;
    mat.setVector4("pond", new Vector4(pond.x, pond.z, pond.radius, pond.depth));
    mesh.material = mat;
    const entry = { mesh, mat };
    this._meshes.add(entry);
    mesh.onDisposeObservable.addOnce(() => {
      mat.dispose();
      this._meshes.delete(entry);
    });
    return mesh;
  }

  public update(dt: number, s: AtmosphereState, wind: { x: number; z: number }): void {
    if (this._meshes.size === 0) return;
    this._time += dt;
    const cam = this._scene.activeCamera;
    if (!cam) return;
    const fog = this._scene.fogColor;
    for (const { mat } of this._meshes) {
      mat.setVector3("cameraPos", cam.globalPosition);
      mat.setFloat("time", this._time);
      // (Separate objects per uniform — setColor3/setVector3 keep a reference.)
      const u = this._uniforms;
      mat.setVector3("sunDir", u.vec3("sunDir", s.sunDir[0], s.sunDir[1], s.sunDir[2]));
      const li = Math.max(0, s.lightIntensity) * (s.sunDir[1] > 0 ? 1 : 0);
      mat.setColor3("sunColor", u.color("sunColor", s.lightColor[0] * li, s.lightColor[1] * li, s.lightColor[2] * li));
      mat.setColor3("zenith", u.color("zenith", s.zenith[0], s.zenith[1], s.zenith[2]));
      mat.setColor3("horizon", fog);
      mat.setColor3("fogColor", fog);
      mat.setFloat("fogDensity", this._scene.fogDensity);
      mat.setVector2("wind", this._tmpW.set(wind.x, wind.z));
      const a = s.ambientIntensity;
      mat.setColor3("ambient", u.color("ambient", s.ambientSky[0] * a, s.ambientSky[1] * a, s.ambientSky[2] * a));
    }
  }
}
