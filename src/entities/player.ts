import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
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

  // Regen gating timers (seconds remaining)
  private _healthRegenDelayRemaining: number = 0;
  private _magickaRegenDelayRemaining: number = 0;
  private _staminaRegenDelayRemaining: number = 0;

  public static readonly HEALTH_REGEN_DELAY_AFTER_DAMAGE = 3.5;
  public static readonly MAGICKA_REGEN_DELAY_AFTER_CAST = 0.8;
  public static readonly STAMINA_REGEN_DELAY_AFTER_ATTACK = 0.55;

  // Equipment bonuses
  public bonusDamage: number = 0;
  public bonusArmor: number = 0;
  public bonusMagicDamage: number = 0;

  // Level & experience
  public level: number = 1;
  public experience: number = 0;
  public experienceToNextLevel: number = 100;
  public skillPoints: number = 0;

  /** Fired with the new level whenever the player levels up. */
  public onLevelUp: ((newLevel: number) => void) | null = null;

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
      this._healthRegenDelayRemaining = Math.max(0, this._healthRegenDelayRemaining - deltaTime);
      this._magickaRegenDelayRemaining = Math.max(0, this._magickaRegenDelayRemaining - deltaTime);
      this._staminaRegenDelayRemaining = Math.max(0, this._staminaRegenDelayRemaining - deltaTime);

      if (this._healthRegenDelayRemaining <= 0) {
        this.health = Math.min(this.maxHealth, this.health + this.healthRegen * deltaTime);
      }
      if (this._magickaRegenDelayRemaining <= 0) {
        this.magicka = Math.min(this.maxMagicka, this.magicka + this.magickaRegen * deltaTime);
      }
      if (this._staminaRegenDelayRemaining <= 0) {
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * deltaTime);
      }
  }

  /** Delay health recovery after receiving combat damage. */
  public notifyDamageTaken(): void {
    this._healthRegenDelayRemaining = Math.max(
      this._healthRegenDelayRemaining,
      Player.HEALTH_REGEN_DELAY_AFTER_DAMAGE
    );
  }

  /** Delay resource recovery after spending combat resources. */
  public notifyResourceSpent(resource: "magicka" | "stamina"): void {
    if (resource === "magicka") {
      this._magickaRegenDelayRemaining = Math.max(
        this._magickaRegenDelayRemaining,
        Player.MAGICKA_REGEN_DELAY_AFTER_CAST
      );
      return;
    }
    this._staminaRegenDelayRemaining = Math.max(
      this._staminaRegenDelayRemaining,
      Player.STAMINA_REGEN_DELAY_AFTER_ATTACK
    );
  }

  /**
   * Award experience points. Handles level-up(s) automatically.
   * Each level requires `level * 100` XP. On level-up, max stats increase
   * by 10 and `onLevelUp` is fired.
   */
  public addExperience(amount: number): void {
      this.experience += amount;
      while (this.experience >= this.experienceToNextLevel) {
          this.experience -= this.experienceToNextLevel;
          this.level++;
          this.experienceToNextLevel = this.level * 100;
          this.maxHealth += 10;
          this.maxMagicka += 10;
          this.maxStamina += 10;
          this.skillPoints++;
          this.onLevelUp?.(this.level);
      }
  }

  public getForwardDirection(distance: number = 1): Vector3 {
      return this.camera.getForwardRay(distance).direction;
  }

  public raycastForward(distance: number, requireVisible: boolean = false) {
    // Raycast forward
    const origin = this.camera.position;
    const forward = this.getForwardDirection(distance);
    const ray = new Ray(origin, forward, distance);

    return this.scene.pickWithRay(ray, (mesh) => {
       const baseCondition = mesh.name !== "playerBody" && !mesh.name.startsWith("chunk_");
       if (requireVisible) {
           return mesh.isVisible && baseCondition;
       }
       return baseCondition;
    });
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
