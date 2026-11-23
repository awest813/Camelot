/**
 * The starting area's hand-placed content: a chest, the Old Cave, starter
 * gear and three enchanted weapons on the ground, and the first quests
 * (framework quests, added to the content the game's runtime is built from).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Loot } from "../entities/loot";
import type { Item } from "../systems/inventory-system";
import type { QuestDefinition } from "../framework/quests/quest-types";
import type { ContainerSystem } from "../systems/container-system";
import type { CellManager } from "../world/cell-manager";
import { setInstanceScale, type FantasyAssetLoader } from "../systems/fantasy-asset-loader";
import { HEALTH_POTION_STATS } from "./starter-merchants";

interface GroundWeapon {
  at: [number, number, number];
  item: Pick<Item, "id" | "name" | "description" | "slot" | "stats">;
  model: "runeSword" | "frostAxe" | "moltenDagger";
  /** Model scale and height relative to the pickup. */
  scale: number;
  lift: number;
}

/** Plain starter gear lying near the start. */
export const STARTER_GROUND_ITEMS: ReadonlyArray<{ at: [number, number, number]; item: Item }> = [
  { at: [5, 1, 5], item: { id: "sword_01", name: "Iron Sword", description: "A rusty iron sword.", stackable: false, quantity: 1, slot: "mainHand", stats: { damage: 10 } } },
  { at: [7, 1, 5], item: { id: "potion_hp_01", name: "Health Potion", description: "Restores 50 HP.", stackable: true, quantity: 1, stats: { ...HEALTH_POTION_STATS } } },
  { at: [6, 1, 7], item: { id: "leather_chest_01", name: "Leather Chest", description: "Light armor. +15 Armor Rating.", stackable: false, quantity: 1, slot: "chest", stats: { armor: 15 } } },
  { at: [8, 1, 7], item: { id: "iron_helm_01", name: "Iron Helm", description: "A sturdy iron helmet. +12 Armor Rating.", stackable: false, quantity: 1, slot: "head", stats: { armor: 12 } } },
];

export const STARTER_WEAPONS: readonly GroundWeapon[] = [
  { at: [3, 1, 3], item: { id: "rune_sword_01", name: "Runesword", description: "A blade etched with glowing runes. +22 Damage, +8 Magicka.", slot: "mainHand", stats: { damage: 22, magicka: 8 } }, model: "runeSword", scale: 0.6, lift: -0.2 },
  { at: [9, 1, 4], item: { id: "frost_axe_01", name: "Frost Axe", description: "A frost-enchanted axe. +18 Damage, +12 frost resist.", slot: "mainHand", stats: { damage: 18, frostResist: 12 } }, model: "frostAxe", scale: 0.55, lift: -0.15 },
  { at: [5, 1, 10], item: { id: "molten_dagger_01", name: "Molten Dagger", description: "Forged in volcanic glass. +14 Damage, 5 fire DoT.", slot: "mainHand", stats: { damage: 14, fireDot: 5 } }, model: "moltenDagger", scale: 0.5, lift: -0.1 },
];

/**
 * The three quests every new game starts with, as framework quests (the
 * one quest engine).  Node ids are the old quest-log objective ids, so
 * progress in saves from before the merge carries over.
 */
export const STARTER_QUESTS: readonly QuestDefinition[] = [
  {
    id: "quest_kill_guard",
    name: "Eliminate the Guard",
    description: "A rogue guard threatens the village. Defeat him.",
    xpReward: 100,
    nodes: [{ id: "obj_kill_guard", description: "Defeat the Guard", triggerType: "kill", targetId: "Guard", requiredCount: 1 }],
  },
  {
    id: "quest_collect_potions",
    name: "Stock the Medicine Chest",
    description: "The village healer needs supplies.",
    xpReward: 50,
    nodes: [{ id: "obj_collect_potions", description: "Collect Health Potions", triggerType: "pickup", targetId: "potion_hp_01", requiredCount: 1 }],
  },
  {
    id: "quest_speak_guard",
    name: "Parley with the Guard",
    description: "Try talking to the Guard before resorting to violence.",
    xpReward: 25,
    nodes: [{ id: "obj_talk_guard", description: "Speak with the Guard", triggerType: "talk", targetId: "Guard", requiredCount: 1 }],
  },
];

export interface StartingAreaDeps {
  scene: Scene;
  assets: FantasyAssetLoader;
  containers: ContainerSystem;
  cells: CellManager;
  /** Register a model as a shadow caster, when shadows are on. */
  castShadow(root: AbstractMesh): void;
}

export function seedStartingArea(d: StartingAreaDeps): void {
  d.containers.spawnContainer({
    id: "chest_01",
    name: "Old Chest",
    position: new Vector3(5, 1, 5),
    contents: [
      { id: "gold_coins", name: "Gold Coins", description: "A handful of gold coins.", stackable: true, quantity: 50, weight: 0.1, stats: { value: 1 } },
      { id: "iron_sword", name: "Iron Sword", description: "A basic iron sword.", stackable: false, quantity: 1, slot: "mainHand", weight: 3, stats: { damage: 10, value: 80 } },
    ],
  });

  // The Old Cave's entrance, with where the player comes back out.
  d.cells.buildSimpleInterior("cave_01", "Old Cave", "portal_cave_entrance", new Vector3(-8, 1, 8), new Vector3(-8, 2, 8));

  for (const g of STARTER_GROUND_ITEMS) new Loot(d.scene, new Vector3(...g.at), { ...g.item, stats: { ...g.item.stats } });

  // Each weapon is an ordinary pickup, drawn by its model once that loads
  // (the pickup sphere shows if the model can't).
  for (const w of STARTER_WEAPONS) {
    const loot = new Loot(d.scene, new Vector3(...w.at), { ...w.item, stackable: false, quantity: 1 } as Item);
    const mat = loot.mesh.material as { alpha: number } | null;
    if (mat) mat.alpha = 0;
    d.assets.getInstance(w.model, (root) => {
      if (!root) {
        if (mat) mat.alpha = 1;
        return;
      }
      root.parent = loot.mesh;
      root.position = new Vector3(0, w.lift, 0);
      setInstanceScale(root, w.scale);
      d.castShadow(root);
    });
  }

}
