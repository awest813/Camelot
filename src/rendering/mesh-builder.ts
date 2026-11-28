/**
 * The mesh builders the game uses, as one `MeshBuilder` object.
 *
 * Babylon's own `MeshBuilder` (Meshes/meshBuilder) imports every builder it
 * has (decals, polyhedra, geodesics, ribbons, tiled planes, text, …), about
 * 250 KB of unminified code in the start-up bundle for the nine shapes the
 * game makes. Import `MeshBuilder` from here instead; add a builder below
 * when a new shape is needed.
 */
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateLineSystem } from "@babylonjs/core/Meshes/Builders/linesBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";

export const MeshBuilder = {
  CreateBox,
  CreateCapsule,
  CreateCylinder,
  CreateDisc,
  CreateGround,
  CreateLineSystem,
  CreatePlane,
  CreateSphere,
  CreateTorus,
};
