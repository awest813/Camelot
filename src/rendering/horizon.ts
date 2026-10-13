/**
 * horizon — distant mountain ranges ringing the playable world.
 *
 * Two concentric ridge rings (parallax) follow the camera horizontally,
 * far beyond the streamed chunks.  A small shader lights them with the sun,
 * adds snow caps and blends toward the fog/horizon colour (aerial
 * perspective), so the world fades into ranges instead of a hard line.
 */
import type { Scene } from "@babylonjs/core/scene";
import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TileableNoise } from "./texture-synth";
import type { AtmosphereState } from "./atmosphere";

const VERTEX = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vNormal;
varying float vHeight;
varying float vLayer;
varying vec3 vWorld;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normal;
  vHeight = uv.x;
  vLayer = uv.y;
  gl_Position = viewProjection * w;
}
`;

const FRAGMENT = `
precision highp float;
varying vec3 vNormal;
varying float vHeight;
varying float vLayer;
varying vec3 vWorld;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform vec3 ambientColor;
uniform vec3 hazeColor;
uniform float snowLine;
uniform float hazeBoost;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(void) {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, -lightDir), 0.0);
  vec3 rock = mix(vec3(0.30, 0.31, 0.33), vec3(0.40, 0.38, 0.34), h1(floor(vWorld.xz * 0.05)));
  vec3 grass = vec3(0.22, 0.30, 0.16);
  float snow = smoothstep(snowLine - 6.0, snowLine + 4.0, vHeight + (n.y - 0.5) * 30.0);
  vec3 base = mix(mix(grass, rock, smoothstep(10.0, 40.0, vHeight)), vec3(0.92, 0.94, 0.98), snow);
  vec3 col = base * (ambientColor * 0.75 + lightColor * diff * 0.9);
  // Aerial perspective: the far ring melts more into the haze.
  float haze = mix(0.38, 0.6, vLayer);
  // Valleys sit in denser air than peaks; the base melts fully into the fog.
  haze += (1.0 - smoothstep(-10.0, 50.0, vHeight)) * 0.6;
  col = mix(col, hazeColor, clamp(haze + hazeBoost, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

let _registered = false;

function ringGeometry(radius: number, segments: number, baseHeight: number, amp: number, seed: number, layer: number): VertexData {
  const noise = new TileableNoise(seed);
  const heights: number[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const ridge = noise.ridged(t, 0.37, 14, 5);
    const broad = noise.fbm(t, 0.71, 4, 3) * 0.5 + 0.5;
    const peaks = Math.pow(ridge, 2.2);
    heights.push(baseHeight + amp * (peaks * 0.9 + broad * 0.35) * (0.25 + broad * 0.9));
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const bottom = -40;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const h = heights[i % segments];
    const hPrev = heights[(i - 1 + segments) % segments];
    const hNext = heights[(i + 1) % segments];
    const ca = Math.cos(a), sa = Math.sin(a);
    // Inward-facing normal tilted by the ridge slope for side lighting.
    const slope = (hNext - hPrev) / (2 * (Math.PI * 2 * radius / segments));
    const inward = new Vector3(-ca, 0.55, -sa);
    const tangent = new Vector3(-sa, 0, ca);
    const n = inward.add(tangent.scale(-slope * 1.5)).normalize();
    positions.push(ca * radius, bottom, sa * radius, ca * radius, h, sa * radius);
    normals.push(n.x, n.y, n.z, n.x, n.y, n.z);
    uvs.push(0, layer, h, layer);
  }
  for (let i = 0; i < segments; i++) {
    const b0 = i * 2, t0 = i * 2 + 1, b1 = i * 2 + 2, t1 = i * 2 + 3;
    indices.push(b0, t0, b1, b1, t0, t1);
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.indices = indices;
  return vd;
}

export class HorizonMountains {
  public readonly meshes: Mesh[] = [];
  private readonly _material: ShaderMaterial;
  private readonly _tmp = new Color3();
  private readonly _tmpV = new Vector3();

  constructor(scene: Scene) {
    if (!_registered) {
      Effect.ShadersStore["camelotHorizonVertexShader"] = VERTEX;
      Effect.ShadersStore["camelotHorizonFragmentShader"] = FRAGMENT;
      _registered = true;
    }
    this._material = new ShaderMaterial("horizonMat", scene, { vertex: "camelotHorizon", fragment: "camelotHorizon" }, {
      attributes: ["position", "normal", "uv"],
      uniforms: ["world", "viewProjection", "lightDir", "lightColor", "ambientColor", "hazeColor", "snowLine", "hazeBoost"],
    });
    this._material.backFaceCulling = false;
    this._material.setFloat("snowLine", 110);

    const layers: Array<[number, number, number, number]> = [
      // radius, base height, amplitude, seed
      [620, 0, 110, 11],
      [820, 10, 210, 23],
    ];
    layers.forEach(([radius, base, amp, seed], i) => {
      const mesh = new Mesh(`horizonRing_${i}`, scene);
      ringGeometry(radius, 256, base, amp, seed, i).applyToMesh(mesh, false);
      mesh.material = this._material;
      mesh.isPickable = false;
      mesh.applyFog = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.doNotSyncBoundingInfo = true;
      this.meshes.push(mesh);
    });
  }

  /** Follow the camera horizontally and relight from the atmosphere. */
  public update(cameraPos: Vector3, s: AtmosphereState, fog: Color3, cloudiness = 0): void {
    for (const m of this.meshes) {
      m.position.x = cameraPos.x;
      m.position.z = cameraPos.z;
    }
    const mat = this._material;
    mat.setVector3("lightDir", this._tmpV.set(s.lightDir[0], s.lightDir[1], s.lightDir[2]));
    const li = s.lightIntensity;
    mat.setColor3("lightColor", this._tmp.set(s.lightColor[0] * li, s.lightColor[1] * li, s.lightColor[2] * li));
    const ai = s.ambientIntensity * 0.8;
    mat.setColor3("ambientColor", this._tmp.set(s.ambientSky[0] * ai, s.ambientSky[1] * ai, s.ambientSky[2] * ai));
    mat.setColor3("hazeColor", fog);
    // Bad weather swallows the far ranges.
    mat.setFloat("hazeBoost", Math.max(0, cloudiness - 0.2) * 0.55);
  }

  public setVisible(visible: boolean): void {
    for (const m of this.meshes) m.setEnabled(visible);
  }

  public dispose(): void {
    for (const m of this.meshes) m.dispose();
    this._material.dispose();
  }
}
