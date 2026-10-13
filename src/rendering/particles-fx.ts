/**
 * particles-fx — fire, weather and ambient particles.
 *
 *  • FireFx: flame + ember (+ smoke for campfires) particles on every torch and
 *    campfire, light flicker, and nearest-N point-light management so far-off
 *    torches don't eat StandardMaterial light slots (max 4 per material).
 *  • WeatherFx: camera-following rain streaks / tundra snow, storm lightning
 *    flashes, sunlit dust motes by day and glowing fireflies at night.
 *
 * All sprites are generated procedurally (no image assets).
 */
import type { Scene } from "@babylonjs/core/scene";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import "@babylonjs/core/Particles/particleSystemComponent";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { PointLight } from "@babylonjs/core/Lights/pointLight";

type Profile = (x: number, y: number) => number;

function sprite(scene: Scene, name: string, w: number, h: number, profile: Profile): RawTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(1, profile((x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1)));
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(v * 255);
    }
  }
  const tex = RawTexture.CreateRGBATexture(data, w, h, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.name = name;
  tex.hasAlpha = true;
  return tex;
}

const soft: Profile = (x, y) => {
  const r = Math.sqrt(x * x + y * y);
  return Math.pow(Math.max(0, 1 - r), 1.8);
};
const flameProfile: Profile = (x, y) => {
  // Teardrop: wide at the bottom (y = 1), pointed at the top.
  const t = (y + 1) / 2;
  const w = 0.25 + 0.75 * Math.sqrt(t);
  const r = Math.abs(x) / w;
  return Math.pow(Math.max(0, 1 - r), 1.4) * Math.pow(t, 0.6) * (1 - Math.pow(1 - t, 6));
};
const streak: Profile = (x, y) => Math.max(0, 1 - Math.abs(x) * 2.2) * Math.max(0, 1 - Math.abs(y));

// ── Fire ─────────────────────────────────────────────────────────────────────

interface FireEntry {
  flame: Mesh;
  light: PointLight;
  base: number;
  systems: ParticleSystem[];
  phase: number;
}

export class FireFx {
  /** Point lights kept enabled (nearest to the player). */
  public maxActiveLights = 4;
  /** Lights farther than this are always off. */
  public lightRange = 45;
  private readonly _fires = new Set<FireEntry>();
  private readonly _flameTex: RawTexture;
  private readonly _softTex: RawTexture;
  private _time = 0;
  private _lightTimer = 0;

  constructor(private readonly _scene: Scene, private readonly _particleScale: number) {
    this._flameTex = sprite(_scene, "fxFlame", 32, 64, flameProfile);
    this._softTex = sprite(_scene, "fxSoft", 32, 32, soft);
  }

  public attach(info: { flame: Mesh; light: PointLight; kind: "torch" | "campfire" }): void {
    const big = info.kind === "campfire";
    const systems: ParticleSystem[] = [];
    info.flame.computeWorldMatrix(true);
    const emitter = info.flame.getAbsolutePosition().clone();
    emitter.y -= big ? 0.18 : 0.1;

    if (this._particleScale > 0) {
      const fire = new ParticleSystem(`${info.flame.name}_fire`, Math.ceil((big ? 60 : 28) * this._particleScale) + 4, this._scene);
      fire.particleTexture = this._flameTex;
      fire.emitter = emitter;
      const r = big ? 0.16 : 0.05;
      fire.minEmitBox = new Vector3(-r, 0, -r);
      fire.maxEmitBox = new Vector3(r, 0.05, r);
      fire.color1 = new Color4(1.0, 0.55, 0.16, 0.85);
      fire.color2 = new Color4(0.9, 0.32, 0.05, 0.7);
      fire.colorDead = new Color4(0.3, 0.04, 0.0, 0);
      fire.minSize = big ? 0.2 : 0.1;
      fire.maxSize = big ? 0.42 : 0.2;
      fire.minLifeTime = 0.25;
      fire.maxLifeTime = big ? 0.6 : 0.45;
      fire.emitRate = big ? 40 : 22;
      fire.blendMode = ParticleSystem.BLENDMODE_ADD;
      fire.gravity = new Vector3(0, big ? 2.2 : 1.6, 0);
      fire.direction1 = new Vector3(-0.15, 1, -0.15);
      fire.direction2 = new Vector3(0.15, 1, 0.15);
      fire.minEmitPower = 0.3;
      fire.maxEmitPower = 0.7;
      fire.minAngularSpeed = -1;
      fire.maxAngularSpeed = 1;
      fire.addSizeGradient(0, 0.6);
      fire.addSizeGradient(0.4, 1.0);
      fire.addSizeGradient(1, 0.2);
      fire.start();
      systems.push(fire);

      const embers = new ParticleSystem(`${info.flame.name}_embers`, Math.ceil((big ? 24 : 6) * this._particleScale) + 2, this._scene);
      embers.particleTexture = this._softTex;
      embers.emitter = emitter.clone();
      embers.minEmitBox = new Vector3(-r, 0.1, -r);
      embers.maxEmitBox = new Vector3(r, 0.2, r);
      embers.color1 = new Color4(2.0, 0.9, 0.3, 1);
      embers.color2 = new Color4(1.6, 0.5, 0.1, 1);
      embers.colorDead = new Color4(0.4, 0.05, 0, 0);
      embers.minSize = 0.02;
      embers.maxSize = 0.045;
      embers.minLifeTime = 0.8;
      embers.maxLifeTime = 1.8;
      embers.emitRate = big ? 12 : 3;
      embers.blendMode = ParticleSystem.BLENDMODE_ADD;
      embers.gravity = new Vector3(0, 0.6, 0);
      embers.direction1 = new Vector3(-0.6, 1.5, -0.6);
      embers.direction2 = new Vector3(0.6, 2.5, 0.6);
      embers.minEmitPower = 0.3;
      embers.maxEmitPower = 0.9;
      embers.start();
      systems.push(embers);

      if (big) {
        const smoke = new ParticleSystem(`${info.flame.name}_smoke`, Math.ceil(30 * this._particleScale) + 2, this._scene);
        smoke.particleTexture = this._softTex;
        smoke.emitter = emitter.add(new Vector3(0, 0.45, 0));
        smoke.minEmitBox = new Vector3(-0.1, 0, -0.1);
        smoke.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
        smoke.color1 = new Color4(0.35, 0.33, 0.32, 0.22);
        smoke.color2 = new Color4(0.25, 0.24, 0.24, 0.16);
        smoke.colorDead = new Color4(0.3, 0.3, 0.3, 0);
        smoke.minSize = 0.4;
        smoke.maxSize = 0.8;
        smoke.addSizeGradient(0, 0.5);
        smoke.addSizeGradient(1, 2.6);
        smoke.minLifeTime = 2.5;
        smoke.maxLifeTime = 4.5;
        smoke.emitRate = 7;
        smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
        smoke.gravity = new Vector3(0.25, 0.5, 0.1);
        smoke.direction1 = new Vector3(-0.2, 1, -0.2);
        smoke.direction2 = new Vector3(0.2, 1, 0.2);
        smoke.minEmitPower = 0.2;
        smoke.maxEmitPower = 0.5;
        smoke.start();
        systems.push(smoke);
      }
      // The particles replace the solid cone; keep it as a dim core.
      info.flame.scaling.set(0.6, 0.55, 0.6);
    }

    const entry: FireEntry = { flame: info.flame, light: info.light, base: info.light.intensity, systems, phase: Math.random() * 100 };
    this._fires.add(entry);
    info.flame.onDisposeObservable.addOnce(() => {
      for (const s of entry.systems) s.dispose(false);
      this._fires.delete(entry);
    });
  }

  public update(dt: number, player: Vector3): void {
    this._time += dt;
    // Flicker: layered sines + noise-ish jitter.
    for (const f of this._fires) {
      const t = this._time * 9 + f.phase;
      const k = 0.82 + 0.1 * Math.sin(t) + 0.06 * Math.sin(t * 2.7 + 1.3) + 0.04 * Math.sin(t * 7.1);
      f.light.intensity = f.base * k;
    }
    // Nearest-light management (2 Hz).
    this._lightTimer -= dt;
    if (this._lightTimer > 0) return;
    this._lightTimer = 0.5;
    const list = [...this._fires].map((f) => ({ f, d: Vector3.DistanceSquared(f.light.position, player) }));
    list.sort((a, b) => a.d - b.d);
    const maxD2 = this.lightRange * this.lightRange;
    list.forEach(({ f, d }, i) => {
      const on = i < this.maxActiveLights && d < maxD2;
      if (f.light.isEnabled() !== on) f.light.setEnabled(on);
      // Cull far particle systems too.
      const near = d < 70 * 70;
      for (const s of f.systems) {
        if (near && !s.isStarted()) s.start();
        else if (!near && s.isStarted()) s.stop();
      }
    });
  }

  public dispose(): void {
    for (const f of this._fires) for (const s of f.systems) s.dispose(false);
    this._fires.clear();
    this._flameTex.dispose();
    this._softTex.dispose();
  }
}

// ── Weather & ambient ────────────────────────────────────────────────────────

export interface WeatherFxInput {
  /** 0 dry … 1 downpour. */
  precipitation: number;
  /** Precipitation falls as snow (tundra). */
  snow: boolean;
  /** Storm: enables lightning. */
  storm: boolean;
  /** 0 night … 1 day. */
  daylight: number;
  /** Whether the exterior world is shown (false indoors). */
  outdoors: boolean;
  /** Wind push (world units / s). */
  windX: number;
  windZ: number;
}

export class WeatherFx {
  private readonly _rain: ParticleSystem;
  private readonly _snow: ParticleSystem;
  private readonly _dust: ParticleSystem;
  private readonly _flies: ParticleSystem;
  private readonly _textures: RawTexture[] = [];
  private readonly _emitPos = new Vector3();
  private _flash = 0;
  private _nextFlash = 6;
  private _time = 0;

  constructor(scene: Scene, particleScale: number) {
    const softTex = sprite(scene, "fxWeatherSoft", 32, 32, soft);
    const streakTex = sprite(scene, "fxStreak", 8, 64, streak);
    this._textures.push(softTex, streakTex);
    const cap = (n: number) => Math.max(8, Math.ceil(n * particleScale));

    const rain = new ParticleSystem("fxRain", cap(3500), scene);
    rain.particleTexture = streakTex;
    rain.emitter = this._emitPos;
    rain.minEmitBox = new Vector3(-20, 9, -20);
    rain.maxEmitBox = new Vector3(20, 15, 20);
    rain.direction1 = new Vector3(-0.05, -1, -0.05);
    rain.direction2 = new Vector3(0.05, -1, 0.05);
    rain.minEmitPower = 22;
    rain.maxEmitPower = 28;
    rain.minLifeTime = 0.6;
    rain.maxLifeTime = 0.7;
    rain.minSize = 0.025;
    rain.maxSize = 0.04;
    rain.minScaleY = 14;
    rain.maxScaleY = 20;
    rain.color1 = new Color4(0.72, 0.78, 0.88, 0.32);
    rain.color2 = new Color4(0.62, 0.68, 0.8, 0.22);
    rain.colorDead = new Color4(0.6, 0.65, 0.75, 0);
    rain.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    rain.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    rain.emitRate = 0;
    rain.start();
    this._rain = rain;

    const snow = new ParticleSystem("fxSnow", cap(2500), scene);
    snow.particleTexture = softTex;
    snow.emitter = this._emitPos;
    snow.minEmitBox = new Vector3(-18, 6, -18);
    snow.maxEmitBox = new Vector3(18, 12, 18);
    snow.direction1 = new Vector3(-0.3, -1, -0.3);
    snow.direction2 = new Vector3(0.3, -1, 0.3);
    snow.minEmitPower = 1.0;
    snow.maxEmitPower = 1.8;
    snow.minLifeTime = 6;
    snow.maxLifeTime = 9;
    snow.minSize = 0.05;
    snow.maxSize = 0.11;
    snow.color1 = new Color4(1, 1, 1, 0.85);
    snow.color2 = new Color4(0.9, 0.93, 1, 0.7);
    snow.colorDead = new Color4(1, 1, 1, 0);
    snow.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    snow.minAngularSpeed = -1;
    snow.maxAngularSpeed = 1;
    snow.emitRate = 0;
    snow.start();
    this._snow = snow;

    const dust = new ParticleSystem("fxDust", cap(160), scene);
    dust.particleTexture = softTex;
    dust.emitter = this._emitPos;
    dust.minEmitBox = new Vector3(-9, 0.3, -9);
    dust.maxEmitBox = new Vector3(9, 4, 9);
    dust.direction1 = new Vector3(-0.2, -0.05, -0.2);
    dust.direction2 = new Vector3(0.2, 0.12, 0.2);
    dust.minEmitPower = 0.05;
    dust.maxEmitPower = 0.25;
    dust.minLifeTime = 5;
    dust.maxLifeTime = 9;
    dust.minSize = 0.018;
    dust.maxSize = 0.04;
    dust.addColorGradient(0, new Color4(1, 0.95, 0.8, 0));
    dust.addColorGradient(0.3, new Color4(1, 0.95, 0.8, 0.18));
    dust.addColorGradient(0.7, new Color4(1, 0.95, 0.8, 0.18));
    dust.addColorGradient(1, new Color4(1, 0.95, 0.8, 0));
    dust.blendMode = ParticleSystem.BLENDMODE_ADD;
    dust.emitRate = 0;
    dust.start();
    this._dust = dust;

    const flies = new ParticleSystem("fxFireflies", cap(140), scene);
    flies.particleTexture = softTex;
    flies.emitter = this._emitPos;
    flies.minEmitBox = new Vector3(-18, 0.3, -18);
    flies.maxEmitBox = new Vector3(18, 2.6, 18);
    flies.direction1 = new Vector3(-0.4, -0.15, -0.4);
    flies.direction2 = new Vector3(0.4, 0.25, 0.4);
    flies.minEmitPower = 0.1;
    flies.maxEmitPower = 0.45;
    flies.minLifeTime = 3;
    flies.maxLifeTime = 7;
    flies.minSize = 0.06;
    flies.maxSize = 0.11;
    // Blink on and off over a lifetime; HDR so bloom haloes them.
    flies.addColorGradient(0, new Color4(1.2, 1.6, 0.3, 0));
    flies.addColorGradient(0.2, new Color4(2.2, 2.8, 0.5, 1));
    flies.addColorGradient(0.35, new Color4(0.4, 0.5, 0.1, 0.2));
    flies.addColorGradient(0.55, new Color4(2.2, 2.8, 0.5, 1));
    flies.addColorGradient(0.8, new Color4(0.6, 0.8, 0.15, 0.4));
    flies.addColorGradient(1, new Color4(1.2, 1.6, 0.3, 0));
    flies.blendMode = ParticleSystem.BLENDMODE_ADD;
    flies.emitRate = 0;
    flies.start();
    this._flies = flies;
  }

  /** Current lightning flash intensity [0, 1]. */
  public get flash(): number {
    return this._flash;
  }

  public update(dt: number, cameraPos: Vector3, input: WeatherFxInput): void {
    this._time += dt;
    this._emitPos.copyFrom(cameraPos);
    const out = input.outdoors;
    const p = out ? input.precipitation : 0;

    this._rain.emitRate = !input.snow ? p * 4500 : 0;
    this._snow.emitRate = input.snow ? p * 320 : 0;
    this._rain.gravity.set(input.windX * 1.2, 0, input.windZ * 1.2);
    this._snow.gravity.set(input.windX * 0.8, -0.4, input.windZ * 0.8);

    // Dust motes catch the sun on dry days; fireflies come out on dry nights.
    const dry = 1 - Math.min(1, p * 3);
    this._dust.emitRate = out ? 14 * input.daylight * dry : 0;
    this._flies.emitRate = out ? 26 * Math.max(0, 1 - input.daylight * 2.5) * dry : 0;

    // Lightning.
    if (input.storm && out) {
      this._nextFlash -= dt;
      if (this._nextFlash <= 0) {
        this._flash = 1;
        this._nextFlash = 5 + Math.random() * 11;
      }
    }
    // Double-flicker decay.
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 3.2);
    }
  }

  /** Flash shape with a secondary flicker, for lighting multipliers. */
  public get flashLight(): number {
    const f = this._flash;
    if (f <= 0) return 0;
    return f * (0.6 + 0.4 * Math.sin(f * 40));
  }

  public dispose(): void {
    this._rain.dispose(false);
    this._snow.dispose(false);
    this._dust.dispose(false);
    this._flies.dispose(false);
    for (const t of this._textures) t.dispose();
  }
}
