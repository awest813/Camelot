import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkeletalAnimationSystem } from "./skeletal-animation-system";
import type { AnimGroupHandle, SkeletalClipName } from "./skeletal-animation-system";

// ── Mock AnimGroupHandle ──────────────────────────────────────────────────────

function makeGroupHandle(): AnimGroupHandle & {
  _started: boolean;
  _loop: boolean;
  _weight: number;
  _onEndCallbacks: Array<() => void>;
  triggerEnd(): void;
} {
  const callbacks: Array<() => void> = [];
  return {
    _started: false,
    _loop: false,
    _weight: 0,
    _onEndCallbacks: callbacks,
    start(loop?: boolean) {
      this._started = true;
      this._loop = loop ?? false;
    },
    stop() {
      this._started = false;
    },
    reset() {
      // no-op in mock
    },
    setWeightForAllAnimatables(weight: number) {
      this._weight = weight;
    },
    onAnimationGroupEndObservable: {
      addOnce(callback: () => void) {
        callbacks.push(callback);
      },
    },
    triggerEnd() {
      const cbs = callbacks.splice(0, callbacks.length);
      for (const cb of cbs) cb();
    },
  };
}

function makeGroups(names: SkeletalClipName[]) {
  const groups: Partial<Record<SkeletalClipName, ReturnType<typeof makeGroupHandle>>> = {};
  for (const name of names) {
    groups[name] = makeGroupHandle();
  }
  return groups;
}

describe("SkeletalAnimationSystem", () => {
  let system: SkeletalAnimationSystem;
  const standardClips: SkeletalClipName[] = ["Idle", "Walk", "Run", "Attack", "Death", "Hit"];

  beforeEach(() => {
    system = new SkeletalAnimationSystem();
  });

  // ── Registration ──────────────────────────────────────────────────────────

  describe("registration", () => {
    it("registers a character with animation groups", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      expect(system.isRegistered("npc_01")).toBe(true);
    });

    it("getAvailableClips returns registered clip names", () => {
      const groups = makeGroups(["Idle", "Walk", "Run"]);
      system.registerCharacter("npc_01", groups);
      const clips = system.getAvailableClips("npc_01");
      expect(clips).toContain("Idle");
      expect(clips).toContain("Walk");
      expect(clips).toContain("Run");
      expect(clips).not.toContain("Attack");
    });

    it("unregisters a character and stops animations", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Idle", true);
      system.unregisterCharacter("npc_01");
      expect(system.isRegistered("npc_01")).toBe(false);
      expect(groups.Idle!._started).toBe(false);
    });

    it("getRegisteredCharacters returns all IDs", () => {
      system.registerCharacter("a", makeGroups(["Idle"]));
      system.registerCharacter("b", makeGroups(["Idle"]));
      expect(system.getRegisteredCharacters()).toEqual(["a", "b"]);
    });

    it("getAvailableClips returns empty for unregistered", () => {
      expect(system.getAvailableClips("unknown")).toEqual([]);
    });
  });

  // ── Playback ──────────────────────────────────────────────────────────────

  describe("play", () => {
    it("starts a looping clip", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      const result = system.play("npc_01", "Idle", true);
      expect(result).toBe(true);
      expect(groups.Idle!._started).toBe(true);
      expect(groups.Idle!._weight).toBe(1.0);
      expect(system.getActiveClip("npc_01")).toBe("Idle");
    });

    it("playing same clip is a no-op", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Idle", true);
      const result = system.play("npc_01", "Idle", true);
      expect(result).toBe(false);
    });

    it("switching clips stops the old one", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Idle", true);
      system.play("npc_01", "Walk", true);
      expect(groups.Idle!._started).toBe(false);
      expect(groups.Idle!._weight).toBe(0);
      expect(groups.Walk!._started).toBe(true);
      expect(system.getActiveClip("npc_01")).toBe("Walk");
    });

    it("returns false for unregistered character", () => {
      expect(system.play("unknown", "Idle", true)).toBe(false);
    });

    it("returns false for unavailable clip", () => {
      system.registerCharacter("npc_01", makeGroups(["Idle"]));
      expect(system.play("npc_01", "Attack", false)).toBe(false);
    });
  });

  // ── One-shot clips ────────────────────────────────────────────────────────

  describe("one-shot clips", () => {
    it("clears activeClip when one-shot completes", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Attack", false);
      expect(system.getActiveClip("npc_01")).toBe("Attack");
      groups.Attack!.triggerEnd();
      expect(system.getActiveClip("npc_01")).toBeNull();
    });

    it("fires onComplete callback", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      const onComplete = vi.fn();
      system.play("npc_01", "Attack", false, onComplete);
      groups.Attack!.triggerEnd();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("one-shot without callback still clears", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Hit", false);
      groups.Hit!.triggerEnd();
      expect(system.getActiveClip("npc_01")).toBeNull();
    });
  });

  // ── Death ─────────────────────────────────────────────────────────────────

  describe("death", () => {
    it("marks character as dead permanently", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Death", false);
      expect(system.isDead("npc_01")).toBe(true);
      expect(system.getActiveClip("npc_01")).toBe("Death");
    });

    it("dead character cannot play non-Death clips", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Death", false);
      expect(system.play("npc_01", "Idle", true)).toBe(false);
      expect(system.play("npc_01", "Walk", true)).toBe(false);
      expect(system.play("npc_01", "Attack", false)).toBe(false);
    });

    it("death clip stays active after completion", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Death", false);
      groups.Death!.triggerEnd();
      expect(system.getActiveClip("npc_01")).toBe("Death");
      expect(system.isDead("npc_01")).toBe(true);
    });

    it("stop is a no-op on dead characters", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Death", false);
      system.stop("npc_01");
      expect(system.getActiveClip("npc_01")).toBe("Death");
    });

    it("death onComplete still fires", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      const onComplete = vi.fn();
      system.play("npc_01", "Death", false, onComplete);
      groups.Death!.triggerEnd();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  // ── stop ──────────────────────────────────────────────────────────────────

  describe("stop", () => {
    it("stops the current animation and clears activeClip", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Idle", true);
      system.stop("npc_01");
      expect(system.getActiveClip("npc_01")).toBeNull();
      expect(groups.Idle!._started).toBe(false);
    });

    it("no-op for unregistered character", () => {
      expect(() => system.stop("unknown")).not.toThrow();
    });
  });

  // ── updateFromAIState ─────────────────────────────────────────────────────

  describe("updateFromAIState", () => {
    it("plays Death when isDead", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "IDLE", false, true, false);
      expect(system.getActiveClip("npc_01")).toBe("Death");
    });

    it("plays Hit on damage", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "IDLE", false, false, true);
      expect(system.getActiveClip("npc_01")).toBe("Hit");
    });

    it("plays Attack when isAttacking", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "ATTACK", true, false, false);
      expect(system.getActiveClip("npc_01")).toBe("Attack");
    });

    it("plays Run for CHASE state", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "CHASE", false, false, false);
      expect(system.getActiveClip("npc_01")).toBe("Run");
    });

    it("plays Run for FLEE state", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "FLEE", false, false, false);
      expect(system.getActiveClip("npc_01")).toBe("Run");
    });

    it("plays Walk for PATROL state", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "PATROL", false, false, false);
      expect(system.getActiveClip("npc_01")).toBe("Walk");
    });

    it("plays Idle for unknown state", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "IDLE", false, false, false);
      expect(system.getActiveClip("npc_01")).toBe("Idle");
    });

    it("does not interrupt Hit clip in progress", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.play("npc_01", "Hit", false);
      system.updateFromAIState("npc_01", "IDLE", false, false, false);
      expect(system.getActiveClip("npc_01")).toBe("Hit");
    });

    it("Hit returns to Idle on completion", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "IDLE", false, false, true);
      expect(system.getActiveClip("npc_01")).toBe("Hit");
      groups.Hit!.triggerEnd();
      expect(system.getActiveClip("npc_01")).toBe("Idle");
    });

    it("Attack returns to Idle on completion", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.updateFromAIState("npc_01", "ATTACK", true, false, false);
      expect(system.getActiveClip("npc_01")).toBe("Attack");
      groups.Attack!.triggerEnd();
      expect(system.getActiveClip("npc_01")).toBe("Idle");
    });
  });

  // ── Queries ───────────────────────────────────────────────────────────────

  describe("queries", () => {
    it("getActiveClip returns null for unregistered", () => {
      expect(system.getActiveClip("unknown")).toBeNull();
    });

    it("isDead returns false for unregistered", () => {
      expect(system.isDead("unknown")).toBe(false);
    });
  });

  // ── Snapshot ──────────────────────────────────────────────────────────────

  describe("snapshot", () => {
    it("captures state for all characters", () => {
      const groups1 = makeGroups(standardClips);
      const groups2 = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups1);
      system.registerCharacter("npc_02", groups2);
      system.play("npc_01", "Idle", true);
      system.play("npc_02", "Death", false);

      const snap = system.getSnapshot();
      expect(snap["npc_01"]).toEqual({ activeClip: "Idle", isDead: false });
      expect(snap["npc_02"]).toEqual({ activeClip: "Death", isDead: true });
    });

    it("restores state for registered characters", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);

      system.restoreSnapshot({
        npc_01: { activeClip: "Run", isDead: false },
      });

      expect(system.getActiveClip("npc_01")).toBe("Run");
      expect(system.isDead("npc_01")).toBe(false);
    });

    it("ignores unregistered characters in snapshot", () => {
      system.restoreSnapshot({
        unknown: { activeClip: "Idle", isDead: false },
      });
      expect(system.isRegistered("unknown")).toBe(false);
    });

    it("restores dead state", () => {
      const groups = makeGroups(standardClips);
      system.registerCharacter("npc_01", groups);
      system.restoreSnapshot({
        npc_01: { activeClip: "Death", isDead: true },
      });
      expect(system.isDead("npc_01")).toBe(true);
      expect(system.getActiveClip("npc_01")).toBe("Death");
    });
  });

  // ── Multi-character independence ──────────────────────────────────────────

  describe("multi-character", () => {
    it("tracks animations independently per character", () => {
      const groups1 = makeGroups(standardClips);
      const groups2 = makeGroups(standardClips);
      system.registerCharacter("a", groups1);
      system.registerCharacter("b", groups2);

      system.play("a", "Idle", true);
      system.play("b", "Run", true);

      expect(system.getActiveClip("a")).toBe("Idle");
      expect(system.getActiveClip("b")).toBe("Run");

      system.play("a", "Death", false);
      expect(system.isDead("a")).toBe(true);
      expect(system.isDead("b")).toBe(false);
      expect(system.play("b", "Attack", false)).toBe(true);
    });
  });
});
