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

  // Stats
  public health: number;
  public maxHealth: number = 100;
  public magicka: number;
  public maxMagicka: number = 100;
  public stamina: number;
  public maxStamina: number = 100;

  // Regeneration rates
  public healthRegen: number = 0.5;
  public magickaRegen: number = 2;
  public staminaRegen: number = 5;

  // Equipment bonuses
  public bonusDamage: number = 0;
  public bonusArmor: number = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;

    this.health = this.maxHealth;
    this.magicka = this.maxMagicka;
    this.stamina = this.maxStamina;

    this._initCamera();
    this._initPhysics();
  }

  public update(deltaTime: number): void {
      this.health = Math.min(this.maxHealth, this.health + this.healthRegen * deltaTime);
      this.magicka = Math.min(this.maxMagicka, this.magicka + this.magickaRegen * deltaTime);
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * deltaTime);
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
