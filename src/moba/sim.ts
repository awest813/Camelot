import {
  HEROES,
  ITEMS,
  MINIONS,
  NEXUS_STATS,
  TOWER_STATS,
  ULT_LEVEL,
  XP_TO_NEXT,
  abilityRange,
} from "./content";
import { clamp, dist, mulberry32 } from "./math";
import {
  BOUNDS,
  FIRST_WAVE,
  FOUNTAIN,
  FOUNTAIN_RADIUS,
  MINION_CAP,
  NEXUS_AT,
  RECALL_TIME,
  TOWER_SPAWNS,
  WAVE_INTERVAL,
  blockers,
  heroSpawn,
  otherTeam,
  pathFor,
} from "./map";
import { issueBotOrders, issueMinionOrders } from "./bots";
import type {
  AbilityEffect,
  AbilitySlot,
  EntityKind,
  HeroId,
  ItemId,
  Lane,
  MinionKind,
  PlayerCommand,
  Team,
  TowerTier,
} from "./types";

export interface Order {
  move: boolean;
  dx: number;
  dz: number;
  useDest: boolean;
  destX: number;
  destZ: number;
  cast: AbilitySlot | null;
  aimX: number;
  aimZ: number;
  attackId: number | null;
  recall: boolean;
}

export interface HurtTag {
  id: number;
  time: number;
}

export interface Unit {
  id: number;
  kind: EntityKind;
  team: Team;
  lane: Lane | null;
  tier: TowerTier | null;
  heroId: HeroId | null;
  minionKind: MinionKind | null;
  name: string;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  level: number;
  xp: number;
  gold: number;
  alive: boolean;
  respawnAt: number;
  radius: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  attackPeriod: number;
  moveSpeed: number;
  armor: number;
  abilityPower: number;
  ranged: boolean;
  aggro: number;
  player: boolean;
  bot: boolean;
  waypoint: number;
  cooldowns: [number, number, number, number];
  items: ItemId[];
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  goldValue: number;
  xpValue: number;
  shield: number;
  shieldT: number;
  stun: number;
  slow: number;
  slowT: number;
  dotDps: number;
  dotT: number;
  dotFrom: number | null;
  damageBonus: number;
  damageBonusT: number;
  speedBonus: number;
  speedBonusT: number;
  markHits: number;
  markMul: number;
  riposteT: number;
  recallT: number;
  lastCombat: number;
  damagedBy: HurtTag[];
  forceId: number | null;
  forceUntil: number;
  focusId: number | null;
  focusUntil: number;
  rampId: number | null;
  ramp: number;
  corpse: number;
  wantBuy: ItemId | null;
  dashed: boolean;
  order: Order;
}

export interface Projectile {
  id: number;
  team: Team;
  ownerId: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  speed: number;
  hitRadius: number;
  damage: number;
  ttl: number;
  homing: boolean;
  targetId: number | null;
  pierce: boolean;
  stun: number;
  slow: number;
  slowDur: number;
  dot: number;
  dotDur: number;
  ability: boolean;
  hit: number[];
}

export interface Zone {
  id: number;
  team: Team;
  ownerId: number;
  x: number;
  z: number;
  radius: number;
  dps: number;
  slow: number;
  ttl: number;
  tick: number;
}

export type SimEvent =
  | { type: "hit"; x: number; z: number; targetId: number; sourceId: number; amount: number; melee: boolean }
  | { type: "cast"; sourceId: number; slot: AbilitySlot; x: number; z: number }
  | { type: "death"; targetId: number; killerId: number | null; x: number; z: number; kind: EntityKind }
  | { type: "level"; targetId: number; level: number }
  | { type: "bolt"; x: number; z: number; x2: number; z2: number; team: Team }
  | { type: "text"; x: number; z: number; text: string; color: string }
  | { type: "killfeed"; text: string; team: Team }
  | { type: "end"; winner: Team };

export interface MatchConfig {
  playerHero: HeroId;
  playerLane: Lane;
  seed?: number;
}

export const IDLE_INPUT: PlayerCommand = {
  moveX: 0,
  moveZ: 0,
  aimX: 0,
  aimZ: 0,
  attack: false,
  cast: null,
  recall: false,
  buy: null,
  focus: false,
};

function blankOrder(): Order {
  return {
    move: false,
    dx: 0,
    dz: 0,
    useDest: false,
    destX: 0,
    destZ: 0,
    cast: null,
    aimX: 0,
    aimZ: 0,
    attackId: null,
    recall: false,
  };
}

interface HurtOpts {
  stun?: number;
  slow?: number;
  slowDur?: number;
  dot?: number;
  dotDur?: number;
  pure?: boolean;
  ignoreRiposte?: boolean;
  melee?: boolean;
}

export class Match {
  readonly units: Unit[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  events: SimEvent[] = [];
  time = 0;
  winner: Team | null = null;
  nextWave = FIRST_WAVE;
  wave = 0;
  private nextId = 1;
  private dt = 0;
  private input: PlayerCommand = IDLE_INPUT;
  private readonly rng: () => number;
  private readonly byId = new Map<number, Unit>();

  constructor(readonly config: MatchConfig) {
    const seed = config.seed ?? 1;
    this.rng = mulberry32(seed);
    this.buildRoster(seed);
    this.buildStructures();
  }

  get player(): Unit {
    const found = this.units.find((u) => u.player);
    if (!found) throw new Error("Match has no player hero");
    return found;
  }

  unit(id: number): Unit | null {
    return this.byId.get(id) ?? null;
  }

  step(dt: number, input: PlayerCommand = IDLE_INPUT): void {
    this.events.length = 0;
    if (this.winner || dt <= 0) return;
    this.dt = dt;
    this.input = input;
    this.time += dt;

    this.tickStatus();
    this.maybeSpawnWave();
    this.respawnHeroes();

    for (const u of this.units) u.order = blankOrder();
    this.applyPlayerInput();
    issueMinionOrders(this);
    issueBotOrders(this);
    this.resolveBuys();
    this.resolveCasts();
    this.resolveRecalls();
    this.moveUnits();
    this.separate();
    this.resolveAttacks();
    this.updateProjectiles();
    this.updateZones();
    this.wells();
    this.reap();
  }

  /** Test and script hook. Damage goes through armor, aggro, and kill credit. */
  inflict(fromId: number, toId: number, amount: number): void {
    const src = this.unit(fromId);
    const dst = this.unit(toId);
    if (!src || !dst) return;
    this.hurt(src, dst, amount, { melee: src.attackRange < 4 });
  }

  private buildRoster(seed: number): void {
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const pref: Record<HeroId, Lane[]> = {
      gawain: ["top", "mid", "bot"],
      arthur: ["mid", "top", "bot"],
      lancelot: ["top", "mid", "bot"],
      merlin: ["mid", "bot", "top"],
      morgan: ["mid", "top", "bot"],
      tristan: ["bot", "mid", "top"],
    };
    const pool = (Object.keys(HEROES) as HeroId[]).filter((id) => id !== this.config.playerHero);
    const take = (lane: Lane, team: Team): void => {
      let best = 0;
      let score = -1;
      for (let i = 0; i < pool.length; i++) {
        const s = (3 - pref[pool[i]].indexOf(lane)) * 10 + rng();
        if (s > score) {
          score = s;
          best = i;
        }
      }
      const heroId = pool.splice(best, 1)[0];
      this.spawnHero(heroId, team, lane, true);
    };
    this.spawnHero(this.config.playerHero, "camelot", this.config.playerLane, false);
    take("top", "mordred");
    take("mid", "mordred");
    take("bot", "mordred");
    for (const lane of ["top", "mid", "bot"] as const) {
      if (lane !== this.config.playerLane) take(lane, "camelot");
    }
  }

  private spawnHero(heroId: HeroId, team: Team, lane: Lane, bot: boolean): void {
    const def = HEROES[heroId];
    const at = heroSpawn(team, lane);
    this.add({
      kind: "hero",
      team,
      lane,
      tier: null,
      heroId,
      minionKind: null,
      name: def.name,
      x: at.x,
      z: at.z,
      yaw: team === "camelot" ? Math.PI / 4 : Math.PI + Math.PI / 4,
      hp: def.hp,
      maxHp: def.hp,
      mana: def.mana,
      maxMana: def.mana,
      attackDamage: def.ad,
      attackRange: def.range,
      attackPeriod: def.period,
      attackCooldown: 0.2,
      moveSpeed: def.speed,
      armor: def.armor,
      radius: def.radius,
      ranged: def.ranged,
      aggro: 8,
      player: !bot,
      bot,
      gold: 90,
      goldValue: 0,
      xpValue: 0,
    });
  }

  private buildStructures(): void {
    for (const team of ["camelot", "mordred"] as const) {
      const at = NEXUS_AT[team];
      this.add({
        kind: "nexus",
        team,
        lane: null,
        tier: null,
        heroId: null,
        minionKind: null,
        name: team === "camelot" ? "Round Table" : "Black Throne",
        x: at.x,
        z: at.z,
        yaw: 0,
        hp: NEXUS_STATS.hp,
        maxHp: NEXUS_STATS.hp,
        mana: 0,
        maxMana: 0,
        attackDamage: NEXUS_STATS.ad,
        attackRange: NEXUS_STATS.range,
        attackPeriod: NEXUS_STATS.period,
        attackCooldown: 0.4,
        moveSpeed: 0,
        armor: NEXUS_STATS.armor,
        radius: NEXUS_STATS.radius,
        ranged: false,
        aggro: 0,
        player: false,
        bot: false,
        gold: 0,
        goldValue: 0,
        xpValue: 0,
      });
    }
    for (const tower of TOWER_SPAWNS) {
      const stats = TOWER_STATS[tower.tier];
      this.add({
        kind: "tower",
        team: tower.team,
        lane: tower.lane,
        tier: tower.tier,
        heroId: null,
        minionKind: null,
        name: `${tower.tier} tower`,
        x: tower.x,
        z: tower.z,
        yaw: 0,
        hp: stats.hp,
        maxHp: stats.hp,
        mana: 0,
        maxMana: 0,
        attackDamage: stats.ad,
        attackRange: stats.range,
        attackPeriod: stats.period,
        attackCooldown: this.rng() * stats.period,
        moveSpeed: 0,
        armor: stats.armor,
        radius: stats.radius,
        ranged: false,
        aggro: 0,
        player: false,
        bot: false,
        gold: 0,
        goldValue: 0,
        xpValue: 0,
      });
    }
  }

  private add(partial: Omit<Unit,
    | "id" | "level" | "xp" | "alive" | "respawnAt" | "abilityPower" | "waypoint" | "cooldowns"
    | "items" | "kills" | "deaths" | "assists" | "cs" | "shield" | "shieldT" | "stun" | "slow"
    | "slowT" | "dotDps" | "dotT" | "dotFrom" | "damageBonus" | "damageBonusT" | "speedBonus"
    | "speedBonusT" | "markHits" | "markMul" | "riposteT" | "recallT" | "lastCombat"
    | "damagedBy" | "forceId" | "forceUntil" | "focusId" | "focusUntil" | "rampId" | "ramp"
    | "corpse" | "wantBuy" | "dashed" | "order">): Unit {
    const unit: Unit = {
      ...partial,
      id: this.nextId++,
      level: 1,
      xp: 0,
      alive: true,
      respawnAt: 0,
      abilityPower: 0,
      waypoint: 1,
      cooldowns: [0, 0, 0, 0],
      items: [],
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
      shield: 0,
      shieldT: 0,
      stun: 0,
      slow: 0,
      slowT: 0,
      dotDps: 0,
      dotT: 0,
      dotFrom: null,
      damageBonus: 1,
      damageBonusT: 0,
      speedBonus: 0,
      speedBonusT: 0,
      markHits: 0,
      markMul: 0,
      riposteT: 0,
      recallT: 0,
      lastCombat: -10,
      damagedBy: [],
      forceId: null,
      forceUntil: -1,
      focusId: null,
      focusUntil: -1,
      rampId: null,
      ramp: 0,
      corpse: 0,
      wantBuy: null,
      dashed: false,
      order: blankOrder(),
    };
    this.units.push(unit);
    this.byId.set(unit.id, unit);
    return unit;
  }

  private tickStatus(): void {
    const dt = this.dt;
    for (const u of this.units) {
      if (u.attackCooldown > 0) u.attackCooldown -= dt;
      if (u.stun > 0) u.stun -= dt;
      if (u.slowT > 0) u.slowT -= dt;
      if (u.shieldT > 0) {
        u.shieldT -= dt;
        if (u.shieldT <= 0) u.shield = 0;
      }
      if (u.damageBonusT > 0) u.damageBonusT -= dt;
      if (u.speedBonusT > 0) u.speedBonusT -= dt;
      if (u.riposteT > 0) u.riposteT -= dt;
      for (let i = 0; i < 4; i++) {
        if (u.cooldowns[i] > 0) u.cooldowns[i] -= dt;
      }
      if (!u.alive) continue;
      if (u.dotT > 0) {
        const from = u.dotFrom != null ? this.unit(u.dotFrom) : null;
        this.hurt(from, u, u.dotDps * dt, {});
        u.dotT -= dt;
      }
      if (!u.alive || u.kind !== "hero") continue;
      const home = dist(u, FOUNTAIN[u.team]) < FOUNTAIN_RADIUS;
      const combat = this.time - u.lastCombat < 4;
      const hpRate = home ? u.maxHp * 0.16 : combat ? 1.4 : 7;
      const mpRate = home ? u.maxMana * 0.18 : combat ? 3 : 9;
      u.hp = Math.min(u.maxHp, u.hp + hpRate * dt);
      u.mana = Math.min(u.maxMana, u.mana + mpRate * dt);
      u.gold += 1.7 * dt;
    }
  }

  private maybeSpawnWave(): void {
    if (this.time < this.nextWave) return;
    this.wave += 1;
    this.nextWave += WAVE_INTERVAL;
    for (const team of ["camelot", "mordred"] as const) {
      for (const lane of ["top", "mid", "bot"] as const) this.spawnWave(team, lane, this.wave);
    }
  }

  private spawnWave(team: Team, lane: Lane, wave: number): void {
    const alive = this.units.filter((u) => u.alive && u.kind === "minion" && u.team === team && u.lane === lane).length;
    if (alive >= MINION_CAP) return;
    const path = pathFor(team, lane);
    const a = path[0];
    const b = path[Math.min(1, path.length - 1)];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const px = -dz;
    const pz = dx;
    const slots: Array<{ kind: MinionKind; lat: number; along: number }> = [
      { kind: "melee", lat: -1.15, along: 0.35 },
      { kind: "melee", lat: 0, along: 0.9 },
      { kind: "melee", lat: 1.15, along: 0.35 },
      { kind: "caster", lat: 0, along: -1.2 },
    ];
    const room = MINION_CAP - alive;
    for (let i = 0; i < slots.length && i < room; i++) {
      const slot = slots[i];
      this.spawnMinion(
        team,
        lane,
        slot.kind,
        a.x + dx * slot.along + px * slot.lat,
        a.z + dz * slot.along + pz * slot.lat,
        wave,
        Math.atan2(dx, dz),
      );
    }
  }

  private spawnMinion(team: Team, lane: Lane, kind: MinionKind, x: number, z: number, wave: number, yaw: number): void {
    const stats = MINIONS[kind];
    const grow = 1 + (wave - 1) * 0.08;
    const name = team === "camelot"
      ? (kind === "melee" ? "Squire" : "Archer")
      : (kind === "melee" ? "Wight" : "Hexer");
    this.add({
      kind: "minion",
      team,
      lane,
      tier: null,
      heroId: null,
      minionKind: kind,
      name,
      x,
      z,
      yaw,
      hp: stats.hp * grow,
      maxHp: stats.hp * grow,
      mana: 0,
      maxMana: 0,
      attackDamage: stats.ad + (wave - 1) * 1.2,
      attackRange: stats.range,
      attackPeriod: stats.period,
      attackCooldown: this.rng() * stats.period,
      moveSpeed: stats.speed,
      armor: stats.armor,
      radius: stats.radius,
      ranged: stats.range > 4,
      aggro: stats.aggro,
      player: false,
      bot: false,
      gold: 0,
      goldValue: stats.gold,
      xpValue: stats.xp,
    });
  }

  private respawnHeroes(): void {
    for (const u of this.units) {
      if (u.alive || u.kind !== "hero" || this.time < u.respawnAt) continue;
      const at = heroSpawn(u.team, u.lane ?? "mid");
      u.alive = true;
      u.hp = u.maxHp;
      u.mana = u.maxMana;
      u.x = at.x;
      u.z = at.z;
      u.shield = 0;
      u.stun = 0;
      u.dotT = 0;
      u.recallT = 0;
      u.slowT = 0;
      this.events.push({ type: "text", x: u.x, z: u.z, text: "Returned", color: "#d8fff0" });
    }
  }

  private applyPlayerInput(): void {
    const u = this.player;
    const input = this.input;
    if (!u.alive || u.stun > 0) return;
    if (input.focus) {
      const heroes = this.enemiesOf(u).filter((e) => e.kind === "hero" && dist(u, e) < 12);
      const hero = this.closest(u, heroes);
      if (hero) {
        u.focusId = hero.id;
        u.focusUntil = this.time + 3;
      }
    }
    const stick = Math.hypot(input.moveX, input.moveZ);
    if (stick > 0.12) {
      u.order.move = true;
      u.order.dx = input.moveX / stick;
      u.order.dz = input.moveZ / stick;
      u.recallT = 0;
    } else if (u.focusId != null && this.time < u.focusUntil) {
      const focused = this.unit(u.focusId);
      if (focused && focused.alive && !this.inRange(u, focused)) {
        u.order.useDest = true;
        u.order.destX = focused.x;
        u.order.destZ = focused.z;
      }
    }
    if (input.cast != null) {
      u.order.cast = input.cast;
      u.order.aimX = input.aimX;
      u.order.aimZ = input.aimZ;
      u.recallT = 0;
    }
    if (input.recall && stick <= 0.12 && input.cast == null) u.order.recall = true;
    if (input.buy) u.wantBuy = input.buy;
  }

  private resolveBuys(): void {
    for (const u of this.units) {
      if (!u.wantBuy) continue;
      const item = u.wantBuy;
      u.wantBuy = null;
      this.buy(u, item);
    }
  }

  private buy(u: Unit, id: ItemId): void {
    if (!u.alive || u.kind !== "hero") return;
    if (u.items.includes(id) || u.items.length >= 4) return;
    if (dist(u, FOUNTAIN[u.team]) > FOUNTAIN_RADIUS + 0.25) return;
    const item = ITEMS[id];
    if (u.gold < item.cost) return;
    u.gold -= item.cost;
    u.items.push(id);
    if (item.hp) {
      u.maxHp += item.hp;
      u.hp += item.hp;
    }
    if (item.ad) u.attackDamage += item.ad;
    if (item.ap) u.abilityPower += item.ap;
    if (item.speed) u.moveSpeed += item.speed;
    this.events.push({ type: "text", x: u.x, z: u.z, text: item.name, color: "#ffe9a2" });
  }

  private resolveCasts(): void {
    for (const u of this.units) {
      if (u.kind !== "hero" || !u.alive || u.order.cast == null) continue;
      this.tryCast(u, u.order.cast);
    }
  }

  private tryCast(u: Unit, slot: AbilitySlot): void {
    if (!u.heroId || u.stun > 0 || u.recallT > 0) return;
    if (slot === 3 && u.level < ULT_LEVEL) return;
    const def = HEROES[u.heroId].abilities[slot];
    if (u.cooldowns[slot] > 0 || u.mana < def.mana) return;
    if (def.effect.type === "flurry" && !this.foeInRange(u, def.effect.range)) return;
    const aim = this.aimDir(u, u.order.aimX, u.order.aimZ, def.effect);
    u.mana -= def.mana;
    u.cooldowns[slot] = def.cooldown;
    u.order.recall = false;
    u.recallT = 0;
    u.dashed = this.applyEffect(u, def.effect, aim);
    if (u.dashed) {
      u.order.move = false;
      u.order.useDest = false;
      u.focusId = null;
    }
    this.events.push({ type: "cast", sourceId: u.id, slot, x: u.x, z: u.z });
  }

  private aimDir(u: Unit, aimX: number, aimZ: number, effect: AbilityEffect): { x: number; z: number; enemy: Unit | null } {
    let dx = aimX - u.x;
    let dz = aimZ - u.z;
    let mag = Math.hypot(dx, dz);
    if (mag < 0.3) {
      dx = Math.sin(u.yaw);
      dz = Math.cos(u.yaw);
      mag = 1;
    }
    dx /= mag;
    dz /= mag;
    const range = abilityRange(effect);
    if (range <= 0) return { x: dx, z: dz, enemy: null };
    let best: Unit | null = null;
    let bestScore = 0;
    for (const e of this.enemiesOf(u)) {
      if (e.kind === "tower" || e.kind === "nexus") continue;
      const ex = e.x - u.x;
      const ez = e.z - u.z;
      const ed = Math.hypot(ex, ez) || 1;
      if (ed > range + e.radius + 0.4) continue;
      const dot = (ex / ed) * dx + (ez / ed) * dz;
      if (dot < 0.78) continue;
      const score = dot + (e.kind === "hero" ? 0.3 : 0) - ed * 0.012;
      if (!best || score > bestScore) {
        best = e;
        bestScore = score;
      }
    }
    if (!best) return { x: dx, z: dz, enemy: null };
    const ex = best.x - u.x;
    const ez = best.z - u.z;
    const ed = Math.hypot(ex, ez) || 1;
    return { x: ex / ed, z: ez / ed, enemy: best };
  }

  private applyEffect(u: Unit, effect: AbilityEffect, dir: { x: number; z: number; enemy: Unit | null }): boolean {
    switch (effect.type) {
      case "cone":
        for (const e of this.enemiesOf(u)) {
          const dx = e.x - u.x;
          const dz = e.z - u.z;
          const d = Math.hypot(dx, dz);
          if (d > effect.radius + e.radius * 0.5) continue;
          if (d > 0.05) {
            const dot = (dx / d) * dir.x + (dz / d) * dir.z;
            if (dot < Math.cos(effect.arc / 2)) continue;
          }
          this.hurt(u, e, this.scaled(u, effect.damage), { stun: effect.stun ?? 0 });
        }
        u.yaw = Math.atan2(dir.x, dir.z);
        return false;
      case "nova":
        for (const e of this.enemiesOf(u)) {
          if (dist(u, e) > effect.radius + e.radius * 0.4) continue;
          this.hurt(u, e, this.scaled(u, effect.damage), { stun: effect.stun ?? 0 });
        }
        return false;
      case "projectile":
        this.launch(u, dir.x, dir.z, {
          speed: effect.speed,
          hitRadius: effect.hitRadius,
          damage: this.scaled(u, effect.damage),
          ttl: effect.range / effect.speed + 0.12,
          homing: false,
          targetId: null,
          pierce: effect.pierce ?? false,
          stun: effect.stun ?? 0,
          slow: effect.slow ?? 0,
          slowDur: effect.slowDur ?? (effect.stun ? 0.2 : 0),
          dot: effect.dot ? this.scaled(u, effect.dot) : 0,
          dotDur: effect.dotDur ?? 0,
          ability: true,
        });
        u.yaw = Math.atan2(dir.x, dir.z);
        return false;
      case "fan": {
        const mid = Math.atan2(dir.x, dir.z);
        for (let i = 0; i < effect.count; i++) {
          const ang = mid + (i - (effect.count - 1) / 2) * effect.spread;
          this.launch(u, Math.sin(ang), Math.cos(ang), {
            speed: effect.speed,
            hitRadius: effect.hitRadius,
            damage: this.scaled(u, effect.damage),
            ttl: effect.range / effect.speed + 0.1,
            homing: false,
            targetId: null,
            pierce: false,
            stun: 0,
            slow: 0,
            slowDur: 0,
            dot: 0,
            dotDur: 0,
            ability: true,
          });
        }
        u.yaw = mid;
        return false;
      }
      case "dash": {
        const steps = Math.max(1, Math.ceil(effect.distance / 0.4));
        const step = effect.distance / steps;
        const hit = new Set<number>();
        for (let i = 0; i < steps; i++) {
          u.x = clamp(u.x + dir.x * step, -BOUNDS, BOUNDS);
          u.z = clamp(u.z + dir.z * step, -BOUNDS, BOUNDS);
          this.pushOut(u);
          if (effect.damage <= 0 || effect.hitRadius <= 0) continue;
          for (const e of this.enemiesOf(u)) {
            if (hit.has(e.id)) continue;
            if (dist(u, e) > effect.hitRadius + e.radius) continue;
            hit.add(e.id);
            this.hurt(u, e, this.scaled(u, effect.damage), {});
          }
        }
        u.yaw = Math.atan2(dir.x, dir.z);
        return true;
      }
      case "blink":
        u.x = clamp(u.x + dir.x * effect.distance, -BOUNDS, BOUNDS);
        u.z = clamp(u.z + dir.z * effect.distance, -BOUNDS, BOUNDS);
        this.pushOut(u);
        u.yaw = Math.atan2(dir.x, dir.z);
        return true;
      case "shield":
        u.shield = Math.max(u.shield, this.scaled(u, effect.amount));
        u.shieldT = effect.duration;
        this.events.push({ type: "text", x: u.x, z: u.z, text: "Aegis", color: "#d7ecff" });
        return false;
      case "buff":
        if (effect.damageMul) {
          u.damageBonus = effect.damageMul;
          u.damageBonusT = effect.duration;
        }
        if (effect.speed) {
          u.speedBonus = effect.speed;
          u.speedBonusT = effect.duration;
        }
        return false;
      case "mark":
        u.markHits = effect.hits;
        u.markMul = effect.mul;
        this.events.push({ type: "text", x: u.x, z: u.z, text: "Mark", color: "#ffe08a" });
        return false;
      case "riposte":
        u.riposteT = effect.duration;
        this.events.push({ type: "text", x: u.x, z: u.z, text: "Riposte", color: "#d7ecff" });
        return false;
      case "zone": {
        let dx = dir.enemy ? dir.enemy.x - u.x : dir.x;
        let dz = dir.enemy ? dir.enemy.z - u.z : dir.z;
        let d = Math.hypot(dx, dz);
        if (d < 0.2) {
          dx = dir.x;
          dz = dir.z;
          d = 1;
        }
        const k = Math.min(1, effect.range / d);
        this.zones.push({
          id: this.nextId++,
          team: u.team,
          ownerId: u.id,
          x: u.x + dx * k,
          z: u.z + dz * k,
          radius: effect.radius,
          dps: this.scaled(u, effect.dps),
          slow: effect.slow,
          ttl: effect.duration,
          tick: 0.05,
        });
        u.yaw = Math.atan2(dx, dz);
        return false;
      }
      case "flurry": {
        const foe = dir.enemy && dist(u, dir.enemy) <= effect.range + dir.enemy.radius
          ? dir.enemy
          : this.foeInRange(u, effect.range);
        if (!foe) return false;
        u.yaw = Math.atan2(foe.x - u.x, foe.z - u.z);
        for (let i = 0; i < effect.hits; i++) {
          if (!foe.alive) break;
          this.hurt(u, foe, this.scaled(u, effect.damage), { melee: true });
        }
        return false;
      }
      default:
        return false;
    }
  }

  private launch(u: Unit, dx: number, dz: number, shot: Omit<Projectile, "id" | "team" | "ownerId" | "x" | "z" | "vx" | "vz" | "hit">): void {
    this.projectiles.push({
      ...shot,
      id: this.nextId++,
      team: u.team,
      ownerId: u.id,
      x: u.x + dx * 0.7,
      z: u.z + dz * 0.7,
      vx: dx * shot.speed,
      vz: dz * shot.speed,
      hit: [],
    });
  }

  private scaled(u: Unit, base: number): number {
    return base * (1 + u.abilityPower / 100) * (1 + 0.08 * (u.level - 1));
  }

  private resolveRecalls(): void {
    for (const u of this.units) {
      if (u.kind !== "hero" || !u.alive) continue;
      if (u.order.recall && u.stun <= 0) {
        u.recallT += this.dt;
        if (u.recallT >= RECALL_TIME) {
          const home = heroSpawn(u.team, u.lane ?? "mid");
          u.x = home.x;
          u.z = home.z;
          u.recallT = 0;
          u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.2);
          u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.2);
          this.events.push({ type: "text", x: u.x, z: u.z, text: "Recalled", color: "#d8fff0" });
        }
      } else if (!u.order.recall) {
        u.recallT = 0;
      }
    }
  }

  private moveUnits(): void {
    for (const u of this.units) {
      if (!u.alive || u.stun > 0 || u.recallT > 0) continue;
      if (u.kind === "tower" || u.kind === "nexus") continue;
      if (u.dashed) {
        u.dashed = false;
        continue;
      }
      let vx = 0;
      let vz = 0;
      if (u.order.useDest) {
        const dx = u.order.destX - u.x;
        const dz = u.order.destZ - u.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.35) {
          vx = dx / d;
          vz = dz / d;
        }
      } else if (u.order.move) {
        vx = u.order.dx;
        vz = u.order.dz;
      }
      const mag = Math.hypot(vx, vz);
      if (mag < 0.05) continue;
      vx /= mag;
      vz /= mag;
      let speed = u.moveSpeed + (u.speedBonusT > 0 ? u.speedBonus : 0);
      if (u.slowT > 0) speed *= 1 - u.slow;
      u.x = clamp(u.x + vx * speed * this.dt, -BOUNDS, BOUNDS);
      u.z = clamp(u.z + vz * speed * this.dt, -BOUNDS, BOUNDS);
      this.pushOut(u);
      u.yaw = Math.atan2(vx, vz);
    }
  }

  private pushOut(u: Unit): void {
    for (const s of this.units) {
      if (!s.alive || (s.kind !== "tower" && s.kind !== "nexus") || s.id === u.id) continue;
      this.pushCircle(u, s.x, s.z, s.radius + u.radius * 0.85);
    }
    // Props are decorative collisions, kept light so lanes stay open.
    // Imported lazily via the map module's blockers — inlined call below.
    for (const o of BLOCKS) this.pushCircle(u, o.x, o.z, o.r + u.radius * 0.55);
    u.x = clamp(u.x, -BOUNDS, BOUNDS);
    u.z = clamp(u.z, -BOUNDS, BOUNDS);
  }

  private pushCircle(u: Unit, x: number, z: number, radius: number): void {
    const dx = u.x - x;
    const dz = u.z - z;
    const d = Math.hypot(dx, dz);
    if (d >= radius || radius <= 0) return;
    if (d < 0.0001) {
      u.x += radius;
      return;
    }
    const k = (radius - d) / d;
    u.x += dx * k;
    u.z += dz * k;
  }

  private separate(): void {
    const bodies = this.units.filter((u) => u.alive && (u.kind === "hero" || u.kind === "minion"));
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        let d = Math.hypot(dx, dz);
        const min = (a.radius + b.radius) * 0.92;
        if (d >= min) continue;
        if (d < 0.0001) {
          a.x -= 0.04;
          b.x += 0.04;
          d = 0.08;
        }
        const push = (min - d) / 2 / d;
        a.x -= dx * push;
        a.z -= dz * push;
        b.x += dx * push;
        b.z += dz * push;
      }
    }
  }

  private resolveAttacks(): void {
    for (const u of this.units) {
      if (!u.alive || u.stun > 0 || u.recallT > 0 || u.attackCooldown > 0) continue;
      const target = u.kind === "tower" || u.kind === "nexus" ? this.structureTarget(u) : this.bodyTarget(u);
      if (!target || !this.inRange(u, target)) continue;
      this.fire(u, target);
    }
  }

  private bodyTarget(u: Unit): Unit | null {
    if (u.player) return this.playerTarget(u);
    if (u.order.attackId == null) return null;
    const target = this.unit(u.order.attackId);
    if (!target || !target.alive || target.team === u.team) return null;
    return target;
  }

  private playerTarget(u: Unit): Unit | null {
    const focused = u.focusId != null && this.time < u.focusUntil ? this.unit(u.focusId) : null;
    const focusLive = focused && focused.alive && focused.team !== u.team ? focused : null;
    if (!this.input.attack && !focusLive) return null;
    if (focusLive && this.inRange(u, focusLive)) return focusLive;
    if (focusLive) return null;
    if (!this.input.attack) return null;
    const inRange = this.enemiesOf(u).filter((e) => this.inRange(u, e));
    const hit = this.previewDamage(u);
    const killable = inRange.filter((e) => e.kind === "minion" && e.hp <= hit * 100 / (100 + e.armor) + 0.75);
    if (killable.length) return this.lowest(killable);
    const heroes = inRange.filter((e) => e.kind === "hero");
    if (heroes.length) return this.closest(u, heroes);
    const creeps = inRange.filter((e) => e.kind === "minion");
    if (creeps.length) return this.lowest(creeps);
    const structs = inRange.filter((e) => e.kind === "tower" || e.kind === "nexus");
    if (structs.length) return this.closest(u, structs);
    return null;
  }

  private structureTarget(u: Unit): Unit | null {
    if (u.forceId != null && this.time < u.forceUntil) {
      const forced = this.unit(u.forceId);
      if (forced && forced.alive && forced.team !== u.team && this.inRange(u, forced)) return forced;
    }
    let minion: Unit | null = null;
    let minionD = Infinity;
    let hero: Unit | null = null;
    let heroD = Infinity;
    for (const e of this.enemiesOf(u)) {
      if (!this.inRange(u, e)) continue;
      const d = dist(u, e);
      if (e.kind === "minion" && d < minionD) {
        minion = e;
        minionD = d;
      } else if (e.kind === "hero" && d < heroD) {
        hero = e;
        heroD = d;
      }
    }
    return minion ?? hero;
  }

  private fire(u: Unit, target: Unit): void {
    u.attackCooldown = u.attackPeriod;
    u.yaw = Math.atan2(target.x - u.x, target.z - u.z);
    const melee = !u.ranged && u.kind !== "tower" && u.kind !== "nexus";
    let damage = melee || (u.kind !== "tower" && u.kind !== "nexus") ? this.consumeAttackDamage(u) : u.attackDamage;
    if (u.kind === "tower" || u.kind === "nexus") {
      if (u.rampId === target.id) u.ramp = Math.min(5, u.ramp + 1);
      else {
        u.rampId = target.id;
        u.ramp = 1;
      }
      damage = u.attackDamage * (1 + 0.22 * (u.ramp - 1));
      this.events.push({ type: "bolt", x: u.x, z: u.z, x2: target.x, z2: target.z, team: u.team });
      this.hurt(u, target, damage, { melee: false });
      return;
    }
    if (u.ranged) {
      const dx = target.x - u.x;
      const dz = target.z - u.z;
      const d = Math.hypot(dx, dz) || 1;
      this.launch(u, dx / d, dz / d, {
        speed: 15,
        hitRadius: 0.42,
        damage,
        ttl: 1.5,
        homing: true,
        targetId: target.id,
        pierce: false,
        stun: 0,
        slow: 0,
        slowDur: 0,
        dot: 0,
        dotDur: 0,
        ability: false,
      });
      return;
    }
    this.hurt(u, target, damage, { melee: true });
  }

  private previewDamage(u: Unit): number {
    let damage = u.attackDamage;
    if (u.damageBonusT > 0) damage *= u.damageBonus;
    if (u.markHits > 0) damage *= 1 + u.markMul;
    return damage;
  }

  private consumeAttackDamage(u: Unit): number {
    const damage = this.previewDamage(u);
    if (u.markHits > 0) u.markHits -= 1;
    return damage;
  }

  private updateProjectiles(): void {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      p.ttl -= this.dt;
      if (p.homing && p.targetId != null) {
        const target = this.unit(p.targetId);
        if (target && target.alive) {
          const dx = target.x - p.x;
          const dz = target.z - p.z;
          const d = Math.hypot(dx, dz) || 1;
          p.vx = (dx / d) * p.speed;
          p.vz = (dz / d) * p.speed;
          if (d <= p.hitRadius + target.radius) {
            const owner = this.unit(p.ownerId);
            this.hurt(owner, target, p.damage, {
              stun: p.stun,
              slow: p.slow,
              slowDur: p.slowDur,
              dot: p.dot,
              dotDur: p.dotDur,
              melee: false,
            });
            continue;
          }
        }
      }
      p.x += p.vx * this.dt;
      p.z += p.vz * this.dt;
      let consumed = false;
      if (!p.homing) {
        const owner = this.unit(p.ownerId);
        for (const e of this.units) {
          if (!e.alive || e.team === p.team || p.hit.includes(e.id)) continue;
          if (dist(p, e) > p.hitRadius + e.radius) continue;
          p.hit.push(e.id);
          this.hurt(owner, e, p.damage, {
            stun: p.stun,
            slow: p.slow,
            slowDur: p.slowDur,
            dot: p.dot,
            dotDur: p.dotDur,
            melee: false,
          });
          if (!p.pierce) {
            consumed = true;
            break;
          }
        }
      }
      if (!consumed && p.ttl > 0 && Math.abs(p.x) < BOUNDS + 4 && Math.abs(p.z) < BOUNDS + 4) keep.push(p);
    }
    this.projectiles = keep;
  }

  private updateZones(): void {
    const keep: Zone[] = [];
    for (const zone of this.zones) {
      zone.ttl -= this.dt;
      zone.tick -= this.dt;
      if (zone.tick <= 0) {
        zone.tick += 0.25;
        const owner = this.unit(zone.ownerId);
        for (const e of this.units) {
          if (!e.alive || e.team === zone.team) continue;
          if (dist(e, zone) > zone.radius + e.radius * 0.35) continue;
          this.hurt(owner, e, zone.dps * 0.25, { slow: zone.slow, slowDur: 0.45 });
        }
      }
      if (zone.ttl > 0) keep.push(zone);
    }
    this.zones = keep;
  }

  private wells(): void {
    for (const u of this.units) {
      if (!u.alive || u.kind === "tower" || u.kind === "nexus") continue;
      const enemy = FOUNTAIN[otherTeam(u.team)];
      if (dist(u, enemy) >= FOUNTAIN_RADIUS) continue;
      const nexus = this.units.find((n) => n.kind === "nexus" && n.team === otherTeam(u.team)) ?? null;
      this.hurt(nexus, u, 120 * this.dt, { pure: true });
    }
  }

  private reap(): void {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.alive || u.kind !== "minion") continue;
      u.corpse -= this.dt;
      if (u.corpse > 0) continue;
      this.byId.delete(u.id);
      this.units.splice(i, 1);
    }
  }

  private hurt(src: Unit | null, dst: Unit, raw: number, opts: HurtOpts): number {
    if (!dst.alive || raw <= 0 || this.winner) return 0;
    if (src && src.team === dst.team) return 0;
    if (!opts.ignoreRiposte && dst.riposteT > 0 && src && src.id !== dst.id) {
      dst.riposteT = 0;
      this.events.push({ type: "text", x: dst.x, z: dst.z, text: "Riposte", color: "#d7ecff" });
      this.hurt(dst, src, raw * 0.55, { ignoreRiposte: true, melee: true });
      return 0;
    }
    let amount = raw;
    if (!opts.pure) amount *= 100 / (100 + Math.max(0, dst.armor));
    if (dst.shield > 0) {
      const used = Math.min(dst.shield, amount);
      dst.shield -= used;
      amount -= used;
    }
    if (amount < 0.05) return 0;
    dst.hp -= amount;
    const sourceId = src?.id ?? -1;
    this.events.push({
      type: "hit",
      x: dst.x,
      z: dst.z,
      targetId: dst.id,
      sourceId,
      amount,
      melee: opts.melee ?? false,
    });
    const color = src?.player ? "#ffe56a" : dst.player ? "#ff6d7d" : "#ffe1ea";
    if (amount >= 1) {
      this.events.push({ type: "text", x: dst.x, z: dst.z, text: `${Math.round(amount)}`, color });
    }
    if (src) {
      dst.damagedBy.push({ id: src.id, time: this.time });
      if (dst.damagedBy.length > 12) dst.damagedBy.shift();
      if (src.kind === "hero") src.lastCombat = this.time;
      if (dst.kind === "hero") dst.lastCombat = this.time;
      if (src.kind === "hero" && dst.kind === "hero") this.alertDefenders(src, dst);
      if (opts.stun) dst.stun = Math.max(dst.stun, opts.stun);
      if (opts.slow && opts.slowDur) {
        dst.slow = Math.max(dst.slow, Math.min(0.65, opts.slow));
        dst.slowT = Math.max(dst.slowT, opts.slowDur);
      }
      if (opts.dot && opts.dotDur) {
        dst.dotDps = opts.dot;
        dst.dotT = opts.dotDur;
        dst.dotFrom = src.id;
      }
    }
    if (dst.recallT > 0) dst.recallT = 0;
    if (dst.hp <= 0) this.die(dst, src);
    return amount;
  }

  private alertDefenders(attacker: Unit, victim: Unit): void {
    for (const s of this.units) {
      if (!s.alive || s.team !== victim.team) continue;
      if (s.kind === "tower" || s.kind === "nexus") {
        if (dist(s, attacker) <= s.attackRange + attacker.radius) {
          s.forceId = attacker.id;
          s.forceUntil = this.time + 2.5;
        }
      } else if (s.kind === "minion" && dist(s, victim) < 9 && dist(s, attacker) < 10.5) {
        s.focusId = attacker.id;
        s.focusUntil = this.time + 2.6;
      }
    }
  }

  private die(dst: Unit, src: Unit | null): void {
    if (!dst.alive) return;
    dst.alive = false;
    dst.hp = 0;
    dst.recallT = 0;
    dst.shield = 0;
    this.events.push({
      type: "death",
      targetId: dst.id,
      killerId: src?.id ?? null,
      x: dst.x,
      z: dst.z,
      kind: dst.kind,
    });
    if (dst.kind === "hero") {
      dst.deaths += 1;
      dst.respawnAt = this.time + 5 + dst.level * 1.5;
      this.creditHero(dst, src);
    } else if (dst.kind === "minion") {
      dst.corpse = 1.35;
      this.creditMinion(dst, src);
    } else if (dst.kind === "tower") {
      this.creditTower(dst, src);
    } else if (dst.kind === "nexus") {
      const winner = src?.team ?? otherTeam(dst.team);
      this.winner = winner;
      this.events.push({ type: "end", winner });
      this.events.push({
        type: "killfeed",
        text: winner === "camelot" ? "The Round Table stands" : "The Black Throne claims Camelot",
        team: winner,
      });
    }
  }

  private creditHero(dst: Unit, src: Unit | null): void {
    const foe = otherTeam(dst.team);
    const recent = this.recentDamagers(dst, foe);
    let killer = src && src.kind === "hero" && src.team === foe ? src : null;
    if (!killer && recent.length) killer = recent[recent.length - 1];
    if (killer) {
      killer.kills += 1;
      const gold = 155 + 24 * dst.level;
      killer.gold += gold;
      this.grantXp(killer, 110 + 18 * dst.level);
      this.events.push({ type: "text", x: killer.x, z: killer.z, text: `+${gold}`, color: "#ffd56a" });
      this.events.push({ type: "killfeed", text: `${killer.name} slew ${dst.name}`, team: killer.team });
    } else {
      this.events.push({ type: "killfeed", text: `${dst.name} has fallen`, team: foe });
    }
    for (const ally of recent) {
      if (ally === killer) continue;
      ally.assists += 1;
      ally.gold += 75;
      this.grantXp(ally, 60);
    }
  }

  private creditMinion(dst: Unit, src: Unit | null): void {
    const foes = this.heroesNear(otherTeam(dst.team), dst, 12);
    if (src && src.kind === "hero" && src.team !== dst.team) {
      src.gold += dst.goldValue;
      src.cs += 1;
      this.grantXp(src, dst.xpValue);
      this.events.push({ type: "text", x: src.x, z: src.z, text: `+${dst.goldValue}`, color: "#ffd56a" });
      for (const ally of foes) {
        if (ally !== src) this.grantXp(ally, dst.xpValue * 0.45);
      }
      return;
    }
    for (const ally of foes) this.grantXp(ally, dst.xpValue * 0.65);
  }

  private creditTower(dst: Unit, src: Unit | null): void {
    const foes = this.heroesNear(otherTeam(dst.team), dst, 18);
    for (const ally of foes) {
      ally.gold += 125;
      this.grantXp(ally, 90);
    }
    if (src && src.kind === "hero" && src.team !== dst.team) src.gold += 80;
    const who = src && src.kind === "hero" ? src.name : "The lane";
    const tier = dst.tier ?? "guard";
    this.events.push({ type: "killfeed", text: `${who} felled a ${tier} tower`, team: otherTeam(dst.team) });
  }

  private grantXp(u: Unit | null, amount: number): void {
    if (!u || u.kind !== "hero" || amount <= 0) return;
    u.xp += amount;
    while (u.level < 10 && u.xp >= XP_TO_NEXT[u.level - 1]) {
      u.xp -= XP_TO_NEXT[u.level - 1];
      u.level += 1;
      u.maxHp += 48;
      u.hp = Math.min(u.maxHp, u.hp + 48);
      u.maxMana += 20;
      u.mana = Math.min(u.maxMana, u.mana + 20);
      u.attackDamage += 3.4;
      u.armor += 1.6;
      this.events.push({ type: "level", targetId: u.id, level: u.level });
      this.events.push({ type: "text", x: u.x, z: u.z, text: `Level ${u.level}`, color: "#fff4c2" });
    }
  }

  private recentDamagers(dst: Unit, team: Team): Unit[] {
    const seen = new Set<number>();
    const out: Unit[] = [];
    for (const hit of dst.damagedBy) {
      if (this.time - hit.time > 8 || seen.has(hit.id)) continue;
      const u = this.unit(hit.id);
      if (!u || u.kind !== "hero" || u.team !== team) continue;
      seen.add(hit.id);
      out.push(u);
    }
    return out;
  }

  private heroesNear(team: Team, at: { x: number; z: number }, radius: number): Unit[] {
    return this.units.filter((u) => u.alive && u.kind === "hero" && u.team === team && dist(u, at) <= radius);
  }

  private enemiesOf(u: Unit): Unit[] {
    return this.units.filter((e) => e.alive && e.team !== u.team);
  }

  private foeInRange(u: Unit, range: number): Unit | null {
    return this.closest(u, this.enemiesOf(u).filter((e) => dist(u, e) <= range + e.radius));
  }

  private inRange(a: Unit, b: Unit): boolean {
    return dist(a, b) <= a.attackRange + b.radius;
  }

  private closest(from: { x: number; z: number }, list: Unit[]): Unit | null {
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const e of list) {
      const d = dist(from, e);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  private lowest(list: Unit[]): Unit {
    let best = list[0];
    for (const e of list) if (e.hp < best.hp) best = e;
    return best;
  }
}

const BLOCKS = blockers();
