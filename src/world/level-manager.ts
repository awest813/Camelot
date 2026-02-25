import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ScheduleSystem } from "../systems/schedule-system";
import { NPC } from "../entities/npc";
import { Loot } from "../entities/loot";

export class LevelManager {
  private scene: Scene;
  private scheduleSystem: ScheduleSystem;

  constructor(scene: Scene, scheduleSystem: ScheduleSystem) {
    this.scene = scene;
    this.scheduleSystem = scheduleSystem;
  }

  public loadLevel(): void {
    console.log("Loading Level...");
    this._spawnNPCs();
    this._spawnLoot();
  }

  private _spawnNPCs(): void {
    // Guard NPC
    const npc = new NPC(this.scene, new Vector3(10, 2, 10), "Guard");
    npc.patrolPoints = [new Vector3(10, 2, 10), new Vector3(10, 2, 20), new Vector3(20, 2, 20), new Vector3(20, 2, 10)];
    this.scheduleSystem.addNPC(npc);
  }

  private _spawnLoot(): void {
    // Sword
    new Loot(this.scene, new Vector3(5, 1, 5), {
        id: "sword_01",
        name: "Iron Sword",
        description: "A rusty iron sword.",
        stackable: false,
        quantity: 1,
        slot: "mainHand",
        stats: { damage: 10 }
    });

    // Potion
    new Loot(this.scene, new Vector3(7, 1, 5), {
        id: "potion_hp_01",
        name: "Health Potion",
        description: "Restores 50 HP.",
        stackable: true,
        quantity: 1,
        stats: { heal: 50 }
    });
  }
}
