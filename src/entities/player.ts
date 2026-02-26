import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Item, ItemStats } from "../systems/inventory-system";
import { ExperienceSystem } from "../systems/experience-system";

/**
 * Cumulative stat bonuses from all equipped items.
 * Extends ItemStats since equipment can provide those bonuses.
 */
interface EquipmentBonuses extends ItemStats {}

export class Player {
  public camera: UniversalCamera;
  public scene: Scene;
  private canvas: HTMLCanvasElement;
  private physicsAggregate: PhysicsAggregate;
  private playerMesh: any; // Visual mesh for armor display

  // Base stats (before equipment bonuses)
  public baseMaxHealth: number = 100;
  public baseMaxMagicka: number = 100;
  public baseMaxStamina: number = 100;
  public baseHealthRegen: number = 0.5;
  public baseMagickaRegen: number = 2;
  public baseStaminaRegen: number = 5;

  // Current stats (includes equipment bonuses)
  public health: number;
  public maxHealth: number = 100;
  public magicka: number;
  public maxMagicka: number = 100;
  public stamina: number;
  public maxStamina: number = 100;
  public healthRegen: number = 0.5;
  public magickaRegen: number = 2;
  public staminaRegen: number = 5;
  public damage: number = 1; // base damage
  public armor: number = 0; // armor reduces incoming damage

  // Equipment bonuses
  private _equipmentBonuses: EquipmentBonuses = {};

  // Experience and leveling
  public experience: ExperienceSystem = new ExperienceSystem();

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;

    this.health = this.baseMaxHealth;
    this.magicka = this.baseMaxMagicka;
    this.stamina = this.baseMaxStamina;

    this._initCamera();
    this._initPhysics();
  }

  /**
   * Apply equipment bonuses from an item.
   */
  public applyEquipmentBonus(item: Item): void {
    if (!item.stats) return;

    // Track bonuses
    if (item.stats.maxHealth) this._equipmentBonuses.maxHealth = (this._equipmentBonuses.maxHealth || 0) + item.stats.maxHealth;
    if (item.stats.maxMagicka) this._equipmentBonuses.maxMagicka = (this._equipmentBonuses.maxMagicka || 0) + item.stats.maxMagicka;
    if (item.stats.maxStamina) this._equipmentBonuses.maxStamina = (this._equipmentBonuses.maxStamina || 0) + item.stats.maxStamina;
    if (item.stats.damage) this._equipmentBonuses.damage = (this._equipmentBonuses.damage || 0) + item.stats.damage;
    if (item.stats.armor) this._equipmentBonuses.armor = (this._equipmentBonuses.armor || 0) + item.stats.armor;
    if (item.stats.healthRegen) this._equipmentBonuses.healthRegen = (this._equipmentBonuses.healthRegen || 0) + item.stats.healthRegen;
    if (item.stats.magickaRegen) this._equipmentBonuses.magickaRegen = (this._equipmentBonuses.magickaRegen || 0) + item.stats.magickaRegen;
    if (item.stats.staminaRegen) this._equipmentBonuses.staminaRegen = (this._equipmentBonuses.staminaRegen || 0) + item.stats.staminaRegen;

    this._recalculateStats();
  }

  /**
   * Remove equipment bonuses from an item.
   */
  public removeEquipmentBonus(item: Item): void {
    if (!item.stats) return;

    if (item.stats.maxHealth) this._equipmentBonuses.maxHealth = Math.max(0, (this._equipmentBonuses.maxHealth || 0) - item.stats.maxHealth);
    if (item.stats.maxMagicka) this._equipmentBonuses.maxMagicka = Math.max(0, (this._equipmentBonuses.maxMagicka || 0) - item.stats.maxMagicka);
    if (item.stats.maxStamina) this._equipmentBonuses.maxStamina = Math.max(0, (this._equipmentBonuses.maxStamina || 0) - item.stats.maxStamina);
    if (item.stats.damage) this._equipmentBonuses.damage = Math.max(0, (this._equipmentBonuses.damage || 0) - item.stats.damage);
    if (item.stats.armor) this._equipmentBonuses.armor = Math.max(0, (this._equipmentBonuses.armor || 0) - item.stats.armor);
    if (item.stats.healthRegen) this._equipmentBonuses.healthRegen = Math.max(0, (this._equipmentBonuses.healthRegen || 0) - item.stats.healthRegen);
    if (item.stats.magickaRegen) this._equipmentBonuses.magickaRegen = Math.max(0, (this._equipmentBonuses.magickaRegen || 0) - item.stats.magickaRegen);
    if (item.stats.staminaRegen) this._equipmentBonuses.staminaRegen = Math.max(0, (this._equipmentBonuses.staminaRegen || 0) - item.stats.staminaRegen);

    this._recalculateStats();
  }

  /**
   * Recalculate stats based on base stats + equipment bonuses + leveling bonuses.
   * Also clamp current values to not exceed max.
   */
  private _recalculateStats(): void {
    // Get leveling bonuses
    const levelBonuses = this.experience.getStatBonuses();

    this.maxHealth = this.baseMaxHealth + (this._equipmentBonuses.maxHealth || 0) + levelBonuses.health;
    this.maxMagicka = this.baseMaxMagicka + (this._equipmentBonuses.maxMagicka || 0) + levelBonuses.magicka;
    this.maxStamina = this.baseMaxStamina + (this._equipmentBonuses.maxStamina || 0) + levelBonuses.stamina;
    this.healthRegen = this.baseHealthRegen + (this._equipmentBonuses.healthRegen || 0);
    this.magickaRegen = this.baseMagickaRegen + (this._equipmentBonuses.magickaRegen || 0);
    this.staminaRegen = this.baseStaminaRegen + (this._equipmentBonuses.staminaRegen || 0);
    this.damage = 1 + (this._equipmentBonuses.damage || 0);
    this.armor = this._equipmentBonuses.armor || 0;

    // Clamp current values to max
    this.health = Math.min(this.health, this.maxHealth);
    this.magicka = Math.min(this.magicka, this.maxMagicka);
    this.stamina = Math.min(this.stamina, this.maxStamina);
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
    playerMesh.isVisible = false; // Hidden by default (just for physics)
    // Parent the mesh to the camera so it moves with it
    playerMesh.parent = this.camera;
    // Offset slightly down so camera is at head height
    playerMesh.position.y = -1;

    this.playerMesh = playerMesh;

    this.physicsAggregate = new PhysicsAggregate(playerMesh, PhysicsShapeType.CAPSULE, { mass: 1, restitution: 0 }, this.scene);

    // Set to ANIMATED so it follows the camera (parent) but still interacts physically with other objects
    this.physicsAggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
  }

  /**
   * Notify player that stats may have changed (e.g., from leveling).
   * Recalculates all stats including leveling bonuses.
   */
  public updateStats(): void {
    this._recalculateStats();
  }

  /**
   * Update player visual based on equipped armor (change color).
   * Creates a material if needed.
   */
  public updateArmorVisual(armorLevel: number): void {
    if (!this.playerMesh) return;

    // Create material if it doesn't exist
    if (!this.playerMesh.material) {
      const mat = new StandardMaterial("playerMat", this.scene);
      this.playerMesh.material = mat;
    }

    const mat = this.playerMesh.material as StandardMaterial;

    // Color based on armor level: gray for unarmored → dark blue for heavily armored
    if (armorLevel === 0) {
      mat.diffuseColor = new Color3(0.7, 0.7, 0.7); // Light gray (no armor)
    } else if (armorLevel < 5) {
      mat.diffuseColor = new Color3(0.5, 0.6, 0.8); // Light blue (light armor)
    } else if (armorLevel < 10) {
      mat.diffuseColor = new Color3(0.4, 0.5, 0.7); // Medium blue (medium armor)
    } else {
      mat.diffuseColor = new Color3(0.3, 0.4, 0.6); // Dark blue (heavy armor)
    }
  }
}
