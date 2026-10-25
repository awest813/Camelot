import type { AbilityDef, HeroDef, HeroId, ItemDef, ItemId, MinionKind } from "./types";

const Q = "Q" as const;
const W = "W" as const;
const E = "E" as const;
const R = "R" as const;

function ability(
  key: AbilityDef["key"],
  name: string,
  blurb: string,
  mana: number,
  cooldown: number,
  effect: AbilityDef["effect"],
): AbilityDef {
  return { key, name, blurb, mana, cooldown, effect };
}

export const ULT_LEVEL = 4;

export const HEROES: Record<HeroId, HeroDef> = {
  arthur: {
    id: "arthur",
    name: "Arthur",
    title: "Bearer of Caliburn",
    role: "Fighter",
    blurb: "A king who walks into the press of spears and cuts a path for the wave behind him.",
    model: "Knight",
    ranged: false,
    attackClip: "1H_Melee_Attack_Chop",
    tint: "none",
    hp: 780,
    mana: 320,
    ad: 36,
    range: 2.35,
    period: 0.86,
    speed: 4.75,
    armor: 24,
    radius: 0.55,
    abilities: [
      ability(Q, "Excalibur", "A wide cut in front of Arthur.", 45, 6.5, { type: "cone", radius: 4.4, arc: 1.7, damage: 82 }),
      ability(W, "Pendragon Aegis", "A shield of oaths.", 55, 11, { type: "shield", amount: 160, duration: 3.2 }),
      ability(E, "Crown Charge", "Dash forward and strike.", 60, 9, { type: "dash", distance: 8, damage: 68, hitRadius: 1.45 }),
      ability(R, "Caliburn", "Slam the king-sword. Stuns.", 110, 36, { type: "nova", radius: 5.3, damage: 180, stun: 0.75 }),
    ],
  },
  lancelot: {
    id: "lancelot",
    name: "Lancelot",
    title: "The Perfect Knight",
    role: "Assassin",
    blurb: "First into the duel and first away, if the duel goes poorly.",
    model: "Rogue",
    ranged: false,
    attackClip: "1H_Melee_Attack_Chop",
    tint: "none",
    hp: 610,
    mana: 300,
    ad: 32,
    range: 2.15,
    period: 0.7,
    speed: 5.35,
    armor: 16,
    radius: 0.5,
    abilities: [
      ability(Q, "Flurry", "Three cuts on one foe.", 40, 6, { type: "flurry", hits: 3, damage: 34, range: 2.5 }),
      ability(W, "Riposte", "The next blow is turned aside and answered.", 50, 12, { type: "riposte", duration: 1.35 }),
      ability(E, "Duelist's Leap", "A long lunge.", 55, 8.5, { type: "dash", distance: 9, damage: 50, hitRadius: 1.25 }),
      ability(R, "Perfect Cut", "A narrow killing stroke.", 90, 30, { type: "cone", radius: 3.5, arc: 0.85, damage: 220 }),
    ],
  },
  gawain: {
    id: "gawain",
    name: "Gawain",
    title: "Knight of the Sun",
    role: "Bruiser",
    blurb: "Strength that swells as the fight goes on. He holds a lane like a gate.",
    model: "Barbarian",
    ranged: false,
    attackClip: "2H_Melee_Attack_Chop",
    tint: "none",
    hp: 900,
    mana: 280,
    ad: 38,
    range: 2.45,
    period: 0.96,
    speed: 4.45,
    armor: 30,
    radius: 0.6,
    abilities: [
      ability(Q, "Sunstroke", "A heavy sweeping blow.", 45, 7, { type: "cone", radius: 4.6, arc: 1.9, damage: 88 }),
      ability(W, "Noontide", "His blows grow brighter for a few heartbeats.", 40, 12, { type: "buff", duration: 4.5, damageMul: 1.45 }),
      ability(E, "Bull Rush", "A short, crushing charge.", 55, 9, { type: "dash", distance: 6.6, damage: 80, hitRadius: 1.7 }),
      ability(R, "Giant Swing", "Everyone near him pays for standing there.", 100, 34, { type: "nova", radius: 6.1, damage: 160, stun: 0.4 }),
    ],
  },
  merlin: {
    id: "merlin",
    name: "Merlin",
    title: "Wizard of Britain",
    role: "Mage",
    blurb: "Bolts, runes, and a meteor he has been saving for a rude afternoon.",
    model: "Mage",
    ranged: true,
    attackClip: "Spellcast_Shoot",
    tint: "none",
    hp: 540,
    mana: 460,
    ad: 26,
    range: 7.4,
    period: 0.9,
    speed: 4.55,
    armor: 12,
    radius: 0.48,
    abilities: [
      ability(Q, "Arcane Bolt", "A fast bolt of spellfire.", 40, 5.5, { type: "projectile", speed: 16, hitRadius: 0.45, damage: 96, range: 9.6 }),
      ability(W, "Rune Circle", "A burning ring that slows.", 70, 11, { type: "zone", radius: 3.3, duration: 3.4, dps: 26, slow: 0.4, range: 8 }),
      ability(E, "Step Aside", "Blink a short way.", 50, 10, { type: "blink", distance: 8.2 }),
      ability(R, "Meteor", "Call a stone down from the old sky.", 120, 38, { type: "zone", radius: 4, duration: 1.35, dps: 95, slow: 0.25, range: 9 }),
    ],
  },
  morgan: {
    id: "morgan",
    name: "Morgan",
    title: "Le Fay",
    role: "Enchanter",
    blurb: "Curses that cling, shackles of mist, and a ring no one willingly enters.",
    model: "Mage",
    ranged: true,
    attackClip: "Spellcast_Shoot",
    tint: "fey",
    hp: 560,
    mana: 440,
    ad: 24,
    range: 6.9,
    period: 0.95,
    speed: 4.6,
    armor: 13,
    radius: 0.48,
    abilities: [
      ability(Q, "Curse Bolt", "A bolt that keeps biting.", 45, 6, { type: "projectile", speed: 14, hitRadius: 0.45, damage: 58, range: 8.8, dot: 18, dotDur: 3.2 }),
      ability(W, "Shackle", "A misty chain that stops a foe.", 65, 12, { type: "projectile", speed: 12, hitRadius: 0.5, damage: 40, range: 8.2, stun: 0.95 }),
      ability(E, "Mist Step", "Step through your own glamour.", 50, 9.5, { type: "blink", distance: 7.4 }),
      ability(R, "Fey Ring", "A wide curse that slows and gnaws.", 110, 36, { type: "zone", radius: 4.2, duration: 3.2, dps: 32, slow: 0.55, range: 8 }),
    ],
  },
  tristan: {
    id: "tristan",
    name: "Tristan",
    title: "The Hunter",
    role: "Marksman",
    blurb: "He shoots from the tree line and leaves before the tower can name him.",
    model: "Rogue_Hooded",
    ranged: true,
    attackClip: "1H_Ranged_Shoot",
    tint: "none",
    hp: 520,
    mana: 310,
    ad: 28,
    range: 8.1,
    period: 0.68,
    speed: 4.85,
    armor: 11,
    radius: 0.48,
    abilities: [
      ability(Q, "Piercing Shot", "An arrow that flies through a file of foes.", 45, 7, { type: "projectile", speed: 20, hitRadius: 0.4, damage: 88, range: 11.5, pierce: true }),
      ability(W, "Hunter's Mark", "The next three shots cut deeper.", 35, 10, { type: "mark", hits: 3, mul: 0.5 }),
      ability(E, "Hunter's Roll", "A quick bound aside.", 40, 8, { type: "dash", distance: 6.4, damage: 0, hitRadius: 0 }),
      ability(R, "Arrow Rain", "A fan of shafts.", 90, 32, { type: "fan", count: 5, speed: 16, damage: 40, range: 10.5, spread: 0.18, hitRadius: 0.42 }),
    ],
  },
};

export const HERO_LIST: HeroDef[] = [
  HEROES.arthur,
  HEROES.lancelot,
  HEROES.gawain,
  HEROES.merlin,
  HEROES.morgan,
  HEROES.tristan,
];

export const ITEMS: Record<ItemId, ItemDef> = {
  boots: { id: "boots", name: "Boots of the Hunt", blurb: "+0.7 move speed", cost: 350, speed: 0.7 },
  temper: { id: "temper", name: "Temper of the Lake", blurb: "+16 attack", cost: 460, ad: 16 },
  aegis: { id: "aegis", name: "Shield of Camlann", blurb: "+240 health", cost: 480, hp: 240 },
  spark: { id: "spark", name: "Merlin's Spark", blurb: "+40 spell power", cost: 460, ap: 40 },
};

export const ITEM_LIST: ItemDef[] = [ITEMS.boots, ITEMS.temper, ITEMS.aegis, ITEMS.spark];

export interface CreepStats {
  hp: number;
  ad: number;
  range: number;
  period: number;
  speed: number;
  armor: number;
  radius: number;
  gold: number;
  xp: number;
  aggro: number;
}

export const MINIONS: Record<MinionKind, CreepStats> = {
  melee: { hp: 310, ad: 17, range: 1.7, period: 1.0, speed: 3.3, armor: 6, radius: 0.46, gold: 30, xp: 36, aggro: 6.5 },
  caster: { hp: 180, ad: 21, range: 5.6, period: 1.15, speed: 3.05, armor: 3, radius: 0.4, gold: 38, xp: 46, aggro: 7.2 },
};

export const TOWER_STATS = {
  outer: { hp: 1500, ad: 54, range: 7.3, period: 0.95, armor: 14, radius: 1.15 },
  inner: { hp: 2000, ad: 72, range: 7.5, period: 0.9, armor: 18, radius: 1.25 },
} as const;

export const NEXUS_STATS = { hp: 3000, ad: 90, range: 8.1, period: 0.95, armor: 20, radius: 1.75 };

export const XP_TO_NEXT = [80, 130, 190, 260, 340, 430, 530, 640, 760];

export function abilityRange(effect: AbilityDef["effect"]): number {
  switch (effect.type) {
    case "cone":
    case "nova":
      return effect.radius;
    case "projectile":
    case "fan":
    case "zone":
      return effect.range;
    case "dash":
    case "blink":
      return effect.distance;
    case "flurry":
      return effect.range;
    default:
      return 0;
  }
}
