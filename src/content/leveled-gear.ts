/**
 * Gear behind the leveled lists' ids (the elite drop tables): stats scale
 * with the tier, so boss loot stays worth having at the player's level.
 */
export const LEVEL_ITEM_TEMPLATES: Readonly<Record<string, {
  name: string; description: string; weight: number; slot: string; stats: Record<string, number>;
}>> = {
  iron_sword:      { name: "Iron Sword",      description: "A dependable blade.",            weight: 3.5, slot: "mainHand", stats: { damage: 10, value: 80 } },
  steel_sword:     { name: "Steel Sword",     description: "Forged with superior steel.",    weight: 4.0, slot: "mainHand", stats: { damage: 16, value: 220 } },
  silver_sword:    { name: "Silver Sword",    description: "Blessed silver etched with runes.", weight: 4.0, slot: "mainHand", stats: { damage: 22, value: 500 } },
  daedric_sword:   { name: "Daedric Sword",   description: "A blade of blackened obsidian.", weight: 5.0, slot: "mainHand", stats: { damage: 30, value: 1500 } },
  iron_bow:        { name: "Iron Bow",        description: "A sturdy shortbow.",             weight: 2.5, slot: "mainHand", stats: { damage: 8, value: 100 } },
  steel_bow:       { name: "Steel Bow",       description: "A recurve bow with steel limbs.", weight: 3.0, slot: "mainHand", stats: { damage: 13, value: 280 } },
  elven_bow:       { name: "Elven Bow",       description: "A lightweight bow of moon-metal.", weight: 2.0, slot: "mainHand", stats: { damage: 18, value: 700 } },
  iron_cuirass:    { name: "Iron Cuirass",    description: "Heavy plated protection.",       weight: 8.0, slot: "chest", stats: { armor: 12, value: 120 } },
  steel_cuirass:   { name: "Steel Cuirass",   description: "Well-tempered steel plate.",     weight: 10,  slot: "chest", stats: { armor: 18, value: 300 } },
  orcish_cuirass:  { name: "Orcish Cuirass",  description: "Brutal, functional craftsmanship.", weight: 12, slot: "chest", stats: { armor: 26, value: 800 } },
  daedric_cuirass: { name: "Daedric Cuirass", description: "Armor carved from raw Oblivion.", weight: 14, slot: "chest", stats: { armor: 36, value: 2000 } },
};
