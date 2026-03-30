/**
 * AnimationSystem — Procedural mesh animation for Camelot.
 *
 * Drives capsule-mesh NPCs and pets with keyframe animations using the
 * Babylon.js Animation API. No skeletal rigs required — all motion is
 * applied to `scaling` and `rotation` properties that are not controlled
 * by the Havok physics engine.
 *
 * Physics note: while an NPC has DYNAMIC motion type, the physics engine
 * writes back mesh position and rotation every frame.  Only `scaling` is
 * safe to animate while DYNAMIC.  After death the body is set to STATIC,
 * making rotation animations viable for the death-topple.
 *
 * Animations available:
 *   idle            — gentle Y-scale breathing loop
 *   walk            — moderate Y-scale bob loop (moving NPC)
 *   run             — fast Y-scale bob loop (chasing NPC)
 *   attackTelegraph — quick XZ-scale puff before a strike (one-shot)
 *   stagger         — squish-stretch X/Y pulse on hit interrupt (one-shot)
 *   death           — Z-rotation topple + Y-scale flatten (one-shot, persistent)
 */

import { Scene } from "@babylonjs/core/scene";
import { Animation } from "@babylonjs/core/Animations/animation";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

/** The set of named animation clips the system can play. */
export type AnimationClip = "idle" | "walk" | "run" | "telegraph" | "stagger" | "death";

const FPS = 60;

export class AnimationSystem {
  private readonly _scene: Scene;
  /** Tracks the currently playing clip name per mesh (keyed by mesh.name). */
  private readonly _active: Map<string, AnimationClip> = new Map();

  constructor(scene: Scene) {
    this._scene = scene;
  }

  // ── Looping clips ──────────────────────────────────────────────────────────

  /**
   * Start the idle breathing loop on a mesh.
   * No-op if the mesh is already idling or dead.
   */
  public playIdle(mesh: Mesh): void {
    const current = this._active.get(mesh.name);
    if (current === "idle" || current === "death") return;
    this._stopAll(mesh);
    this._active.set(mesh.name, "idle");

    // Gentle Y-scale swell: 1.0 → 1.015 → 1.0 → 0.985 → 1.0  (3-second cycle)
    const anim = new Animation(
      `${mesh.name}_idle`,
      "scaling.y",
      FPS,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    anim.setKeys([
      { frame: 0,   value: 1.0   },
      { frame: 45,  value: 1.015 },
      { frame: 90,  value: 1.0   },
      { frame: 135, value: 0.985 },
      { frame: 180, value: 1.0   },
    ]);
    mesh.animations = [anim];
    this._scene.beginAnimation(mesh, 0, 180, true);
  }

  /**
   * Start the walk-bob loop on a mesh.
   * No-op if the mesh is already walking or dead.
   */
  public playWalk(mesh: Mesh): void {
    const current = this._active.get(mesh.name);
    if (current === "walk" || current === "death") return;
    this._stopAll(mesh);
    this._active.set(mesh.name, "walk");

    const anim = new Animation(
      `${mesh.name}_walk`,
      "scaling.y",
      FPS,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    anim.setKeys([
      { frame: 0,  value: 1.0  },
      { frame: 10, value: 1.04 },
      { frame: 20, value: 1.0  },
      { frame: 30, value: 0.97 },
      { frame: 40, value: 1.0  },
    ]);
    mesh.animations = [anim];
    this._scene.beginAnimation(mesh, 0, 40, true);
  }

  /**
   * Start the run-bob loop on a mesh (faster/more intense than walk).
   * No-op if the mesh is already running or dead.
   */
  public playRun(mesh: Mesh): void {
    const current = this._active.get(mesh.name);
    if (current === "run" || current === "death") return;
    this._stopAll(mesh);
    this._active.set(mesh.name, "run");

    const anim = new Animation(
      `${mesh.name}_run`,
      "scaling.y",
      FPS,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    anim.setKeys([
      { frame: 0,  value: 1.0  },
      { frame: 6,  value: 1.06 },
      { frame: 12, value: 1.0  },
      { frame: 18, value: 0.95 },
      { frame: 24, value: 1.0  },
    ]);
    mesh.animations = [anim];
    this._scene.beginAnimation(mesh, 0, 24, true);
  }

  // ── One-shot clips ─────────────────────────────────────────────────────────

  /**
   * Play a pre-strike puff: XZ scale grows while Y shrinks, then snaps back.
   * Ignored on dead meshes.  Calls `onComplete` when the animation resolves.
   */
  public playAttackTelegraph(mesh: Mesh, onComplete?: () => void): void {
    if (this._active.get(mesh.name) === "death") return;
    this._stopAll(mesh);
    this._active.set(mesh.name, "telegraph");

    const scaleX = _makeAnimation(`${mesh.name}_tele_sx`, "scaling.x", FPS, [
      { frame: 0,  value: 1.0  },
      { frame: 8,  value: 1.25 },
      { frame: 22, value: 1.25 },
      { frame: 30, value: 1.0  },
    ]);
    const scaleZ = _makeAnimation(`${mesh.name}_tele_sz`, "scaling.z", FPS, [
      { frame: 0,  value: 1.0  },
      { frame: 8,  value: 1.25 },
      { frame: 22, value: 1.25 },
      { frame: 30, value: 1.0  },
    ]);
    const scaleY = _makeAnimation(`${mesh.name}_tele_sy`, "scaling.y", FPS, [
      { frame: 0,  value: 1.0  },
      { frame: 8,  value: 0.82 },
      { frame: 22, value: 0.82 },
      { frame: 30, value: 1.0  },
    ]);

    mesh.animations = [scaleX, scaleZ, scaleY];
    this._scene.beginAnimation(mesh, 0, 30, false, 1.0, () => {
      mesh.scaling.set(1, 1, 1);
      if (this._active.get(mesh.name) === "telegraph") {
        this._active.delete(mesh.name);
      }
      onComplete?.();
    });
  }

  /**
   * Play a squish-stretch stagger reaction (power-attack interrupt).
   * Ignored on dead meshes.
   */
  public playStagger(mesh: Mesh): void {
    if (this._active.get(mesh.name) === "death") return;
    this._stopAll(mesh);
    this._active.set(mesh.name, "stagger");

    const scaleX = _makeAnimation(`${mesh.name}_stag_sx`, "scaling.x", FPS, [
      { frame: 0,  value: 1.0  },
      { frame: 4,  value: 1.35 },
      { frame: 8,  value: 0.75 },
      { frame: 12, value: 1.2  },
      { frame: 16, value: 0.9  },
      { frame: 20, value: 1.0  },
    ]);
    const scaleY = _makeAnimation(`${mesh.name}_stag_sy`, "scaling.y", FPS, [
      { frame: 0,  value: 1.0  },
      { frame: 4,  value: 0.85 },
      { frame: 8,  value: 1.15 },
      { frame: 12, value: 0.9  },
      { frame: 16, value: 1.05 },
      { frame: 20, value: 1.0  },
    ]);

    mesh.animations = [scaleX, scaleY];
    this._scene.beginAnimation(mesh, 0, 20, false, 1.0, () => {
      mesh.scaling.set(1, 1, 1);
      if (this._active.get(mesh.name) === "stagger") {
        this._active.delete(mesh.name);
      }
    });
  }

  /**
   * Play the death-topple animation: capsule rotates onto its side and flattens.
   *
   * Must be called *after* the physics body has been set to STATIC so that the
   * physics engine no longer overrides rotation.  The final pose is kept
   * permanently (clip stays registered as "death").
   */
  public playDeath(mesh: Mesh): void {
    if (this._active.get(mesh.name) === "death") return;
    this._stopAll(mesh);
    this._active.set(mesh.name, "death");

    const rotZ = _makeAnimation(`${mesh.name}_death_rz`, "rotation.z", FPS, [
      { frame: 0,  value: 0             },
      { frame: 18, value: Math.PI * 0.46 },
      { frame: 22, value: Math.PI * 0.44 },
    ]);
    const scaleY = _makeAnimation(`${mesh.name}_death_sy`, "scaling.y", FPS, [
      { frame: 0,  value: 1.0  },
      { frame: 18, value: 0.58 },
      { frame: 22, value: 0.55 },
    ]);
    const scaleX = _makeAnimation(`${mesh.name}_death_sx`, "scaling.x", FPS, [
      { frame: 0,  value: 1.0  },
      { frame: 18, value: 1.4  },
      { frame: 22, value: 1.45 },
    ]);

    mesh.animations = [rotZ, scaleY, scaleX];
    // `death` stays in _active permanently — do not delete it in the callback.
    this._scene.beginAnimation(mesh, 0, 22, false);
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  /**
   * Stop all animations on `mesh` and reset its scaling to (1,1,1).
   * No-op on dead meshes (preserves death pose).
   */
  public stopAnimation(mesh: Mesh): void {
    if (this._active.get(mesh.name) === "death") return;
    this._stopAll(mesh);
    this._active.delete(mesh.name);
  }

  /** True if this mesh is permanently in the death-topple pose. */
  public isDeadClip(meshName: string): boolean {
    return this._active.get(meshName) === "death";
  }

  /**
   * Clean up internal tracking when an NPC or pet mesh is removed from the scene.
   * Call this before disposing the mesh.
   */
  public unregisterMesh(meshName: string): void {
    this._active.delete(meshName);
  }

  /**
   * Drive animation state from an NPC's AI state string + combat flags.
   *
   * Convenience helper so `game.ts` can call a single method per NPC per
   * update instead of manually routing state to individual play* calls.
   *
   * @param mesh               The NPC's capsule mesh.
   * @param aiState            Current AIState string value.
   * @param isAttackTelegraph  True while the NPC is in telegraph wind-up.
   * @param isStaggered        True while the NPC is staggered.
   * @param isDead             True when the NPC has died.
   */
  public updateNPCAnimation(
    mesh: Mesh,
    aiState: string,
    isAttackTelegraph: boolean,
    isStaggered: boolean,
    isDead: boolean,
  ): void {
    if (isDead) {
      if (!this.isDeadClip(mesh.name)) {
        this.playDeath(mesh);
      }
      return;
    }

    if (isStaggered) {
      if (this._active.get(mesh.name) !== "stagger") {
        this.playStagger(mesh);
      }
      return;
    }

    if (isAttackTelegraph) {
      if (this._active.get(mesh.name) !== "telegraph") {
        this.playAttackTelegraph(mesh);
      }
      return;
    }

    // Route by AI state
    switch (aiState) {
      case "CHASE":
      case "FLEE":
        this.playRun(mesh);
        break;
      case "ATTACK":
      case "ALERT":
      case "PATROL":
      case "INVESTIGATE":
        this.playWalk(mesh);
        break;
      default:
        // IDLE, RETURN
        this.playIdle(mesh);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _stopAll(mesh: Mesh): void {
    this._scene.stopAnimation(mesh);
    // Only reset scale when not preserving a death pose
    if (this._active.get(mesh.name) !== "death") {
      mesh.scaling.set(1, 1, 1);
    }
    mesh.animations = [];
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────

/** Build a constant-loop-mode Animation from a compact keyframe array. */
function _makeAnimation(
  name: string,
  property: string,
  fps: number,
  keys: Array<{ frame: number; value: number }>,
): Animation {
  const anim = new Animation(
    name,
    property,
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  anim.setKeys(keys);
  return anim;
}
