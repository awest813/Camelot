/**
 * How NPCs look in motion: rigged character models that follow the physics
 * capsules, dragon bodies, and routing each NPC's AI state to its animation
 * (with a distance LOD).
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { Scene } from "@babylonjs/core/scene";
import { AIState, NPC } from "../entities/npc";
import { CharacterModelLibrary, modelForNpcName, type CharacterRig } from "./character-models";
import type { AnimationSystem } from "../systems/animation-system";
import { setInstanceYaw } from "../systems/fantasy-asset-loader";

/** Squared distance beyond which NPC animation updates are skipped. */
export const NPC_ANIMATION_FAR_DISTANCE_SQ = 100 * 100;

interface DragonBody { root: AbstractMesh; yaw: number; last: Vector3; t: number }

export interface NpcVisualsDeps {
  scene: Scene;
  shadows: ShadowGenerator | null;
  /** Where the rigged character models are served from. */
  modelBase: string;
  animation(): AnimationSystem | undefined;
}

export class NpcVisuals {
  private readonly _rigs = new Map<NPC, CharacterRig>();
  private readonly _dragons = new Map<NPC, DragonBody>();

  constructor(private readonly _d: NpcVisualsDeps) {}

  /**
   * Give every NPC created from now on a rigged, animated body.  The physics
   * capsule keeps doing collision and picking; the model follows it, faces
   * its travel direction (or the player in combat) and plays skeletal clips
   * routed through the animation system.
   */
  public init(): void {
    const library = new CharacterModelLibrary(this._d.scene, this._d.modelBase, this._d.shadows);
    library.preload();
    NPC.onCreated = (npc) => {
      const id = modelForNpcName(npc.key);
      if (!id) return;
      void library.attach(npc.mesh, id).then((rig) => {
        if (!rig) return;
        this._rigs.set(npc, rig);
        npc.mesh.onDisposeObservable.addOnce(() => {
          this._rigs.delete(npc);
          this._d.animation()?.unregisterSkeletal(npc.mesh);
        });
        this._d.animation()?.registerSkeletal(npc.mesh, rig);
      });
    };
  }

  /** A dragon's body, parented to its capsule, turning and breathing with it. */
  public addDragon(npc: NPC, root: AbstractMesh, yaw: number): void {
    this._dragons.set(npc, { root, yaw, last: npc.mesh.position.clone(), t: 0 });
    npc.mesh.onDisposeObservable.addOnce(() => this._dragons.delete(npc));
  }

  /** Route each NPC's state to its animation, then pose rigs and dragons. */
  public update(dt: number, playerPos: Vector3, npcs: readonly NPC[]): void {
    const anim = this._d.animation();
    if (anim) {
      for (const npc of npcs) {
        const hitReact = npc.justTakenDamageVisual;
        if (hitReact) npc.justTakenDamageVisual = false;
        // Animation LOD: beyond 100 m a capsule is a few pixels and its loop
        // re-syncs from aiState on the next near update, so skip the work.
        // Dead NPCs always route so death animations play.
        if (!npc.isDead && !hitReact && Vector3.DistanceSquared(npc.mesh.position, playerPos) > NPC_ANIMATION_FAR_DISTANCE_SQ) continue;
        anim.updateNPCAnimation(npc.mesh, npc.aiState, npc.isAttackTelegraphing, npc.isStaggered, npc.isDead, hitReact);
      }
    }
    this._updateDragons(dt, playerPos);
    this._updateRigs(dt, playerPos);
  }

  /** Dragons face the player when fighting, else where they go; they slump on death. */
  private _updateDragons(dt: number, playerPos: Vector3): void {
    for (const [npc, v] of this._dragons) {
      if (v.root.isDisposed()) { this._dragons.delete(npc); continue; }
      v.t += dt;
      const pos = npc.mesh.position;
      if (npc.isDead) {
        // Slump into the ground over a couple of seconds.
        v.root.position.y = Math.max(-2.4, v.root.position.y - dt * 0.7);
        continue;
      }
      let target: number | null = null;
      if (npc.isAggressive || npc.aiState === AIState.ALERT) {
        target = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
      } else {
        const dx = pos.x - v.last.x, dz = pos.z - v.last.z;
        if (dx * dx + dz * dz > 1e-4) target = Math.atan2(dx, dz);
      }
      v.last.copyFrom(pos);
      if (target !== null) {
        let d = target - v.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        v.yaw += d * Math.min(1, dt * 3);
        setInstanceYaw(v.root, v.yaw);
      }
      // Slow breathing bob.
      v.root.position.y = -1 + Math.sin(v.t * 1.6) * 0.06;
    }
  }

  /** Rig facing, gait speed, hit flash and distance LOD. */
  private _updateRigs(dt: number, playerPos: Vector3): void {
    for (const [npc, rig] of this._rigs) {
      // Follow the LOD system's capsule cull so culled NPCs stop drawing too.
      const shown = npc.mesh.isVisible;
      if (rig.pivot.isEnabled(false) !== shown) rig.pivot.setEnabled(shown);
      const far = Vector3.DistanceSquared(npc.mesh.position, playerPos) > NPC_ANIMATION_FAR_DISTANCE_SQ;
      rig.setPaused(far && !npc.isDead);
      if (far) continue;
      // Fighters track the player; so does whoever the player is talking to.
      const engaged = !npc.isDead
        && (npc.isAggressive || npc.aiState === AIState.ALERT || npc.isAttackTelegraphing || npc.isInDialogue);
      rig.update(dt, npc.mesh.position, engaged ? playerPos : null);
    }
  }
}
