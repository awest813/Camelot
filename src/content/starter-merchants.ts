/**
 * The starting region's merchants and their shops.
 *
 * One table feeds the barter system (what they sell now), the restock system
 * (what they sell again every 72 game hours) and the shop registry. The two
 * used to be separate copies, and the general store's restock had lost its
 * food.
 */
import { LOCKPICK } from "../systems/container-system";
import type { Item } from "../systems/inventory-system";
import type { BarterSystem } from "../systems/barter-system";
import type { MerchantRestockSystem } from "../systems/merchant-restock-system";
import type { ShopDef, ShopSystem } from "../systems/shop-system";
import { smithingMaterialStack } from "../systems/smithing-controller";

export const HEALTH_POTION_STATS = { value: 25, heal: 50 } as const;

/** Game hours between restocks. */
export const RESTOCK_HOURS = 72;

export interface StarterMerchant {
  id: string;
  name: string;
  factionId: string;
  gold: number;
  priceMultiplier: number;
  openHour: number;
  closeHour: number;
  shop: Pick<ShopDef, "id" | "name" | "type" | "description">;
  /** Fresh copies each call: barter mutates the items it holds. */
  stock(): Item[];
}

export const STARTER_MERCHANTS: readonly StarterMerchant[] = [
  {
    id: "merchant_01",
    name: "Trader Elan",
    factionId: "town",
    gold: 500,
    priceMultiplier: 1.1,
    openHour: 8,
    closeHour: 20,
    shop: { id: "shop_trader_elan", name: "Trader Elan's Stall", type: "general", description: "Roadside trader with potions and arrows." },
    stock: () => [
      { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 5, weight: 0.5, stats: { ...HEALTH_POTION_STATS } },
      { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 3, weight: 1, stats: { value: 15 } },
      { ...LOCKPICK, quantity: 6, stats: { ...LOCKPICK.stats } },
    ],
  },
  {
    id: "merchant_general_01",
    name: "Village General Goods",
    factionId: "merchants_guild",
    gold: 450,
    priceMultiplier: 1.05,
    openHour: 7,
    closeHour: 21,
    shop: { id: "shop_village_general", name: "Village General Goods", type: "general" },
    stock: () => [
      { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 8, weight: 0.5, stats: { ...HEALTH_POTION_STATS } },
      { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 4, weight: 1, stats: { value: 15 } },
      { ...LOCKPICK, quantity: 10, stats: { ...LOCKPICK.stats } },
      { id: "bread", name: "Loaf of Bread", description: "Hearty bread. Restores hunger.", stackable: true, quantity: 6, weight: 0.2, stats: { value: 5, nutrition: 30 } },
      { id: "mead", name: "Horn of Mead", description: "Honey-sweet and strong. Restores some hunger.", stackable: true, quantity: 4, weight: 0.4, stats: { value: 6, nutrition: 20 } },
      { id: "ale", name: "Mug of Ale", description: "Watered-down but filling.", stackable: true, quantity: 6, weight: 0.4, stats: { value: 4, nutrition: 15 } },
      { id: "stew", name: "Bowl of Stew", description: "Hot and hearty. Restores a lot of hunger.", stackable: true, quantity: 4, weight: 0.5, stats: { value: 8, nutrition: 50 } },
    ],
  },
  {
    id: "merchant_weapons_01",
    name: "Roadside Arms",
    factionId: "merchants_guild",
    gold: 800,
    priceMultiplier: 1.15,
    openHour: 8,
    closeHour: 19,
    shop: { id: "shop_roadside_arms", name: "Roadside Arms", type: "weapons" },
    stock: () => [
      { id: "iron_sword", name: "Iron Sword", description: "A basic iron sword.", stackable: false, quantity: 2, slot: "mainHand", weight: 3, stats: { damage: 10, value: 80 } },
      { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 6, weight: 1, stats: { value: 15 } },
      smithingMaterialStack("iron_ingot", 10),
      smithingMaterialStack("steel_ingot", 4),
      smithingMaterialStack("repair_hammer", 5),
    ],
  },
  {
    id: "merchant_armor_01",
    name: "Shield & Hauberk",
    factionId: "merchants_guild",
    gold: 650,
    priceMultiplier: 1.12,
    openHour: 8,
    closeHour: 19,
    shop: { id: "shop_shield_hauberk", name: "Shield & Hauberk", type: "armor" },
    stock: () => [
      { id: "leather_chest_01", name: "Leather Chest", description: "Light armor. +15 Armor Rating.", stackable: false, quantity: 1, slot: "chest", weight: 4, stats: { armor: 15, value: 55 } },
      { id: "iron_helm_01", name: "Iron Helm", description: "A sturdy iron helmet. +12 Armor Rating.", stackable: false, quantity: 2, slot: "head", weight: 2.5, stats: { armor: 12, value: 45 } },
      smithingMaterialStack("iron_ingot", 6),
      smithingMaterialStack("leather_strips", 10),
      smithingMaterialStack("repair_hammer", 5),
    ],
  },
  {
    id: "merchant_alchemist_01",
    name: "Stillwater Reagents",
    factionId: "mages_college",
    gold: 520,
    priceMultiplier: 1.2,
    openHour: 9,
    closeHour: 18,
    shop: { id: "shop_stillwater_reagents", name: "Stillwater Reagents", type: "alchemist" },
    stock: () => [
      { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 12, weight: 0.5, stats: { ...HEALTH_POTION_STATS } },
      { id: "potion_mp_01", name: "Magicka Potion", description: "Restores 50 magicka.", stackable: true, quantity: 8, weight: 0.5, stats: { value: 30, magicka: 50 } },
      { id: "potion_cure", name: "Cure Disease", description: "A bitter draught. Drink to clear any sickness.", stackable: true, quantity: 4, weight: 0.5, stats: { value: 40, cure: 1 } },
      { id: "henbane", name: "Henbane", description: "A reagent for the alchemy bench (L).", stackable: true, quantity: 6, weight: 0.1, stats: { value: 6 } },
      { id: "eyebright", name: "Eyebright", description: "A reagent for the alchemy bench (L).", stackable: true, quantity: 6, weight: 0.1, stats: { value: 5 } },
      { id: "st_johns_wort", name: "St John's Wort", description: "A reagent for the alchemy bench (L).", stackable: true, quantity: 6, weight: 0.1, stats: { value: 5 } },
      { id: "foxglove", name: "Foxglove", description: "A reagent for the alchemy bench (L).", stackable: true, quantity: 4, weight: 0.1, stats: { value: 8 } },
      { id: "puffball", name: "Puffball", description: "A reagent for the alchemy bench (L).", stackable: true, quantity: 4, weight: 0.1, stats: { value: 6 } },
      { id: "fern_seed", name: "Fern Seed", description: "A reagent for the alchemy bench (L).", stackable: true, quantity: 3, weight: 0.1, stats: { value: 12 } },
      { id: "vessel_clay", name: "Clay Vessel", description: "Holds a small spirit for the enchanting altar (B).", stackable: true, quantity: 4, weight: 0.1, stats: { value: 20 } },
      { id: "vessel_pewter", name: "Pewter Vessel", description: "Holds a spirit for the enchanting altar (B).", stackable: true, quantity: 2, weight: 0.1, stats: { value: 45 } },
      { id: "tome_rime", name: "Tome: Rime", description: "Read it to learn Rime.", stackable: false, quantity: 1, weight: 0.5, stats: { value: 90 } },
      { id: "tome_barkskin", name: "Tome: Bark-skin", description: "Read it to learn Bark-skin.", stackable: false, quantity: 1, weight: 0.5, stats: { value: 110 } },
      { id: "tome_fade", name: "Tome: Fade", description: "Read it to learn Fade.", stackable: false, quantity: 1, weight: 0.5, stats: { value: 140 } },
      { id: "tome_thunderlash", name: "Tome: Thunderlash", description: "Read it to learn Thunderlash.", stackable: false, quantity: 1, weight: 0.5, stats: { value: 120 } },
    ],
  },
];

/** The shop version of an item id (its stats, weight and text), for gifts from dialogue. */
export function stockItem(id: string): Item | undefined {
  for (const m of STARTER_MERCHANTS) {
    const hit = m.stock().find((i) => i.id === id);
    if (hit) return { ...hit, stats: hit.stats ? { ...hit.stats } : undefined };
  }
  return undefined;
}

/** Register every starter merchant with barter, restock and the shop list. */
export function registerStarterMerchants(
  barter: BarterSystem,
  restock: MerchantRestockSystem,
  shops: ShopSystem,
  nowGameTime: number,
): void {
  for (const m of STARTER_MERCHANTS) {
    barter.registerMerchant({
      id: m.id, name: m.name, factionId: m.factionId, inventory: m.stock(), gold: m.gold,
      priceMultiplier: m.priceMultiplier, isOpen: true, openHour: m.openHour, closeHour: m.closeHour,
    });
    restock.registerMerchant(m.id, m.stock(), m.gold, RESTOCK_HOURS, nowGameTime);
  }
  shops.registerAll(STARTER_MERCHANTS.map((m): ShopDef => ({
    ...m.shop, merchantId: m.id, factionId: m.factionId, openHour: m.openHour, closeHour: m.closeHour,
  })));
}

/**
 * A village's own branch of a starter shop (`merchant_general_01@village_3_-2`):
 * the same trade, its own shelves and purse, registered the first time the
 * player trades there (a saved branch takes back its stock as it registers).
 * Returns the branch's merchant id; an unknown base id comes back unchanged.
 */
export function branchMerchant(
  barter: BarterSystem,
  restock: MerchantRestockSystem,
  baseId: string,
  placeId: string,
  nowGameTime: number,
): string {
  const def = STARTER_MERCHANTS.find((m) => m.id === baseId);
  if (!def) return baseId;
  const id = `${baseId}@${placeId}`;
  if (barter.hasMerchant(id)) return id;
  barter.registerMerchant({
    id, name: def.name, factionId: def.factionId, inventory: def.stock(), gold: def.gold,
    priceMultiplier: def.priceMultiplier, isOpen: true, openHour: def.openHour, closeHour: def.closeHour,
  });
  restock.registerMerchant(id, def.stock(), def.gold, RESTOCK_HOURS, nowGameTime);
  return id;
}

/** The starter shop a branch id belongs to ("merchant_general_01@…" → "merchant_general_01"). */
export const baseMerchantId = (id: string): string => id.split("@")[0];
