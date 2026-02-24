import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";

export class Player {
  public camera: UniversalCamera;
  public scene: Scene;
  private canvas: HTMLCanvasElement;
  private physicsAggregate: PhysicsAggregate;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;
    this._initCamera();
    this._initPhysics();
  }

  private _initCamera(): void {
    // Start position
    const startPos = new Vector3(0, 5, 0);
    this.camera = new UniversalCamera("playerCam", startPos, this.scene);

    // Attach controls
    this.camera.attachControl(this.canvas, true);

    // Set FPS keys (WASD)
    this.camera.keysUp.push(87);    // W
    this.camera.keysDown.push(83);  // S
    this.camera.keysLeft.push(65);  // A
    this.camera.keysRight.push(68); // D

    // Adjust speed and inertia
    this.camera.speed = 0.5;
    this.camera.inertia = 0.1;
    this.camera.angularSensibility = 800;

    // Enable gravity/collision on camera (basic)
    this.camera.checkCollisions = true;
    this.camera.applyGravity = true;
    this.camera.ellipsoid = new Vector3(1, 1, 1);
  }

  private _initPhysics(): void {
    const playerMesh = MeshBuilder.CreateCapsule("playerBody", { radius: 0.5, height: 2 }, this.scene);
    playerMesh.isVisible = false;
    // Parent the mesh to the camera so it moves with it
    playerMesh.parent = this.camera;
    // Offset slightly down so camera is at head height
    playerMesh.position.y = -1;

    this.physicsAggregate = new PhysicsAggregate(playerMesh, PhysicsShapeType.CAPSULE, { mass: 1, restitution: 0 }, this.scene);

    // Set to ANIMATED so it follows the camera (parent) but still interacts physically with other objects
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
  }
}
