/**
 * SkeletalAnimationSystem — Drives BabylonJS AnimationGroup clips on rigged
 * character and creature meshes loaded from Quaternius packs.
 *
 * Complements the existing procedural `AnimationSystem` (scaling/rotation
 * keyframes on capsule meshes) by providing skeletal animation playback for
 * GLB models that contain embedded `AnimationGroup` clips.
 *
 * Each character is registered with a set of named animation groups (e.g.
 * "Idle", "Walk", "Run", "Attack", "Death").  The system tracks the active
 * clip per character and handles transitions (cross-fade weight blending).
 *
 * Key design decisions:
 *   - Headless-testable: animation groups are abstracted behind a minimal
 *     interface (`AnimGroupHandle`) so tests can run without BabylonJS.
 *   - Procedural fallback: if no animation groups are registered for a
 *     character, play* methods are silent no-ops and the existing procedural
 *     AnimationSystem continues to work.
 *   - One clip active at a time per character (no blending in v1).
 *   - Death clip is permanent (mirrors AnimationSystem behaviour).
 *
 * Usage:
 *   const skelAnim = new SkeletalAnimationSystem();
 *   skelAnim.registerCharacter("npc_01", {
 *     Idle: idleGroup,
 *     Walk: walkGroup,
 *     Run:  runGroup,
 *     Attack: attackGroup,
 *     Death: deathGroup,
 *     Hit: hitGroup,
 *   });
 *   skelAnim.play("npc_01", "Idle", true);
 *   skelAnim.play("npc_01", "Attack", false, () => {
 *     skelAnim.play("npc_01", "Idle", true);
 *   });
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Minimal interface for an animation group handle.
 * In production this is a BabylonJS `AnimationGroup`; in tests it can be a
 * lightweight mock.
 */
export interface AnimGroupHandle {
  /** Start playback. If `loop` is true the animation repeats. */
  start(loop?: boolean, speedRatio?: number, from?: number, to?: number): void;
  /** Stop playback and optionally reset to the first frame. */
  stop(): void;
  /** Reset the animation to the first frame. */
  reset(): void;
  /** Set the weight of this animation group (0–1) for blending. */
  setWeightForAllAnimatables(weight: number): void;
  /** Callback fired when a non-looping animation finishes. */
  onAnimationGroupEndObservable: {
    addOnce(callback: () => void): void;
  };
}

/** Standard clip names that the system recognises. */
export type SkeletalClipName =
  | "Idle"
  | "Walk"
  | "Run"
  | "Attack"
  | "Death"
  | "Hit"
  | "Cast"
  | "Block"
  | "Dodge"
  | "Pickup"
  | "Sit";

/** Registered character state. */
interface CharacterAnimState {
  groups: Map<SkeletalClipName, AnimGroupHandle>;
  activeClip: SkeletalClipName | null;
  isDead: boolean;
}

/** Serialisable snapshot of character animation tracking. */
export interface SkeletalAnimSnapshot {
  [characterId: string]: {
    activeClip: SkeletalClipName | null;
    isDead: boolean;
  };
}

// ── System ──────────────────────────────────────────────────────────────────

export class SkeletalAnimationSystem {
  private readonly _characters: Map<string, CharacterAnimState> = new Map();

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a character's animation groups.
   * Call once after loading the GLB and extracting its animation groups.
   *
   * @param characterId  Unique identifier (e.g. mesh name).
   * @param groups       Map of clip name → AnimGroupHandle.
   */
  registerCharacter(
    characterId: string,
    groups: Partial<Record<SkeletalClipName, AnimGroupHandle>>,
  ): void {
    const map = new Map<SkeletalClipName, AnimGroupHandle>();
    for (const [name, handle] of Object.entries(groups)) {
      if (handle) {
        map.set(name as SkeletalClipName, handle);
      }
    }
    this._characters.set(characterId, {
      groups: map,
      activeClip: null,
      isDead: false,
    });
  }

  /**
   * Unregister a character and stop all its animations.
   */
  unregisterCharacter(characterId: string): void {
    const state = this._characters.get(characterId);
    if (state) {
      this._stopActive(state);
      this._characters.delete(characterId);
    }
  }

  /** Returns true if a character is registered. */
  isRegistered(characterId: string): boolean {
    return this._characters.has(characterId);
  }

  /** Returns all registered character IDs. */
  getRegisteredCharacters(): string[] {
    return Array.from(this._characters.keys());
  }

  /**
   * Returns the clip names available for a character.
   */
  getAvailableClips(characterId: string): SkeletalClipName[] {
    const state = this._characters.get(characterId);
    if (!state) return [];
    return Array.from(state.groups.keys());
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  /**
   * Play a named animation clip on a character.
   *
   * @param characterId  The character's unique identifier.
   * @param clip         The clip name to play.
   * @param loop         Whether the clip should loop (default: true).
   * @param onComplete   Optional callback fired when a non-looping clip ends.
   * @returns True if the clip was started, false if no-op or unavailable.
   */
  play(
    characterId: string,
    clip: SkeletalClipName,
    loop: boolean = true,
    onComplete?: () => void,
  ): boolean {
    const state = this._characters.get(characterId);
    if (!state) return false;

    // Dead characters can only play Death
    if (state.isDead && clip !== "Death") return false;

    // Already playing this clip
    if (state.activeClip === clip) return false;

    const group = state.groups.get(clip);
    if (!group) return false;

    // Stop current animation
    this._stopActive(state);

    // Start new clip
    state.activeClip = clip;
    group.setWeightForAllAnimatables(1.0);
    group.start(loop);

    // Mark permanent death
    if (clip === "Death") {
      state.isDead = true;
      group.onAnimationGroupEndObservable.addOnce(() => {
        // Death stays in final frame — do not clear activeClip
        onComplete?.();
      });
    } else if (!loop && onComplete) {
      group.onAnimationGroupEndObservable.addOnce(() => {
        // Clear one-shot clip when it finishes (unless dead)
        if (state.activeClip === clip && !state.isDead) {
          state.activeClip = null;
        }
        onComplete();
      });
    } else if (!loop) {
      group.onAnimationGroupEndObservable.addOnce(() => {
        if (state.activeClip === clip && !state.isDead) {
          state.activeClip = null;
        }
      });
    }

    return true;
  }

  /**
   * Stop the current animation on a character.
   * No-op on dead characters (preserves death pose).
   */
  stop(characterId: string): void {
    const state = this._characters.get(characterId);
    if (!state || state.isDead) return;
    this._stopActive(state);
    state.activeClip = null;
  }

  // ── Convenience drivers ───────────────────────────────────────────────────

  /**
   * Drive animation state from an NPC's AI state + combat flags.
   * Mirrors `AnimationSystem.updateNPCAnimation()` but for skeletal clips.
   */
  updateFromAIState(
    characterId: string,
    aiState: string,
    isAttacking: boolean,
    isDead: boolean,
    justTakenDamage: boolean,
  ): void {
    if (isDead) {
      this.play(characterId, "Death", false);
      return;
    }

    if (justTakenDamage) {
      this.play(characterId, "Hit", false, () => {
        // Return to idle after hit
        this.play(characterId, "Idle", true);
      });
      return;
    }

    // Don't interrupt one-shot clips (Hit is still playing)
    const state = this._characters.get(characterId);
    if (state?.activeClip === "Hit") return;

    if (isAttacking) {
      this.play(characterId, "Attack", false, () => {
        this.play(characterId, "Idle", true);
      });
      return;
    }

    switch (aiState) {
      case "CHASE":
      case "FLEE":
        this.play(characterId, "Run", true);
        break;
      case "ATTACK":
      case "PATROL":
        this.play(characterId, "Walk", true);
        break;
      default:
        this.play(characterId, "Idle", true);
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Returns the currently active clip for a character, or `null`. */
  getActiveClip(characterId: string): SkeletalClipName | null {
    return this._characters.get(characterId)?.activeClip ?? null;
  }

  /** True if the character is in permanent death state. */
  isDead(characterId: string): boolean {
    return this._characters.get(characterId)?.isDead ?? false;
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  /**
   * Capture animation tracking state for all registered characters.
   * Note: does not capture animation timeline position — callers should
   * use `play()` after restore to visually resume clips.
   */
  getSnapshot(): SkeletalAnimSnapshot {
    const snap: SkeletalAnimSnapshot = {};
    for (const [id, state] of this._characters) {
      snap[id] = {
        activeClip: state.activeClip,
        isDead: state.isDead,
      };
    }
    return snap;
  }

  /**
   * Restore animation tracking state from a snapshot.
   * Only restores state for characters that are currently registered.
   */
  restoreSnapshot(snapshot: SkeletalAnimSnapshot): void {
    for (const [id, data] of Object.entries(snapshot)) {
      const state = this._characters.get(id);
      if (!state) continue;
      state.activeClip = data.activeClip;
      state.isDead = data.isDead;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _stopActive(state: CharacterAnimState): void {
    if (state.activeClip) {
      const group = state.groups.get(state.activeClip);
      if (group) {
        group.stop();
        group.reset();
        group.setWeightForAllAnimatables(0);
      }
    }
  }
}
