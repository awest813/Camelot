/**
 * The starting region's merchants and their shops.
 *
 * One table feeds the barter system (what they sell now), the restock system
 * (what they sell again every 72 game hours) and the shop registry. The two
 * used to be separate copies, and the general store's restock had lost its
 * food.
 */
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
      { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 5, weight: 0.3, stats: { ...HEALTH_POTION_STATS } },
      { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 3, weight: 1, stats: { value: 15 } },
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
      { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 8, weight: 0.3, stats: { ...HEALTH_POTION_STATS } },
      { id: "arrow_bundle", name: "Arrows (20)", description: "A bundle of iron arrows.", stackable: true, quantity: 4, weight: 1, stats: { value: 15 } },
      { id: "bread", name: "Loaf of Bread", description: "Hearty bread. Restores hunger.", stackable: true, quantity: 6, weight: 0.2, stats: { value: 5, nutrition: 30 } },
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
      { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 health.", stackable: true, quantity: 12, weight: 0.3, stats: { ...HEALTH_POTION_STATS } },
    ],
  },
];

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
