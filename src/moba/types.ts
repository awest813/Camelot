export type Team = "camelot" | "mordred";
export type Lane = "top" | "mid" | "bot";
export type HeroId = "arthur" | "lancelot" | "gawain" | "merlin" | "morgan" | "tristan";
export type ItemId = "temper" | "aegis" | "spark" | "boots";
export type EntityKind = "hero" | "minion" | "tower" | "nexus";
export type MinionKind = "melee" | "caster";
export type TowerTier = "outer" | "inner";
export type AbilitySlot = 0 | 1 | 2 | 3;
export type ModelId = "Knight" | "Barbarian" | "Mage" | "Rogue" | "Rogue_Hooded";

export interface Vec {
  x: number;
  z: number;
}

export type AbilityEffect =
  | { type: "cone"; radius: number; arc: number; damage: number; stun?: number }
  | { type: "nova"; radius: number; damage: number; stun?: number }
  | { type: "projectile"; speed: number; hitRadius: number; damage: number; range: number; stun?: number; slow?: number; slowDur?: number; dot?: number; dotDur?: number; pierce?: boolean }
  | { type: "dash"; distance: number; damage: number; hitRadius: number }
  | { type: "blink"; distance: number }
  | { type: "shield"; amount: number; duration: number }
  | { type: "buff"; duration: number; damageMul?: number; speed?: number }
  | { type: "mark"; hits: number; mul: number }
  | { type: "zone"; radius: number; duration: number; dps: number; slow: number; range: number }
  | { type: "fan"; count: number; speed: number; damage: number; range: number; spread: number; hitRadius: number }
  | { type: "riposte"; duration: number }
  | { type: "flurry"; hits: number; damage: number; range: number };

export interface AbilityDef {
  name: string;
  key: "Q" | "W" | "E" | "R";
  blurb: string;
  mana: number;
  cooldown: number;
  effect: AbilityEffect;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  role: string;
  blurb: string;
  model: ModelId;
  ranged: boolean;
  attackClip: string;
  hp: number;
  mana: number;
  ad: number;
  range: number;
  period: number;
  speed: number;
  armor: number;
  radius: number;
  tint: "none" | "fey";
  abilities: [AbilityDef, AbilityDef, AbilityDef, AbilityDef];
}

export interface ItemDef {
  id: ItemId;
  name: string;
  blurb: string;
  cost: number;
  ad?: number;
  hp?: number;
  ap?: number;
  speed?: number;
}

export interface PlayerCommand {
  moveX: number;
  moveZ: number;
  aimX: number;
  aimZ: number;
  attack: boolean;
  cast: AbilitySlot | null;
  recall: boolean;
  buy: ItemId | null;
  focus: boolean;
}
