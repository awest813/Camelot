import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import "@babylonjs/core/Culling/ray";

import { IDLE_INPUT, Match } from "./moba/sim";
import type { SimEvent } from "./moba/sim";
import type { HeroId, Lane, PlayerCommand } from "./moba/types";
import { Arena } from "./render/world";
import { Stage } from "./render/actors";
import { HeroLibrary } from "./render/heroes";
import { Sfx } from "./render/sfx";
import { SKY } from "./render/palette";
import { Hud } from "./ui/hud";

const STEP = 1 / 30;

class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly arena: Arena;
  private readonly stage: Stage;
  private readonly hud: Hud;
  private readonly sfx = new Sfx();
  private match: Match | null = null;
  private acc = 0;
  private last = performance.now();
  private shake = 0;
  private ended = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "renderCanvas";
    document.body.appendChild(this.canvas);
    const ui = document.createElement("div");
    ui.id = "ui";
    document.body.appendChild(ui);
    this.hud = new Hud(ui);

    const engine = new Engine(this.canvas, true, {
      powerPreference: "high-performance",
      stencil: true,
      preserveDrawingBuffer: false,
    });
    this.engine = engine;
    this.applyScale();

    const scene = new Scene(engine);
    scene.clearColor = SKY;
    scene.ambientColor = new Color3(0.38, 0.4, 0.44);
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = 78;
    scene.fogEnd = 160;
    scene.fogColor = new Color3(0.62, 0.82, 0.96);
    scene.imageProcessingConfiguration.contrast = 1.08;
    scene.imageProcessingConfiguration.exposure = 1.0;
    scene.imageProcessingConfiguration.vignetteEnabled = true;
    scene.imageProcessingConfiguration.vignetteWeight = 0.55;
    scene.imageProcessingConfiguration.vignetteColor = new Color4(0.08, 0.1, 0.18, 1);
    scene.skipPointerMovePicking = true;
    this.scene = scene;

    const glow = new GlowLayer("glow", scene);
    glow.intensity = 0.28;
    glow.customEmissiveColorSelector = (mesh, _sub, material, result) => {
      const skip = (mesh.metadata as { noGlow?: boolean } | null)?.noGlow;
      const emissive = (material as { emissiveColor?: Color3 }).emissiveColor;
      if (skip || !emissive) result.set(0, 0, 0, 1);
      else result.set(emissive.r, emissive.g, emissive.b, 1);
    };

    this.camera = new FreeCamera("cam", new Vector3(-22, 24, -22), scene);
    this.camera.fov = 0.8;
    this.camera.minZ = 0.2;
    this.camera.maxZ = 240;
    scene.activeCamera = this.camera;

    this.arena = new Arena(scene);
    const base = import.meta.env.BASE_URL;
    const library = new HeroLibrary(scene, `${base}model/kaykit/`);
    library.preload(["Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded"]);
    this.stage = new Stage(scene, library);

    this.hud.ready((hero, lane) => this.begin(hero, lane));
    this.hud.onAgain(() => {
      this.match = null;
      this.ended = false;
      this.stage.clear();
      this.hud.showSelect();
    });

    window.addEventListener("resize", () => {
      this.applyScale();
      this.engine.resize();
    });

    this.engine.runRenderLoop(() => this.frame());
    if (import.meta.env.DEV) {
      (window as unknown as { __rift?: Game }).__rift = this;
    }
  }

  private begin(hero: HeroId, lane: Lane): void {
    this.sfx.unlock();
    this.stage.clear();
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.match = new Match({ playerHero: hero, playerLane: lane, seed });
    this.ended = false;
    this.acc = 0;
    const player = this.match.player;
    this.camera.position.set(player.x - 13, 16.5, player.z - 13);
    this.camera.setTarget(new Vector3(player.x, 1.2, player.z));
    this.hud.showMatch();
    this.sfx.blip(true);
  }

  private frame(): void {
    const now = performance.now();
    const frameDt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const time = now / 1000;
    this.arena.tick(time);

    const match = this.match;
    if (match && !match.winner) {
      this.acc = Math.min(this.acc + frameDt, 0.12);
      const events: SimEvent[] = [];
      let first = true;
      let guard = 0;
      while (this.acc >= STEP && guard < 4) {
        this.acc -= STEP;
        match.step(STEP, this.command(first));
        events.push(...match.events);
        first = false;
        guard += 1;
      }
      this.stage.sync(match, frameDt, events, time);
      this.arena.sync(match);
      this.hud.update(match, events, (x, y, z) => this.project(x, y, z));
      this.react(events);
      this.follow(frameDt);
    } else if (match) {
      this.stage.sync(match, frameDt, [], time);
      this.arena.sync(match);
      this.hud.update(match, [], (x, y, z) => this.project(x, y, z));
      if (!this.ended) {
        this.ended = true;
        this.sfx.fanfare(match.winner === "camelot");
      }
      this.follow(frameDt);
    } else {
      this.orbit(time);
    }
    this.scene.render();
  }

  private command(edges: boolean): PlayerCommand {
    const match = this.match;
    if (!match) return IDLE_INPUT;
    const raw = this.hud.sample(edges);
    const view = this.camera.getDirection(Vector3.Forward());
    let fx = view.x;
    let fz = view.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    const rx = fz;
    const rz = -fx;
    const moveX = rx * raw.sx + fx * raw.sy;
    const moveZ = rz * raw.sx + fz * raw.sy;
    let aimX = match.player.x + (Math.abs(moveX) + Math.abs(moveZ) > 0.05 ? moveX : Math.sin(match.player.yaw));
    let aimZ = match.player.z + (Math.abs(moveX) + Math.abs(moveZ) > 0.05 ? moveZ : Math.cos(match.player.yaw));
    if (Math.abs(moveX) + Math.abs(moveZ) > 0.05) {
      aimX = match.player.x + moveX * 8;
      aimZ = match.player.z + moveZ * 8;
    }
    if (raw.mouseAim) {
      const hit = this.groundAt(raw.mouseX, raw.mouseY);
      if (hit) {
        aimX = hit.x;
        aimZ = hit.z;
      }
    }
    return {
      moveX,
      moveZ,
      aimX,
      aimZ,
      attack: true,
      cast: raw.cast,
      recall: raw.recall,
      buy: raw.buy,
      focus: raw.focus,
    };
  }

  private groundAt(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const ray = this.scene.createPickingRay(clientX - rect.left, clientY - rect.top, null, this.camera);
    if (Math.abs(ray.direction.y) < 1e-4) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;
    return {
      x: ray.origin.x + ray.direction.x * t,
      z: ray.origin.z + ray.direction.z * t,
    };
  }

  private follow(dt: number): void {
    const match = this.match;
    if (!match) return;
    const player = match.player;
    const aspect = this.engine.getAspectRatio(this.camera);
    const back = aspect < 1 ? 17 : 15;
    const height = aspect < 1 ? 21 : 17.5;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const jx = (Math.random() - 0.5) * this.shake;
    const jz = (Math.random() - 0.5) * this.shake;
    const desired = new Vector3(player.x - back + jx, height, player.z - back + jz);
    const rate = 1 - Math.exp(-dt * 7);
    this.camera.position.x += (desired.x - this.camera.position.x) * rate;
    this.camera.position.y += (desired.y - this.camera.position.y) * rate;
    this.camera.position.z += (desired.z - this.camera.position.z) * rate;
    this.camera.setTarget(new Vector3(player.x, 1.15, player.z));
  }

  private orbit(time: number): void {
    const ang = time * 0.16;
    this.camera.position.set(Math.sin(ang) * 34, 24, Math.cos(ang) * 34);
    this.camera.setTarget(Vector3.Zero());
  }

  private react(events: SimEvent[]): void {
    const player = this.match?.player;
    if (!player) return;
    let sounds = 0;
    for (const event of events) {
      if (sounds >= 3) break;
      if (event.type === "hit" && event.melee && event.sourceId === player.id) {
        this.sfx.bonk(event.amount > 70);
        this.shake = Math.max(this.shake, 0.25);
        sounds += 1;
      } else if (event.type === "hit" && event.targetId === player.id) {
        this.sfx.bonk(true);
        this.shake = Math.max(this.shake, 0.45);
        sounds += 1;
      } else if (event.type === "cast" && event.sourceId === player.id) {
        this.sfx.blip(event.slot === 3);
        sounds += 1;
      } else if (event.type === "death" && (event.kind === "tower" || event.kind === "nexus")) {
        this.sfx.boom();
        sounds += 1;
      }
    }
  }

  private project(x: number, y: number, z: number): { x: number; y: number } | null {
    const viewport = this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
    const projected = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
    if (projected.z < 0 || projected.z > 1) return null;
    const scale = this.engine.getHardwareScalingLevel();
    return { x: projected.x * scale, y: projected.y * scale };
  }

  private applyScale(): void {
    const small = Math.min(window.innerWidth, window.innerHeight) < 720;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.15 : 1.35);
    this.engine.setHardwareScalingLevel(1 / dpr);
  }
}

function boot(): void {
  try {
    new Game();
  } catch (error) {
    const ui = document.getElementById("ui") ?? document.body;
    const fatal = document.createElement("div");
    fatal.className = "fatal";
    fatal.textContent = error instanceof Error ? error.message : "Camelot Rift failed to start.";
    ui.appendChild(fatal);
    console.error(error);
  }
}

boot();
