/**
 * Give a freshly built interior cell real surfaces (rock walls, earthen
 * floor) and torchlight.  Torches hang from the room's floor, so they go
 * when the cell's meshes are disposed on the way out.
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "../rendering/mesh-builder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { Scene } from "@babylonjs/core/scene";
import type { ProceduralTextureManager } from "../systems/procedural-texture-manager";
import type { FireFx } from "../rendering/particles-fx";

export interface InteriorDressingDeps {
  scene: Scene;
  textures: ProceduralTextureManager;
  fireFx: FireFx | null;
}

export function dressInterior(cellId: string, d: InteriorDressingDeps): void {
  const tm = d.textures;
  const anchor = d.scene.getMeshByName("floor_" + cellId);
  for (const mesh of d.scene.meshes) {
    const mat = mesh.material;
    if (!(mat instanceof StandardMaterial) || mat.metadata?.dressed) continue;
    if (mat.name === "intFloor_" + cellId) {
      tm.applySurface(mat, "dirt", 3, 3, { tintStrength: 0 });
      mat.specularColor = new Color3(0.06, 0.05, 0.04);
      mat.metadata = { dressed: true };
    } else if (mat.name === "intWall_" + cellId) {
      tm.applySurface(mat, "rock", 4, 1, { tintStrength: 0 });
      mat.specularColor = new Color3(0.1, 0.09, 0.08);
      mat.specularPower = 32;
      mat.metadata = { dressed: true };
    }
  }
  if (!anchor) return;
  const torchMat = new StandardMaterial(`intTorchFlame_${cellId}`, d.scene);
  torchMat.emissiveColor = new Color3(1.0, 0.4, 0.05);
  torchMat.disableLighting = true;
  for (const [x, z] of [[-5.7, 0], [5.7, 0]] as const) {
    const flame = MeshBuilder.CreateCylinder(
      `intTorch_${cellId}_${x}`, { height: 0.3, diameterTop: 0, diameterBottom: 0.13, tessellation: 6 }, d.scene,
    );
    flame.position.set(x, 2.1, z);
    flame.material = torchMat;
    flame.isPickable = false;
    // Disposed with the room.
    flame.parent = anchor;
    flame.position.set(x - anchor.position.x, 2.1 - anchor.position.y, z - anchor.position.z);
    const light = new PointLight(`intTorch_${cellId}_${x}_light`, new Vector3(x, 2.2, z), d.scene);
    light.diffuse = new Color3(1.0, 0.6, 0.2);
    light.intensity = 1.1;
    light.range = 10;
    flame.onDisposeObservable.addOnce(() => light.dispose());
    d.fireFx?.attach({ flame, light, kind: "torch" });
  }
  anchor.onDisposeObservable.addOnce(() => torchMat.dispose());
}
