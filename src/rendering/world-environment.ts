/**
 * The world's look over time: sun and ambient light with sun shadows, the
 * sky dome and horizon, post-processing, pond water, grass and foliage wind,
 * fire and weather particles, window glow after dark, and the per-frame
 * blend of all of it from the clock and the weather.
 *
 * Moved out of game.ts (engine overhaul, Phase 1; the renderer work in
 * Phases 4–5 builds on it).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { AtmosphereController } from "./sky-dome";
import { HorizonMountains } from "./horizon";
import { WaterRenderer } from "./water";
import type { FireFx, WeatherFx } from "./particles-fx";
import { FireFxPort } from "./fire-fx-port";
import { createFoliageMaterials, GrassField, WindState } from "./foliage";
import { createSunShadows, snapSunToTexels } from "./render-pipeline";
import type { PostFxHandle } from "./post-fx";
import { CascadedShadowGenerator } from "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";
import type { GraphicsSystem } from "../systems/graphics-system";
import type { WeatherSystem } from "../systems/weather-system";
import type { WorldManager } from "../world/world-manager";

export interface EnvironmentDeps {
  scene: Scene;
  graphics: GraphicsSystem;
  /** Time of day as a fraction of 24 hours (null before the clock exists). */
  dayFraction(): number | null;
  weather(): WeatherSystem | null;
  /** The player's eye position (null before the player exists). */
  playerPosition(): Vector3 | null;
}

export class WorldEnvironment {
  public sun: DirectionalLight | null = null;
  public shadows: ShadowGenerator | null = null;
  public atmosphere: AtmosphereController | null = null;
  public sky: Mesh | null = null;
  public horizon: HorizonMountains | null = null;
  public postFx: PostFxHandle | null = null;
  /** Whether the open world is shown (an interior hides it), for the post stack once it loads. */
  private _outdoors = true;
  public pipeline: DefaultRenderingPipeline | null = null;
  public water: WaterRenderer | null = null;
  public grass: GrassField | null = null;
  /** Where fires are lit (they wait there until the particle code arrives). */
  public readonly fireFx = new FireFxPort();
  private _fire: FireFx | null = null;
  public weatherFx: WeatherFx | null = null;
  private _precipitation = 0;
  private _world: WorldManager | null = null;
  private _glass: Array<{ emissiveColor?: Color3 }> = [];
  private _glassScan = -1;
  private _glowLevel = -1;
  private readonly _scene: Scene;
  private readonly _g: GraphicsSystem;

  constructor(private readonly _d: EnvironmentDeps) {
    this._scene = _d.scene;
    this._g = _d.graphics;
  }

  /** Sky colour fallback, the ambient and sun lights, sun shadows and the starting fog. */
  public initLights(): void {
    // The sky dome covers the entire background, so the clear colour is used
    // only for pixels not covered by any geometry.  Keep a deep sky-blue fallback
    // for the very first frame before the skybox is initialised.
    this._scene.clearColor = new Color4(0.28, 0.46, 0.74, 1.0);

    // Ambient hemisphere light — rich warm sunlit sky above, deep earthy tones below
    const hLight = new HemisphericLight("hLight", new Vector3(0, 1, 0), this._scene);
    hLight.intensity   = this._g.lighting.ambientBase;
    hLight.diffuse     = new Color3(0.92, 0.88, 0.72);
    hLight.groundColor = new Color3(0.18, 0.14, 0.08);
    hLight.specular    = new Color3(0.08, 0.07, 0.05);

    // Directional sun light — warm golden angle with deep shadow contrast
    const sun = new DirectionalLight("sun", new Vector3(-1.0, -2.5, -0.6).normalize(), this._scene);
    sun.intensity = this._g.lighting.sunBase;
    sun.diffuse   = new Color3(1.0, 0.92, 0.72);
    sun.specular  = new Color3(0.55, 0.48, 0.30);
    // Position the light far away so the shadow frustum covers the visible world.
    // update() keeps it offset from the player so the frustum stays centred.
    sun.position  = new Vector3(80, 120, 50);
    this.sun = sun;

    // Shadows are driven by the active graphics quality tier: cascaded PCF
    // shadows on medium+, a single soft map on low.
    this.shadows = createSunShadows(this._scene, sun, this._g);

    // Atmospheric distance fog — initial values match WeatherSystem's "clear"
    // state so the first frame is consistent before WeatherSystem takes over.
    this._scene.fogMode    = Scene.FOGMODE_EXP2;
    this._scene.fogDensity = this._g.fog.density;
    this._scene.fogColor   = new Color3(
      this._g.fog.color.r,
      this._g.fog.color.g,
      this._g.fog.color.b,
    );
  }

  /** The sky dome, the horizon and post-processing (needs the player's camera). */
  public initSky(camera: Camera): void {
    // ── Procedural sky dome + time-of-day atmosphere ─────────────────────────
    // A custom sky shader (gradient, sun/moon, clouds, stars) whose horizon
    // colour is also the scene fog colour, so distant terrain melts into it.
    this.atmosphere = new AtmosphereController(this._scene);
    this.sky = this.atmosphere.mesh;
    this.horizon = new HorizonMountains(this._scene);
    this.update(0);

    // ── Post-processing stack ────────────────────────────────────────────────
    // HDR pipeline (bloom, AA, grade, grain…), SSAO, god rays and lens flare,
    // each gated by the quality tier.  Skipped on WebGPU (driver issues).
    // Its code arrives after the world is set up (out of the start-up bundle);
    // until then the frames draw ungraded.
    void import("./post-fx").then(({ createPostFx }) => {
      if (this._scene.isDisposed) return;
      this.postFx = createPostFx(this._scene, camera, this._g, this.sky);
      this.pipeline = this.postFx.pipeline;
      this.postFx.outdoors = this._outdoors;
    });
  }

  /** Water, foliage materials and grass, fire and weather particles (needs the world). */
  public initFoliage(world: WorldManager): void {
    this._world = world;
    this.water = new WaterRenderer(this._scene);
    world.water = this.water;
    const foliage = createFoliageMaterials(this._scene, world.textureManager, this._g.effects.wind);
    world.foliage = foliage;
    const density = this._g.effects.grassDensity;
    if (density > 0) {
      this.grass = new GrassField(
        this._scene, foliage.grass, density, world.chunkSize,
        (cx, cz) => world.getBiome(cx, cz),
        (x, z) => world.isInPond(x, z, 0.5),
      );
    }
    const particleScale = Math.min(1.5, this._g.performance.maxParticles / 512);
    world.structures.onFire = (info) => this.fireFx.attach(info);
    world.structures.mergeStatic = true;
    // Fire and weather particles: their code arrives after the world is set up
    // (out of the start-up bundle); fires lit meanwhile wait in the port.
    void import("./particles-fx").then(({ FireFx, WeatherFx }) => {
      if (this._scene.isDisposed) return;
      this._fire = new FireFx(this._scene, particleScale);
      this.fireFx.connect(this._fire);
      this.weatherFx = new WeatherFx(this._scene, this._g.effects.ambientParticles ? particleScale : particleScale * 0.5);
    });

    world.onVisibilityChanged = (visible) => {
      this.grass?.setVisible(visible);
      this.horizon?.setVisible(visible);
      this.atmosphere?.mesh.setEnabled(visible);
      this._outdoors = visible;
      if (this.postFx) this.postFx.outdoors = visible;
    };
  }

  /**
   * Drive the sun and moon, light colours, sky and fog from the clock and
   * weather, and keep the shadow frustum centred on the player.  Runs after
   * the gameplay step, so the weather's raw values are composed on top of.
   */
  public update(dt: number): void {
    const atmo = this.atmosphere;
    if (!atmo) return;
    const weather = this._d.weather()?.visuals;
    if (weather) {
      // Light loss from the weather doubles as a smooth cloudiness signal.
      atmo.cloudiness = 0.15 + 0.85 * Math.min(1, Math.max(0, (1 - weather.sunScale) / 0.8));
      atmo.weatherFog = atmo.weatherFog ?? new Color3();
      atmo.weatherFog.set(weather.fogColor.r, weather.fogColor.g, weather.fogColor.b);
      atmo.weatherFogWeight = Math.min(0.85, Math.max(0, (weather.fogDensity - 0.006) / 0.02));
    }
    const hour = (this._d.dayFraction() ?? 8 / 24) * 24;
    const state = atmo.update(hour, dt, {
      sun: this.sun,
      ambient: this._scene.getLightByName("hLight") as HemisphericLight | null,
      sunBase: this._g.lighting.sunBase,
      ambientBase: this._g.lighting.ambientBase,
      sunWeatherScale: weather?.sunScale,
      ambientWeatherScale: weather?.ambientScale,
    });
    // Weather particles + lightning.
    let flash = 0;
    const player = this._d.playerPosition();
    if (this.weatherFx && player) {
      const ws = this._d.weather()?.state ?? "clear";
      const target = ws === "storm" ? 1 : ws === "rain" ? 0.55 : 0;
      this._precipitation += (target - this._precipitation) * Math.min(1, dt * 0.25);
      const p = player;
      const biome = this._world?.getBiome(Math.floor(p.x / this._world!.chunkSize), Math.floor(p.z / this._world!.chunkSize));
      this.weatherFx.update(dt, p, {
        precipitation: this._precipitation,
        snow: biome === "tundra",
        storm: ws === "storm",
        daylight: Math.max(0, Math.min(1, (state.ambientIntensity - 0.42) / 0.58)),
        outdoors: this._world?.visible ?? true,
        windX: WindState.dirX * WindState.strength * 3,
        windZ: WindState.dirZ * WindState.strength * 3,
      });
      flash = this.weatherFx.flashLight;
      if (flash > 0) {
        const amb = this._scene.getLightByName("hLight") as HemisphericLight | null;
        if (amb) {
          amb.intensity += flash * 1.4;
          amb.diffuse.set(0.75, 0.82, 1.0);
        }
      }
    }
    const daylight = Math.max(0, Math.min(1, (state.ambientIntensity - 0.42) / 0.58));
    if (this._fire && player) {
      this._fire.night = daylight < 0.3;
      this._fire.update(dt, player);
    }
    this._windowGlow(daylight);
    this.water?.update(dt, state, { x: WindState.dirX * WindState.strength, z: WindState.dirZ * WindState.strength });

    if (this.pipeline) {
      this.pipeline.imageProcessing.exposure = this._g.postProcess.exposure * state.exposure * (1 + flash * 0.8);
      // Night raises exposure, which also amplifies sharpening halos and
      // grain into crawling speckle on dark surfaces: ease both off after dark.
      const rp = this.pipeline;
      if (rp.sharpenEnabled) rp.sharpen.edgeAmount = this._g.postProcess.sharpenEdgeAmount * (0.4 + 0.6 * daylight);
      if (rp.grainEnabled) rp.grain.intensity = 4 * (0.5 + 0.5 * daylight);
    }

    // Interiors: no daylight pouring in, and fog is dark rather than sky-blue.
    if (this._world && !this._world!.visible) {
      if (this.sun) this.sun.intensity *= 0.12;
      const amb = this._scene.getLightByName("hLight") as HemisphericLight | null;
      if (amb) amb.intensity *= 0.7;
      this._scene.fogColor.set(0.02, 0.02, 0.025);
    }
    this.postFx?.update(state, atmo.cloudiness);
    if (this.horizon && player) this.horizon.update(player, state, this._scene.fogColor, atmo.cloudiness);
    // Wind picks up with the weather.
    WindState.time += dt;
    WindState.strength += ((0.22 + atmo.cloudiness * 0.75) - WindState.strength) * Math.min(1, dt * 0.5);
    if (this.grass && this._world?.visible && player) {
      this.grass.update(player.x, player.z);
      this.grass.pump(2);
    }
    // Keep the shadow frustum centred on the player, placed up-light.
    const sun = this.sun;
    if (sun && player) {
      const p = player;
      sun.position.set(
        p.x - state.lightDir[0] * 150,
        p.y - state.lightDir[1] * 150,
        p.z - state.lightDir[2] * 150,
      );
      // The single map covers a fixed square: keep it on its texel grid.
      if (this.shadows && !(this.shadows instanceof CascadedShadowGenerator)) {
        snapSunToTexels(sun, this.shadows.getShadowMap()?.getSize().width ?? this._g.shadow.mapSize);
      }
    }
  }

  /**
   * Windows glow warm after dark: the Medieval Village window-glass material
   * (shared by every building) gets an emissive tint scaled by darkness.
   */
  private _windowGlow(daylight: number): void {
      const glow = Math.max(0, Math.min(1, 1 - daylight * 2.2));
      if (Math.abs(glow - this._glowLevel) < 0.02 && this._scene.materials.length === this._glassScan) return;
      if (this._scene.materials.length !== this._glassScan) {
        this._glassScan = this._scene.materials.length;
        this._glass = this._scene.materials.filter((m) => /WindowGlass/i.test(m.name)) as Array<{ emissiveColor?: Color3 }>;
      }
      this._glowLevel = glow;
      for (const m of this._glass) {
        if (!m.emissiveColor) continue;
        // A uniform, so no markDirty() / shader rebuild is needed.
        m.emissiveColor.set(1.0 * glow, 0.58 * glow, 0.22 * glow);
      }
  }
}
