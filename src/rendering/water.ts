/**
 * water — ponds: carved terrain basins + a sky-matched water surface.
 *
 * The shader reflects the same sky gradient the atmosphere renders (so water
 * and sky always agree), adds HDR sun glints for bloom, animated ripple
 * normals pushed by the wind, a depth tint toward the middle, a soft shoreline
 * fade, and the scene's EXP2 fog.
 */
import type { Scene } from "@babylonjs/core/scene";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2, Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import type { AtmosphereState } from "./atmosphere";

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

let _registered = false;

/** Shared material + per-pond meshes; update once per frame. */
export class WaterRenderer {
  private readonly _meshes = new Set<{ mesh: Mesh; mat: ShaderMaterial }>();
  private _time = 0;
  private readonly _tmpC = new Color3();
  private readonly _tmpV = new Vector3();
  private readonly _tmpW = new Vector2();

  constructor(private readonly _scene: Scene) {
    if (!_registered) {
      Effect.ShadersStore["camelotWaterVertexShader"] = VERTEX;
      Effect.ShadersStore["camelotWaterFragmentShader"] = FRAGMENT;
      _registered = true;
    }
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
      mat.setVector3("sunDir", this._tmpV.set(s.sunDir[0], s.sunDir[1], s.sunDir[2]));
      const li = Math.max(0, s.lightIntensity) * (s.sunDir[1] > 0 ? 1 : 0);
      mat.setColor3("sunColor", this._tmpC.set(s.lightColor[0] * li, s.lightColor[1] * li, s.lightColor[2] * li));
      mat.setColor3("zenith", this._tmpC.set(s.zenith[0], s.zenith[1], s.zenith[2]));
      mat.setColor3("horizon", fog);
      mat.setColor3("fogColor", fog);
      mat.setFloat("fogDensity", this._scene.fogDensity);
      mat.setVector2("wind", this._tmpW.set(wind.x, wind.z));
      const a = s.ambientIntensity;
      mat.setColor3("ambient", this._tmpC.set(s.ambientSky[0] * a, s.ambientSky[1] * a, s.ambientSky[2] * a));
    }
  }
}
