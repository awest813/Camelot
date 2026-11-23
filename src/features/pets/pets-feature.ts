/**
 * Companions (pets) as a kernel feature: the pet roster, the companion
 * panel, the summoned companion's body, and its follow-and-fight AI.
 *
 * One `togglePanel` action (P) serves both the input adapter and the legacy
 * keyboard path, which used to carry two copies of it.
 *
 * Inputs:   services player, actors, animation, feedback, modal, gameplay,
 *           and the scene; a sim-phase system runs the AI.
 * Outputs:  the `pets` service; pet:* events on the bus.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { Scene } from "@babylonjs/core/scene";
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { PetSystem, type Pet } from "../../systems/pet-system";
import { PetUI } from "../../ui/pet-ui";
import { AIState, type NPC } from "../../entities/npc";
import { ActorsKey, AnimationKey, FeedbackKey, GameplayKey, ModalKey, PlayerKey } from "../services";

/** Seconds between a companion's attacks. */
const ATTACK_COOLDOWN = 2.0;

export interface PetsService {
  readonly pets: PetSystem;
  readonly panel: PetUI;
  /** P: open or close the companion panel. */
  togglePanel(): void;
}

export const PetsKey = createServiceKey<PetsService>("pets");

export class PetsFeature implements Feature {
  public readonly id = "pets";
  public readonly pets = new PetSystem();
  public readonly panel = new PetUI();
  private _mesh: Mesh | null = null;
  private _body: PhysicsAggregate | null = null;
  private _attackTimer = 0;
  private readonly _vel = new Vector3();
  private readonly _look = new Vector3();
  private _services: ServiceRegistry | null = null;

  constructor(private readonly _scene: Scene) {}

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    this._services = s;
    const events = ctx.kernel.events;
    const feedback = () => s.get(FeedbackKey);
    const anim = () => s.get(AnimationKey);

    this.pets.onPetAcquired = (pet) => {
      feedback().notify(`You gained a companion: ${pet.name}!`, 3000);
      events.emit("pet:acquired", { petId: pet.id, petName: pet.name, species: pet.species });
    };
    this.pets.onPetSummoned = (pet) => {
      this._spawn(pet);
      events.emit("pet:summoned", { petId: pet.id, petName: pet.name });
    };
    this.pets.onPetDismissed = (pet) => {
      this._despawn();
      events.emit("pet:dismissed", { petId: pet.id, petName: pet.name });
    };
    this.pets.onPetDied = (pet) => {
      feedback().notify(`${pet.name} has fallen in battle!`, 3500);
      events.emit("pet:died", { petId: pet.id, petName: pet.name });
      // Let the death animation play on the body before it goes.
      const mesh = this._mesh, body = this._body;
      this._mesh = null;
      this._body = null;
      if (mesh) {
        body?.body.setMotionType(PhysicsMotionType.STATIC);
        anim().death(mesh);
        setTimeout(() => {
          anim().release(mesh.name);
          body?.dispose();
          mesh.dispose();
        }, 3000);
      }
    };
    this.pets.onPetLevelUp = (pet, newLevel) => {
      feedback().notify(`${pet.name} reached level ${newLevel}!`, 2500);
      events.emit("pet:levelUp", { petId: pet.id, petName: pet.name, newLevel });
    };

    this.panel.onSummon = (petId) => {
      this.pets.summonPet(petId);
      this.panel.refresh(this.pets.pets, this.pets.activePet?.id ?? null);
    };
    this.panel.onDismiss = () => {
      this.pets.dismissPet();
      this.panel.refresh(this.pets.pets, null);
    };
    this.panel.onClose = () => s.get(ModalKey).restoreGameplay();

    ctx.provide(PetsKey, {
      pets: this.pets,
      panel: this.panel,
      togglePanel: () => {
        if (this.panel.isVisible) {
          this.panel.close();
          s.get(ModalKey).restoreGameplay();
          return;
        }
        if (!s.get(GameplayKey).canAct()) return;
        if (!this.pets.hasPet) {
          feedback().notify("You have no companions yet.", 2000);
          return;
        }
        this.panel.open(this.pets.pets, this.pets.activePet?.id ?? null);
        s.get(ModalKey).suspendGameplay();
      },
    });

    ctx.system({ id: "pets.ai", phase: "sim", update: (dt) => this._updateAI(dt) });
    // The companion HUD chip, redrawn when the companion or its health changes.
    let hudId: string | null | undefined, hudHealth = -1;
    ctx.system({
      id: "pets.hud", phase: "ui", update: () => {
        const pet = this.pets.activePet;
        const id = pet?.id ?? null;
        if (id === hudId && (!pet || pet.health === hudHealth)) return;
        hudId = id;
        hudHealth = pet?.health ?? -1;
        this.panel.updateHUD(pet);
      },
    });

    ctx.scope.add(() => {
      this._despawn();
      this.pets.onPetAcquired = null;
      this.pets.onPetSummoned = null;
      this.pets.onPetDismissed = null;
      this.pets.onPetDied = null;
      this.pets.onPetLevelUp = null;
      if (this.panel.isVisible) this.panel.close();
      this._services = null;
    });
  }

  /** A capsule body for the summoned pet, beside the player. */
  private _spawn(pet: Pet): void {
    this._despawn();
    const services = this._services;
    if (!services) return;
    const p = services.get(PlayerKey).position();
    const s = pet.meshScale;
    const name = `pet_${pet.id}`;
    const mesh = MeshBuilder.CreateCapsule(name, { radius: 0.5 * s, height: 2 * s }, this._scene);
    // Offset so it doesn't spawn inside the player.
    mesh.position.set(p.x + 2, Math.max(1.5, (p.y ?? 2) - 0.5), p.z);
    const mat = new StandardMaterial(`${name}_mat`, this._scene);
    mat.diffuseColor = new Color3(pet.meshColor.r, pet.meshColor.g, pet.meshColor.b);
    mat.specularColor = new Color3(0.1, 0.08, 0.06);
    mat.specularPower = 18;
    mesh.material = mat;
    mesh.receiveShadows = true;
    // No physics engine (headless tests): the pet stands still but still fights.
    if (this._scene.getPhysicsEngine()) {
      const body = new PhysicsAggregate(mesh, PhysicsShapeType.CAPSULE, { mass: 0.5, restitution: 0 }, this._scene);
      body.body.setMotionType(PhysicsMotionType.DYNAMIC);
      // Lock rotation so the capsule stays upright.
      body.body.setMassProperties({ inertia: new Vector3(0, 0, 0) });
      this._body = body;
    }
    this._mesh = mesh;
    this._attackTimer = 0;
    services.get(AnimationKey).idle(mesh);
  }

  private _despawn(): void {
    if (!this._mesh) return;
    this._services?.tryGet(AnimationKey)?.release(this._mesh.name);
    this._body?.dispose();
    this._mesh.dispose();
    this._mesh = null;
    this._body = null;
  }

  /** Follow the player; bite whoever is fighting them. */
  private _updateAI(dt: number): void {
    const pet = this.pets.activePet;
    const mesh = this._mesh, body = this._body?.body;
    const services = this._services;
    if (!pet || !mesh || !services) return;
    this.pets.updateMood(dt);
    const anim = services.get(AnimationKey);

    const petPos = mesh.position;
    const player = services.get(PlayerKey).position();
    const dx = player.x - petPos.x, dz = player.z - petPos.z;
    const distSq = dx * dx + dz * dz;
    const follow = pet.followDistance + 0.8;
    // Without a body (no physics engine) the pet stands still but still fights.
    if (body) {
      body.getLinearVelocityToRef(this._vel);
      if (distSq > follow * follow) {
        const dist = Math.sqrt(distSq);
        const far = dist > pet.followDistance + 5;
        const speed = far ? pet.moveSpeed : pet.moveSpeed * 0.65;
        const nx = (dx / dist) * speed, nz = (dz / dist) * speed;
        const blend = Math.min(1, 8 * dt);
        const v = this._vel;
        body.setLinearVelocity(v.set(v.x + (nx - v.x) * blend, v.y, v.z + (nz - v.z) * blend));
        this._look.set(petPos.x + nx, petPos.y, petPos.z + nz);
        mesh.lookAt(this._look);
        if (far) anim.run(mesh); else anim.walk(mesh);
      } else {
        body.setLinearVelocity(this._vel.set(0, this._vel.y, 0));
        anim.idle(mesh);
      }
    }

    this._attackTimer -= dt;
    if (this._attackTimer > 0) return;
    let target: NPC | null = null;
    let best = pet.attackRange * pet.attackRange;
    for (const npc of services.get(ActorsKey).all()) {
      if (npc.isDead) continue;
      if (npc.aiState !== AIState.CHASE && npc.aiState !== AIState.ATTACK && !npc.isAggressive) continue;
      const ex = npc.mesh.position.x - petPos.x, ez = npc.mesh.position.z - petPos.z;
      const d = ex * ex + ez * ez;
      if (d < best) { best = d; target = npc; }
    }
    if (target) {
      target.takeDamage(this.pets.getEffectiveAttackDamage());
      if (this.pets.petGainXP(5)) this.panel.refresh(this.pets.pets, this.pets.activePet?.id ?? null);
      this._attackTimer = ATTACK_COOLDOWN;
    } else {
      this._attackTimer = 0.4;
    }
  }

}
