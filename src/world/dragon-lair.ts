/**
 * The tundra dragon boss: an NPC the combat AI tracks (its capsule hidden),
 * with the dragon body parented to it so it moves, turns and fights with the
 * boss.  Owned by its chunk: it goes when the chunk unloads.
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { NPC } from "../entities/npc";
import { setInstanceScale, setInstanceYaw, type FantasyAssetLoader } from "../systems/fantasy-asset-loader";
import type { ChunkContent } from "./chunk-content";
import type { NpcRoster } from "../game/npc-roster";
import type { NpcVisuals } from "../rendering/npc-visuals";

export interface DragonLairDeps {
  scene: Scene;
  chunks: ChunkContent;
  roster: NpcRoster;
  assets: FantasyAssetLoader;
  visuals: NpcVisuals;
}

/** The boss's numbers before level scaling. */
const DRAGON = { health: 500, attackDamage: 40, aggroRange: 25, xpReward: 500, armorRating: 60, lootTableId: "boss_loot" };

export function spawnDragon(d: DragonLairDeps, chunkKey: string, x: number, z: number, yaw: number): NPC | null {
  const record = d.chunks.record(chunkKey);
  if (!record) return null;
  const [cx, cz] = chunkKey.split(",").map(Number);
  const dragon = new NPC(d.scene, new Vector3(x, 2, z), `DragonBoss_${cx}_${cz}`);
  dragon.maxHealth = dragon.health = DRAGON.health;
  dragon.attackDamage = DRAGON.attackDamage;
  dragon.aggroRange = DRAGON.aggroRange;
  dragon.xpReward = DRAGON.xpReward;
  dragon.armorRating = DRAGON.armorRating;
  dragon.lootTableId = DRAGON.lootTableId;
  // The body is the visual; the capsule stays hidden and out of distance
  // culling (toggling it would reveal it; the body culls with the chunk).
  dragon.mesh.isVisible = false;
  d.roster.add(dragon, { regional: true, cull: false, pockets: false });
  record.npcs.push(dragon);

  d.assets.getInstance("qDragonSmall", (root) => {
    if (!root) return;
    if (dragon.isDead || dragon.mesh.isDisposed() || d.chunks.record(chunkKey) !== record) {
      root.dispose();
      return;
    }
    root.parent = dragon.mesh;
    root.position.set(0, -1, 0); // the capsule's origin sits 1 m above its feet
    setInstanceScale(root, 2.5);
    setInstanceYaw(root, yaw);
    for (const m of root.getChildMeshes(false)) m.isPickable = false;
    d.visuals.addDragon(dragon, root, yaw);
    d.chunks.track(chunkKey, record, root, "boss");
  });
  return dragon;
}
