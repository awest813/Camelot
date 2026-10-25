import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Meshes/Builders/planeBuilder";
import "@babylonjs/core/Meshes/Builders/discBuilder";

import { HEROES } from "../moba/content";
import type { Match, SimEvent, Unit } from "../moba/sim";
import type { HeroId } from "../moba/types";
import { PAL, candy, teamColor } from "./palette";
import { HeroLibrary, type Rig } from "./heroes";

function unlit(scene: Scene, name: string, color: Color3) {
  const mat = candy(scene, name, color, 0);
  mat.disableLighting = true;
  mat.emissiveColor = color;
  return mat;
}

const HERO_TINT: Record<HeroId, Color3> = {
  arthur: new Color3(0.95, 0.78, 0.28),
  lancelot: new Color3(0.32, 0.62, 0.98),
  gawain: new Color3(0.95, 0.48, 0.18),
  merlin: new Color3(0.45, 0.48, 0.95),
  morgan: new Color3(0.72, 0.28, 0.78),
  tristan: new Color3(0.28, 0.75, 0.42),
};

interface Actor {
  root: TransformNode;
  yaw: TransformNode;
  fallback: TransformNode;
  bars: TransformNode;
  hp: Mesh;
  mana: Mesh | null;
  barWidth: number;
  rig: Rig | null;
  token: { alive: boolean };
  lastX: number;
  lastZ: number;
  bonk: number;
  flash: number;
  attack: number;
  hero: boolean;
}

interface Shot {
  mesh: Mesh;
}

interface Puddle {
  mesh: Mesh;
}

interface Spark {
  mesh: Mesh;
  life: number;
  grow: boolean;
}

export class Stage {
  private readonly actors = new Map<number, Actor>();
  private readonly shots = new Map<number, Shot>();
  private readonly puddles = new Map<number, Puddle>();
  private readonly sparks: Spark[] = [];
  private readonly shadowMat;
  private readonly barBg;
  private readonly hpAlly;
  private readonly hpEnemy;
  private readonly manaMat;
  private readonly burstMat;
  private readonly boltCamelot;
  private readonly boltMordred;
  private readonly shotCamelot;
  private readonly shotMordred;
  private readonly zoneCamelot;
  private readonly zoneMordred;

  constructor(
    private readonly scene: Scene,
    private readonly heroes: HeroLibrary,
  ) {
    this.shadowMat = candy(scene, "shadow", new Color3(0.08, 0.1, 0.16), 0, 0.28);
    this.shadowMat.disableLighting = true;
    this.barBg = unlit(scene, "barBg", new Color3(0.1, 0.08, 0.12));
    this.hpAlly = unlit(scene, "hpAlly", PAL.hpAlly);
    this.hpEnemy = unlit(scene, "hpEnemy", PAL.hpEnemy);
    this.manaMat = unlit(scene, "mana", PAL.mana);
    this.burstMat = candy(scene, "burst", new Color3(1, 0.92, 0.45), 0.8);
    this.boltCamelot = candy(scene, "boltGold", PAL.gold, 0.9);
    this.boltMordred = candy(scene, "boltRed", PAL.mordred, 0.9);
    this.shotCamelot = candy(scene, "shotGold", PAL.gold, 0.95);
    this.shotMordred = candy(scene, "shotRed", PAL.mordred, 0.95);
    this.zoneCamelot = candy(scene, "zoneGold", PAL.camelot, 0.45, 0.38);
    this.zoneMordred = candy(scene, "zoneRed", PAL.mordred, 0.45, 0.38);
  }

  clear(): void {
    for (const actor of this.actors.values()) this.disposeActor(actor);
    this.actors.clear();
    for (const shot of this.shots.values()) shot.mesh.dispose();
    this.shots.clear();
    for (const puddle of this.puddles.values()) puddle.mesh.dispose();
    this.puddles.clear();
    for (const spark of this.sparks) spark.mesh.dispose();
    this.sparks.length = 0;
  }

  sync(match: Match, dt: number, events: SimEvent[], time: number): void {
    const seen = new Set<number>();
    for (const unit of match.units) {
      if (unit.kind !== "hero" && unit.kind !== "minion") continue;
      seen.add(unit.id);
      let actor = this.actors.get(unit.id);
      if (!actor) {
        actor = this.spawnActor(unit);
        this.actors.set(unit.id, actor);
      }
      this.poseActor(actor, unit, dt, time);
    }
    for (const [id, actor] of this.actors) {
      if (seen.has(id)) continue;
      this.disposeActor(actor);
      this.actors.delete(id);
    }

    for (const event of events) {
      if (event.type === "hit" && event.melee) this.burst(event.x, event.z);
      if (event.type === "hit") {
        const actor = this.actors.get(event.targetId);
        if (actor) {
          actor.bonk = 1;
          actor.flash = 0.12;
        }
        const source = this.actors.get(event.sourceId);
        if (source && event.melee) source.attack = 0.42;
      }
      if (event.type === "cast") {
        const source = this.actors.get(event.sourceId);
        if (source) source.attack = 0.48;
      }
      if (event.type === "bolt") this.bolt(event.x, event.z, event.x2, event.z2, event.team);
    }

    this.syncShots(match);
    this.syncPuddles(match);
    this.fadeSparks(dt);
  }

  private spawnActor(unit: Unit): Actor {
    const root = new TransformNode(`u${unit.id}`, this.scene);
    const yaw = new TransformNode(`yaw${unit.id}`, this.scene);
    yaw.parent = root;
    const fallback = unit.kind === "hero" && unit.heroId
      ? this.heroToy(unit.heroId, unit.team)
      : this.creepToy(unit.minionKind === "caster", unit.team);
    fallback.parent = yaw;

    const shadow = MeshBuilder.CreateDisc(`sh${unit.id}`, { radius: unit.kind === "hero" ? 0.55 : 0.36, tessellation: 8 }, this.scene);
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = 0.04;
    shadow.parent = root;
    shadow.material = this.shadowMat;
    shadow.isPickable = false;

    const bars = new TransformNode(`bars${unit.id}`, this.scene);
    bars.parent = root;
    bars.position.y = unit.kind === "hero" ? 2.25 : 1.45;
    bars.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    const width = unit.kind === "hero" ? 1.7 : 1.05;
    const hp = this.bar(width, 0.28, unit.team === "camelot" ? this.hpAlly : this.hpEnemy);
    hp.frame.parent = bars;
    hp.frame.position.y = 0.16;
    let mana: Mesh | null = null;
    if (unit.kind === "hero") {
      const manaBar = this.bar(width, 0.12, this.manaMat);
      manaBar.frame.parent = bars;
      manaBar.frame.position.y = -0.08;
      mana = manaBar.fill;
    }

    const actor: Actor = {
      root,
      yaw,
      fallback,
      bars,
      hp: hp.fill,
      mana,
      barWidth: width * 0.96,
      rig: null,
      token: { alive: true },
      lastX: unit.x,
      lastZ: unit.z,
      bonk: 0,
      flash: 0,
      attack: 0,
      hero: unit.kind === "hero",
    };

    if (unit.kind === "hero" && unit.heroId) {
      const def = HEROES[unit.heroId];
      void this.heroes.attach(yaw, def.model, def.tint, actor.token).then((rig) => {
        if (!rig || !actor.token.alive) {
          rig?.dispose();
          return;
        }
        actor.rig = rig;
        actor.fallback.setEnabled(false);
        rig.play("Idle", true);
      });
    }
    return actor;
  }

  private poseActor(actor: Actor, unit: Unit, dt: number, time: number): void {
    const dx = unit.x - actor.lastX;
    const dz = unit.z - actor.lastZ;
    const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    actor.lastX = unit.x;
    actor.lastZ = unit.z;
    actor.root.position.set(unit.x, unit.alive ? 0 : -0.7, unit.z);
    actor.yaw.rotation.y = unit.yaw;
    if (!unit.alive) actor.yaw.rotation.x += (1.15 - actor.yaw.rotation.x) * 0.2;
    else actor.yaw.rotation.x *= 0.8;

    actor.bonk = Math.max(0, actor.bonk - dt * 5);
    actor.attack = Math.max(0, actor.attack - dt);
    const punch = actor.bonk;
    const bob = unit.alive && speed > 0.35 ? Math.sin(time * (actor.hero ? 8 : 12) + unit.id) * 0.055 : 0;
    actor.yaw.position.y = bob;
    actor.yaw.scaling.set(1 + punch * 0.22, (unit.alive ? 1 : 0.4) - punch * 0.24, 1 + punch * 0.22);

    const hpRatio = Math.max(0.04, unit.hp / unit.maxHp);
    actor.hp.scaling.x = hpRatio;
    actor.hp.position.x = (hpRatio - 1) * actor.barWidth * 0.5;
    actor.bars.setEnabled(unit.alive && (actor.hero || hpRatio < 0.98));
    if (actor.mana && unit.maxMana > 0) {
      const manaRatio = Math.max(0.04, unit.mana / unit.maxMana);
      actor.mana.scaling.x = manaRatio;
      actor.mana.position.x = (manaRatio - 1) * actor.barWidth * 0.5;
    }

    if (actor.flash > 0) {
      actor.flash -= dt;
      const on = actor.flash > 0;
      for (const mesh of actor.yaw.getChildMeshes()) {
        mesh.renderOverlay = on;
        mesh.overlayColor = Color3.White();
        mesh.overlayAlpha = 0.7;
      }
    }

    const rig = actor.rig;
    if (!rig || !unit.heroId) return;
    const def = HEROES[unit.heroId];
    if (!unit.alive) {
      if (rig.clip !== "Death_A") rig.play("Death_A", false);
      return;
    }
    if (actor.attack > 0.28) {
      if (rig.clip !== def.attackClip) rig.play(def.attackClip, false);
      return;
    }
    if (speed > 4.15) rig.play("Running_A", true);
    else if (speed > 0.45) rig.play("Walking_A", true);
    else rig.play("Idle", true);
  }

  private heroToy(id: HeroId, team: "camelot" | "mordred"): TransformNode {
    const node = new TransformNode(`toy-${id}`, this.scene);
    const bodyMat = candy(this.scene, `body-${id}`, HERO_TINT[id], 0.18);
    const cloth = candy(this.scene, `cloth-${id}`, teamColor(team, true), 0.12);
    const body = MeshBuilder.CreateSphere("body", { diameter: 0.72, segments: 6 }, this.scene);
    body.position.y = 0.85;
    body.scaling.y = 1.15;
    body.parent = node;
    body.material = bodyMat;
    body.isPickable = false;
    const head = MeshBuilder.CreateSphere("head", { diameter: 0.42, segments: 6 }, this.scene);
    head.position.y = 1.5;
    head.parent = node;
    head.material = candy(this.scene, `skin-${id}`, new Color3(0.96, 0.78, 0.62), 0.12);
    head.isPickable = false;
    const cape = MeshBuilder.CreateBox("cape", { width: 0.55, height: 0.7, depth: 0.12 }, this.scene);
    cape.position.set(0, 0.95, -0.28);
    cape.parent = node;
    cape.material = cloth;
    cape.isPickable = false;
    return node;
  }

  private creepToy(caster: boolean, team: "camelot" | "mordred"): TransformNode {
    const node = new TransformNode("creep", this.scene);
    const mat = candy(this.scene, `creep-${team}-${caster ? "c" : "m"}`, teamColor(team, caster), 0.16);
    if (caster) {
      const robe = MeshBuilder.CreateCylinder("robe", { diameterTop: 0.22, diameterBottom: 0.62, height: 0.85, tessellation: 6 }, this.scene);
      robe.position.y = 0.48;
      robe.parent = node;
      robe.material = mat;
      robe.isPickable = false;
    } else {
      const body = MeshBuilder.CreateSphere("blob", { diameter: 0.62, segments: 5 }, this.scene);
      body.position.y = 0.42;
      body.scaling.y = 0.8;
      body.parent = node;
      body.material = mat;
      body.isPickable = false;
    }
    const head = MeshBuilder.CreateSphere("head", { diameter: 0.34, segments: 5 }, this.scene);
    head.position.y = caster ? 1.05 : 0.82;
    head.parent = node;
    head.material = candy(this.scene, "creepHead", new Color3(0.96, 0.9, 0.78), 0.1);
    head.isPickable = false;
    return node;
  }

  private bar(width: number, height: number, fill: ReturnType<typeof candy>): { frame: Mesh; fill: Mesh } {
    const frame = MeshBuilder.CreatePlane("bar", { width, height, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    frame.material = this.barBg;
    frame.isPickable = false;
    frame.metadata = { noGlow: true };
    const fg = MeshBuilder.CreatePlane("fill", { width: width * 0.92, height: height * 0.7, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
    fg.material = fill;
    fg.parent = frame;
    fg.position.z = -0.05;
    fg.isPickable = false;
    fg.metadata = { noGlow: true };
    return { frame, fill: fg };
  }

  private syncShots(match: Match): void {
    const seen = new Set<number>();
    for (const shot of match.projectiles) {
      seen.add(shot.id);
      let view = this.shots.get(shot.id);
      if (!view) {
        const mesh = MeshBuilder.CreateSphere(`p${shot.id}`, { diameter: shot.ability ? 0.48 : 0.28, segments: 5 }, this.scene);
        mesh.material = shot.team === "camelot" ? this.shotCamelot : this.shotMordred;
        mesh.isPickable = false;
        view = { mesh };
        this.shots.set(shot.id, view);
      }
      view.mesh.position.set(shot.x, 0.85, shot.z);
    }
    for (const [id, view] of this.shots) {
      if (seen.has(id)) continue;
      view.mesh.dispose();
      this.shots.delete(id);
    }
  }

  private syncPuddles(match: Match): void {
    const seen = new Set<number>();
    for (const zone of match.zones) {
      seen.add(zone.id);
      let view = this.puddles.get(zone.id);
      if (!view) {
        const mesh = MeshBuilder.CreateCylinder(`z${zone.id}`, {
          diameter: zone.radius * 2,
          height: 0.1,
          tessellation: 12,
        }, this.scene);
        mesh.material = zone.team === "camelot" ? this.zoneCamelot : this.zoneMordred;
        mesh.isPickable = false;
        view = { mesh };
        this.puddles.set(zone.id, view);
      }
      view.mesh.position.set(zone.x, 0.12, zone.z);
    }
    for (const [id, view] of this.puddles) {
      if (seen.has(id)) continue;
      view.mesh.dispose();
      this.puddles.delete(id);
    }
  }

  private burst(x: number, z: number): void {
    const mesh = MeshBuilder.CreateBox("star", { size: 0.28 }, this.scene);
    mesh.material = this.burstMat;
    mesh.position.set(x, 0.9, z);
    mesh.rotation.set(0.4, 0.2, 0.6);
    mesh.isPickable = false;
    this.sparks.push({ mesh, life: 0.18, grow: true });
  }

  private bolt(x: number, z: number, x2: number, z2: number, team: "camelot" | "mordred"): void {
    const dx = x2 - x;
    const dz = z2 - z;
    const length = Math.hypot(dx, dz) || 0.2;
    const mesh = MeshBuilder.CreateBox("bolt", { width: 0.12, height: 0.12, depth: length }, this.scene);
    mesh.material = team === "camelot" ? this.boltCamelot : this.boltMordred;
    mesh.position.set((x + x2) / 2, 1.3, (z + z2) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.isPickable = false;
    this.sparks.push({ mesh, life: 0.12, grow: false });
  }

  private fadeSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.life -= dt;
      if (spark.grow) {
        const s = 1 + (0.18 - spark.life) * 8;
        spark.mesh.scaling.setAll(Math.max(0.2, s));
      }
      spark.mesh.visibility = Math.max(0, spark.life / 0.18);
      if (spark.life <= 0) {
        spark.mesh.dispose();
        this.sparks.splice(i, 1);
      }
    }
  }

  private disposeActor(actor: Actor): void {
    actor.token.alive = false;
    actor.rig?.dispose();
    actor.root.dispose(false, true);
  }
}
