import { describe, expect, it } from "vitest";
import { FOUNTAIN, FOUNTAIN_RADIUS, LANE_PATHS, PROPS, TOWER_SPAWNS } from "./map";
import { dist, distToPath } from "./math";
import { IDLE_INPUT, Match } from "./sim";
import type { PlayerCommand } from "./types";

function run(match: Match, seconds: number, dt = 1 / 30, input: PlayerCommand = IDLE_INPUT): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) match.step(dt, input);
}

describe("Camlann map", () => {
  it("puts every tower on its lane", () => {
    for (const tower of TOWER_SPAWNS) {
      expect(distToPath(tower.x, tower.z, LANE_PATHS[tower.lane])).toBeLessThan(2.5);
    }
  });

  it("keeps trees and rocks off the roads and out of the wells", () => {
    const solid = PROPS.filter((p) => p.kind !== "flower");
    expect(solid.length).toBeGreaterThan(20);
    for (const prop of solid) {
      let clearance = Infinity;
      for (const lane of ["top", "mid", "bot"] as const) {
        clearance = Math.min(clearance, distToPath(prop.x, prop.z, LANE_PATHS[lane]));
      }
      expect(clearance).toBeGreaterThan(4);
      expect(dist(prop, FOUNTAIN.camelot)).toBeGreaterThan(8);
      expect(dist(prop, FOUNTAIN.mordred)).toBeGreaterThan(8);
    }
  });
});

describe("Camelot Rift match", () => {
  function match(): Match {
    return new Match({ playerHero: "arthur", playerLane: "mid", seed: 7 });
  }

  it("fields six unique champions, three a side", () => {
    const m = match();
    const heroes = m.units.filter((u) => u.kind === "hero");
    expect(heroes).toHaveLength(6);
    expect(new Set(heroes.map((h) => h.heroId)).size).toBe(6);
    expect(heroes.filter((h) => h.team === "camelot")).toHaveLength(3);
    expect(heroes.filter((h) => h.team === "mordred")).toHaveLength(3);
    expect(m.units.filter((u) => u.kind === "tower")).toHaveLength(12);
    expect(m.units.filter((u) => u.kind === "nexus")).toHaveLength(2);
    expect(m.player.heroId).toBe("arthur");
    expect(m.player.lane).toBe("mid");
  });

  it("marches a minion wave down the lane", () => {
    const m = match();
    run(m, 8.2);
    const squire = m.units.find((u) => u.kind === "minion" && u.team === "camelot" && u.lane === "mid" && u.alive);
    expect(squire).toBeTruthy();
    const start = squire!.x + squire!.z;
    run(m, 4);
    const still = m.unit(squire!.id);
    expect(still?.alive).toBe(true);
    expect(still!.x + still!.z).toBeGreaterThan(start + 4);
  });

  it("moves the player from the stick", () => {
    const m = match();
    const start = m.player.x;
    m.step(0.6, { ...IDLE_INPUT, moveX: 1, moveZ: 0 });
    expect(m.player.x).toBeGreaterThan(start + 1.5);
  });

  it("cleaves with Excalibur", () => {
    const m = match();
    const enemy = m.units.find((u) => u.kind === "hero" && u.team === "mordred")!;
    m.player.x = 0;
    m.player.z = -12;
    enemy.x = 2.1;
    enemy.z = -12;
    enemy.stun = 3;
    const before = enemy.hp;
    const mana = m.player.mana;
    m.step(0.05, { ...IDLE_INPUT, cast: 0, aimX: enemy.x, aimZ: enemy.z });
    expect(enemy.hp).toBeLessThan(before - 40);
    expect(m.player.mana).toBeLessThan(mana);
    expect(m.player.cooldowns[0]).toBeGreaterThan(1);
  });

  it("holds Caliburn until level 4", () => {
    const m = match();
    const mana = m.player.mana;
    m.step(0.05, { ...IDLE_INPUT, cast: 3, aimX: m.player.x + 2, aimZ: m.player.z });
    expect(m.player.cooldowns[3]).toBe(0);
    expect(m.player.mana).toBeGreaterThan(mana - 1);
  });

  it("pays gold for a last hit and nothing for a missed one", () => {
    const m = match();
    run(m, 8.3);
    const creep = m.units.find((u) => u.alive && u.kind === "minion" && u.team === "mordred")!;
    creep.x = 0;
    creep.z = -14;
    creep.hp = 1;
    creep.stun = 2;
    m.player.x = 1.1;
    m.player.z = -14;
    m.player.attackCooldown = 0;
    const gold = m.player.gold;
    m.step(0.05, { ...IDLE_INPUT, attack: true });
    expect(creep.alive).toBe(false);
    expect(m.player.cs).toBe(1);
    expect(m.player.gold).toBeGreaterThan(gold + 20);
  });

  it("levels Arthur once the wave is worth enough experience", () => {
    const m = match();
    run(m, 8.3);
    const creep = m.units.find((u) => u.alive && u.kind === "minion" && u.team === "mordred")!;
    creep.hp = 1;
    creep.stun = 2;
    creep.x = 4;
    creep.z = -8;
    m.player.x = 5;
    m.player.z = -8;
    m.player.attackCooldown = 0;
    m.player.xp = 70;
    m.step(0.05, { ...IDLE_INPUT, attack: true });
    expect(m.player.level).toBe(2);
    expect(m.player.maxHp).toBeGreaterThan(780);
  });

  it("sells gear only at the healing well", () => {
    const m = match();
    m.player.gold = 500;
    m.player.x = 0;
    m.player.z = 0;
    const ad = m.player.attackDamage;
    m.step(0.05, { ...IDLE_INPUT, buy: "temper" });
    expect(m.player.items).toHaveLength(0);
    expect(m.player.attackDamage).toBe(ad);

    m.player.x = FOUNTAIN.camelot.x;
    m.player.z = FOUNTAIN.camelot.z;
    m.step(0.05, { ...IDLE_INPUT, buy: "temper" });
    expect(m.player.items).toContain("temper");
    expect(m.player.attackDamage).toBeGreaterThan(ad);
    expect(m.player.gold).toBeLessThan(500);
  });

  it("makes towers shoot minions before heroes", () => {
    const m = match();
    run(m, 8.3);
    const tower = m.units.find((u) => u.kind === "tower" && u.team === "camelot" && u.lane === "mid" && u.tier === "outer")!;
    const creep = m.units.find((u) => u.alive && u.kind === "minion" && u.team === "mordred")!;
    const enemy = m.units.find((u) => u.kind === "hero" && u.team === "mordred")!;
    creep.x = tower.x + 2;
    creep.z = tower.z;
    creep.stun = 3;
    enemy.x = tower.x + 4.5;
    enemy.z = tower.z;
    enemy.stun = 3;
    enemy.moveSpeed = 0;
    creep.moveSpeed = 0;
    tower.attackCooldown = 0;
    const creepHp = creep.hp;
    const heroHp = enemy.hp;
    m.step(0.05, IDLE_INPUT);
    expect(creep.hp).toBeLessThan(creepHp);
    expect(enemy.hp).toBe(heroHp);
  });

  it("turns a tower onto a hero who strikes an ally underneath it", () => {
    const m = match();
    const tower = m.units.find((u) => u.kind === "tower" && u.team === "camelot" && u.lane === "mid" && u.tier === "outer")!;
    const enemy = m.units.find((u) => u.kind === "hero" && u.team === "mordred")!;
    run(m, 8.3);
    const creep = m.units.find((u) => u.alive && u.kind === "minion" && u.team === "mordred")!;
    m.player.x = tower.x + 1;
    m.player.z = tower.z + 1;
    m.player.stun = 3;
    enemy.x = tower.x + 4;
    enemy.z = tower.z;
    enemy.stun = 3;
    enemy.moveSpeed = 0;
    creep.x = tower.x + 2;
    creep.z = tower.z;
    creep.stun = 3;
    creep.moveSpeed = 0;
    const before = enemy.hp;
    m.inflict(enemy.id, m.player.id, 40);
    tower.attackCooldown = 0;
    m.step(0.05, IDLE_INPUT);
    expect(enemy.hp).toBeLessThan(before);
  });

  it("burns anyone who steps into the enemy well", () => {
    const m = match();
    const enemy = m.units.find((u) => u.kind === "hero" && u.team === "mordred")!;
    enemy.x = FOUNTAIN.camelot.x;
    enemy.z = FOUNTAIN.camelot.z;
    enemy.moveSpeed = 0;
    enemy.hp = enemy.maxHp;
    const before = enemy.hp;
    run(m, 1, 0.1);
    expect(enemy.hp).toBeLessThan(before - 80);
  });

  it("respawns a slain hero back at their well", () => {
    const m = match();
    const enemy = m.units.find((u) => u.kind === "hero" && u.team === "mordred")!;
    m.inflict(enemy.id, m.player.id, 5000);
    expect(m.player.alive).toBe(false);
    expect(m.player.deaths).toBe(1);
    const at = m.player.respawnAt;
    run(m, at + 0.2, 0.1);
    expect(m.player.alive).toBe(true);
    expect(m.player.hp).toBe(m.player.maxHp);
    expect(dist(m.player, FOUNTAIN.camelot)).toBeLessThan(FOUNTAIN_RADIUS);
  });

  it("ends the match when a throne falls", () => {
    const m = match();
    const throne = m.units.find((u) => u.kind === "nexus" && u.team === "mordred")!;
    throne.hp = 10;
    m.inflict(m.player.id, throne.id, 50);
    expect(throne.alive).toBe(false);
    expect(m.winner).toBe("camelot");
    const time = m.time;
    m.step(1, IDLE_INPUT);
    expect(m.time).toBe(time);
  });

  it("keeps living bots out of the enemy well and eventually pressures a tower", () => {
    const m = match();
    run(m, 25, 0.1);
    for (const hero of m.units) {
      if (hero.kind !== "hero" || !hero.alive) continue;
      const well = hero.team === "camelot" ? FOUNTAIN.mordred : FOUNTAIN.camelot;
      expect(dist(hero, well)).toBeGreaterThan(FOUNTAIN_RADIUS - 0.25);
    }
    run(m, 175, 0.1);
    const minions = m.units.filter((u) => u.kind === "minion" && u.alive);
    expect(minions.length).toBeLessThanOrEqual(3 * 2 * 8);
    expect(m.winner).toBeNull();
    const towers = m.units.filter((u) => u.kind === "tower");
    const pressed = towers.some((t) => !t.alive || t.hp < t.maxHp * 0.9);
    if (!pressed) {
      const summary = towers.map((t) => `${t.team} ${t.lane} ${t.tier} ${Math.round(t.hp)}/${t.maxHp}`).join(", ");
      throw new Error(`no tower pressure after ${m.time.toFixed(0)}s: ${summary}`);
    }
  }, 20000);
});
