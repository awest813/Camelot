import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ScheduleSystem } from "../systems/schedule-system";
import { InteractionSystem } from "../systems/interaction-system";
import { NPC } from "../entities/npc";
import { Loot } from "../entities/loot";

export class LevelManager {
  public scene: Scene;
  public scheduleSystem: ScheduleSystem;
  public interactionSystem: InteractionSystem;

  constructor(scene: Scene, scheduleSystem: ScheduleSystem, interactionSystem: InteractionSystem) {
    this.scene = scene;
    this.scheduleSystem = scheduleSystem;
    this.interactionSystem = interactionSystem;
  }

  public loadTestLevel(): void {
    // Spawn NPCs
    const npc = new NPC(this.scene, new Vector3(10, 2, 10), "Guard");
    npc.patrolPoints = [new Vector3(10, 2, 10), new Vector3(10, 2, 20), new Vector3(20, 2, 20), new Vector3(20, 2, 10)];
    this.scheduleSystem.addNPC(npc);

    // Spawn Loot
    const potion = new Loot(this.scene, new Vector3(5, 5, 5), {
        id: "pot_health",
        name: "Health Potion",
        type: "Consumable",
        description: "Restores health.",
        color: "red"
    });
    this.interactionSystem.addLoot(potion);

    const sword = new Loot(this.scene, new Vector3(8, 5, 8), {
        id: "wep_sword",
        name: "Iron Sword",
        type: "Weapon",
        description: "Sharp and pointy.",
        color: "gray",
        slot: "mainHand",
        stats: { damage: 10 }
    });
    this.interactionSystem.addLoot(sword);

    console.log("Loaded Test Level");
  }
}
