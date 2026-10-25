import { HEROES, ITEMS, abilityRange } from "./content";
import { dist } from "./math";
import { FOUNTAIN, FOUNTAIN_RADIUS, NEXUS_AT, pathFor, otherTeam } from "./map";
import type { Match, Unit } from "./sim";
import type { ItemId, Team, Vec } from "./types";

/** Lane minions: fight the wave, then the tower, otherwise march. */
export function issueMinionOrders(m: Match): void {
  for (const u of m.units) {
    if (!u.alive || u.kind !== "minion" || !u.lane) continue;
    advance(u);
    const focus = u.focusId != null && m.time < u.focusUntil ? m.unit(u.focusId) : null;
    if (focus && focus.alive && dist(u, focus) < 11) {
      chase(u, focus);
      continue;
    }
    const creep = nearest(m, u, (e) => e.kind === "minion" && dist(u, e) < u.aggro);
    if (creep) {
      chase(u, creep);
      continue;
    }
    const structure = nearest(
      m,
      u,
      (e) => (e.kind === "tower" || e.kind === "nexus") && dist(u, e) < u.attackRange + e.radius + 1.1,
    );
    if (structure) {
      chase(u, structure);
      continue;
    }
    const path = pathFor(u.team, u.lane);
    const point = path[Math.min(u.waypoint, path.length - 1)];
    u.order.useDest = true;
    u.order.destX = point.x;
    u.order.destZ = point.z;
  }
}

/** The other five champions. They lane, last-hit, siege, and run home. */
export function issueBotOrders(m: Match): void {
  for (const u of m.units) {
    if (!u.bot || !u.alive || u.kind !== "hero" || !u.lane) continue;
    const home = FOUNTAIN[u.team];
    const enemyWell = FOUNTAIN[otherTeam(u.team)];
    if (dist(u, enemyWell) < FOUNTAIN_RADIUS + 2) {
      moveTo(u, home.x, home.z);
      continue;
    }
    if (dist(u, home) < FOUNTAIN_RADIUS) considerBuy(u);

    const nearestHero = nearest(m, u, (e) => e.kind === "hero");
    const heroDist = nearestHero ? dist(u, nearestHero) : 999;
    const hp = u.hp / u.maxHp;

    if (u.recallT > 0) {
      if (heroDist < 6.5 || m.time - u.lastCombat < 0.35) u.recallT = 0;
      else {
        u.order.recall = true;
        continue;
      }
    }

    if (dist(u, home) < FOUNTAIN_RADIUS && hp < 0.9 && m.time - u.lastCombat > 1.2) continue;

    if (hp < 0.3 && dist(u, home) > 12 && heroDist > 7 && m.time - u.lastCombat > 1) {
      u.order.recall = true;
      continue;
    }

    const threat = defenseTarget(m, u);
    if (threat && hp > 0.38) {
      engage(m, u, threat);
      continue;
    }

    if (nearestHero && heroDist < 9.5) {
      const allies = countKind(m, u.team, u, 8, "minion");
      const foes = countKind(m, otherTeam(u.team), u, 8, "minion");
      const diving = towerDanger(m, u);
      const winning = hp > 0.42 && (allies + 1 >= foes || nearestHero.hp < u.hp * 0.7);
      if (diving && allies < 2) {
        retreat(u);
        continue;
      }
      if (!winning && hp < 0.45) {
        retreat(u);
        continue;
      }
      if (winning) {
        engage(m, u, nearestHero);
        continue;
      }
      retreat(u);
      continue;
    }

    const siege = siegeTower(m, u);
    if (siege && hp > 0.45) {
      chase(u, siege);
      maybeCast(m, u, nearestHero);
      continue;
    }

    const last = findLastHit(m, u);
    if (last) {
      chase(u, last);
      continue;
    }

    const front = frontMinion(m, u);
    if (front) {
      holdBehind(u, front);
      continue;
    }

    const stage = stagingPoint(m, u);
    moveTo(u, stage.x, stage.z);
  }
}

function considerBuy(u: Unit): void {
  const ranged = u.attackRange > 4;
  const order: ItemId[] = ranged
    ? ["spark", "boots", "aegis", "temper"]
    : ["boots", "temper", "aegis", "spark"];
  for (const id of order) {
    if (u.items.includes(id) || u.items.length >= 4) continue;
    if (u.gold >= ITEMS[id].cost) {
      u.wantBuy = id;
      return;
    }
  }
}

function defenseTarget(m: Match, u: Unit): Unit | null {
  let best: Unit | null = null;
  let bestD = 26;
  for (const e of m.units) {
    if (!e.alive || e.team === u.team) continue;
    if (e.kind !== "minion" && e.kind !== "hero") continue;
    const nearThrone = dist(e, NEXUS_AT[u.team]) < 12;
    if (!nearThrone && e.lane && e.lane !== u.lane) continue;
    let threatened = nearThrone;
    if (!threatened) {
      for (const s of m.units) {
        if (!s.alive || s.team !== u.team) continue;
        if (s.kind !== "tower" && s.kind !== "nexus") continue;
        if (s.kind === "tower" && s.lane !== u.lane) continue;
        if (dist(e, s) <= s.attackRange + 1.3) {
          threatened = true;
          break;
        }
      }
    }
    if (!threatened) continue;
    const d = dist(u, e);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function engage(m: Match, u: Unit, enemy: Unit): void {
  const d = dist(u, enemy);
  const ranged = u.attackRange > 4;
  u.order.attackId = enemy.id;
  u.order.aimX = enemy.x;
  u.order.aimZ = enemy.z;
  if (ranged) {
    if (d > u.attackRange * 0.9) moveTo(u, enemy.x, enemy.z);
    else if (d < u.attackRange * 0.48) {
      const home = FOUNTAIN[u.team];
      moveTo(u, u.x + (u.x - enemy.x) + (home.x - u.x) * 0.05, u.z + (u.z - enemy.z) + (home.z - u.z) * 0.05);
    } else {
      const px = -(enemy.z - u.z);
      const pz = enemy.x - u.x;
      const pl = Math.hypot(px, pz) || 1;
      const s = Math.sin(m.time * 1.7 + u.id) > 0 ? 1 : -1;
      moveTo(u, u.x + (px / pl) * s * 2.2, u.z + (pz / pl) * s * 2.2);
    }
  } else if (d > u.attackRange * 0.86) {
    moveTo(u, enemy.x, enemy.z);
  }
  maybeCast(m, u, enemy);
}

function maybeCast(m: Match, u: Unit, enemy: Unit | null): void {
  if (!u.heroId || u.stun > 0) return;
  const kit = HEROES[u.heroId].abilities;
  const slots = [3, 0, 1, 2] as const;
  for (const slot of slots) {
    const ability = kit[slot];
    if (slot === 3 && u.level < 4) continue;
    if (u.cooldowns[slot] > 0 || u.mana < ability.mana) continue;
    const kind = ability.effect.type;
    if (kind === "shield" || kind === "riposte") {
      if (enemy && dist(u, enemy) < 8 && u.hp < u.maxHp * 0.7) {
        setCast(u, slot, enemy);
        return;
      }
      continue;
    }
    if (kind === "buff" || kind === "mark") {
      if (enemy && dist(u, enemy) < u.attackRange + 2.5) {
        setCast(u, slot, enemy);
        return;
      }
      continue;
    }
    if (kind === "blink") {
      if (enemy && u.hp < u.maxHp * 0.38 && dist(u, enemy) < 6.5) {
        const home = FOUNTAIN[u.team];
        u.order.cast = slot;
        u.order.aimX = home.x;
        u.order.aimZ = home.z;
        return;
      }
      continue;
    }
    if (!enemy) continue;
    const range = abilityRange(ability.effect);
    const d = dist(u, enemy);
    if (kind === "dash") {
      if (towerDanger(m, u)) continue;
      if (d < range + 1.5 && d > u.attackRange * 0.7 && u.hp > enemy.hp * 0.75) {
        setCast(u, slot, enemy);
        return;
      }
      continue;
    }
    if (d <= range + 0.3) {
      if (slot === 3 && enemy.hp > enemy.maxHp * 0.72 && u.hp > u.maxHp * 0.55) continue;
      setCast(u, slot, enemy);
      return;
    }
  }
}

function setCast(u: Unit, slot: 0 | 1 | 2 | 3, enemy: Unit): void {
  u.order.cast = slot;
  u.order.aimX = enemy.x;
  u.order.aimZ = enemy.z;
}

function retreat(u: Unit): void {
  const path = pathFor(u.team, u.lane ?? "mid");
  const idx = nearestPathIndex(path, u);
  const back = path[Math.max(0, idx - 1)];
  moveTo(u, back.x, back.z);
}

function siegeTower(m: Match, u: Unit): Unit | null {
  let best: Unit | null = null;
  let bestD = u.attackRange + 3.2;
  for (const tower of m.units) {
    if (!tower.alive || tower.team === u.team || tower.kind !== "tower" || tower.lane !== u.lane) continue;
    const d = dist(u, tower);
    if (d > bestD) continue;
    if (countKind(m, u.team, tower, tower.attackRange, "minion") < 2) continue;
    best = tower;
    bestD = d;
  }
  return best;
}

function findLastHit(m: Match, u: Unit): Unit | null {
  let best: Unit | null = null;
  let bestHp = Infinity;
  const raw = u.attackDamage * (u.damageBonusT > 0 ? u.damageBonus : 1);
  for (const e of m.units) {
    if (!e.alive || e.team === u.team || e.kind !== "minion") continue;
    if (dist(u, e) > u.attackRange + e.radius + 1.4) continue;
    const dealt = raw * 100 / (100 + e.armor);
    if (e.hp > dealt + 3 || e.hp >= bestHp) continue;
    best = e;
    bestHp = e.hp;
  }
  return best;
}

function frontMinion(m: Match, u: Unit): Unit | null {
  let best: Unit | null = null;
  let score = -Infinity;
  for (const e of m.units) {
    if (!e.alive || e.kind !== "minion" || e.team !== u.team || e.lane !== u.lane) continue;
    const s = e.waypoint * 20 - dist(e, u) * 0.01;
    if (s > score) {
      score = s;
      best = e;
    }
  }
  return best;
}

function holdBehind(u: Unit, front: Unit): void {
  const path = pathFor(u.team, front.lane ?? u.lane ?? "mid");
  const back = path[Math.max(0, front.waypoint - 1)];
  const dx = back.x - front.x;
  const dz = back.z - front.z;
  const d = Math.hypot(dx, dz) || 1;
  moveTo(u, front.x + (dx / d) * 3.3, front.z + (dz / d) * 3.3);
}

function stagingPoint(m: Match, u: Unit): Vec {
  const path = pathFor(u.team, u.lane ?? "mid");
  let idx = 1;
  for (const tower of m.units) {
    if (!tower.alive || tower.team !== u.team || tower.kind !== "tower" || tower.lane !== u.lane) continue;
    idx = Math.max(idx, nearestPathIndex(path, tower));
  }
  return path[Math.min(path.length - 1, idx)];
}

function towerDanger(m: Match, u: Unit): boolean {
  for (const tower of m.units) {
    if (!tower.alive || tower.team === u.team) continue;
    if (tower.kind !== "tower" && tower.kind !== "nexus") continue;
    if (dist(u, tower) > tower.attackRange + 0.4) continue;
    if (countKind(m, u.team, tower, tower.attackRange, "minion") < 2) return true;
  }
  return false;
}

function countKind(m: Match, team: Team, at: Vec, radius: number, kind: Unit["kind"]): number {
  let n = 0;
  for (const e of m.units) {
    if (e.alive && e.team === team && e.kind === kind && dist(e, at) <= radius) n += 1;
  }
  return n;
}

function chase(u: Unit, target: Unit): void {
  const d = dist(u, target);
  const stop = Math.max(0.35, u.attackRange * 0.82);
  u.order.attackId = target.id;
  u.order.aimX = target.x;
  u.order.aimZ = target.z;
  if (d <= stop || d < 0.001) return;
  u.order.useDest = true;
  u.order.destX = target.x + (u.x - target.x) / d * stop;
  u.order.destZ = target.z + (u.z - target.z) / d * stop;
}

function moveTo(u: Unit, x: number, z: number): void {
  u.order.useDest = true;
  u.order.destX = x;
  u.order.destZ = z;
}

function advance(u: Unit): void {
  if (!u.lane) return;
  const path = pathFor(u.team, u.lane);
  while (u.waypoint < path.length - 1 && dist(u, path[u.waypoint]) < 1.45) u.waypoint += 1;
}

function nearestPathIndex(path: readonly Vec[], p: Vec): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = dist(p, path[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function nearest(m: Match, u: Unit, pred: (e: Unit) => boolean): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const e of m.units) {
    if (!e.alive || e.team === u.team || !pred(e)) continue;
    const d = dist(u, e);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}
