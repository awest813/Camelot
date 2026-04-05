import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnimationSystem } from "./animation-system";
import type { AnimationClip } from "./animation-system";

// ── Minimal BabylonJS mocks ───────────────────────────────────────────────────
// AnimationSystem imports Animation (runtime) and Scene (runtime).
// Mesh is import-type only so no mock is needed for it.

vi.mock("@babylonjs/core/Animations/animation", () => ({
  Animation: class MockAnimation {
    static ANIMATIONTYPE_FLOAT = 0;
    static ANIMATIONLOOPMODE_CYCLE = 0;
    static ANIMATIONLOOPMODE_CONSTANT = 1;

    name: string;
    targetProperty: string;
    framePerSecond: number;
    dataType: number;
    loopMode: number;
    private _keys: Array<{ frame: number; value: number }> = [];

    constructor(
      name: string,
      prop: string,
      fps: number,
      type: number,
      loop: number,
    ) {
      this.name = name;
      this.targetProperty = prop;
      this.framePerSecond = fps;
      this.dataType = type;
      this.loopMode = loop;
    }

    setKeys(keys: Array<{ frame: number; value: number }>): void {
      this._keys = keys;
    }

    getKeys() {
      return this._keys;
    }
  },
}));

vi.mock("@babylonjs/core/scene", () => ({
  Scene: class MockScene {},
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

type BeginCall = {
  mesh: any;
  from: number;
  to: number;
  loop: boolean;
  onComplete?: () => void;
};

function makeScene() {
  const calls: BeginCall[] = [];
  return {
    _calls: calls,
    beginAnimation: vi.fn(
      (
        mesh: any,
        from: number,
        to: number,
        loop: boolean,
        _speed?: number,
        onComplete?: () => void,
      ) => {
        calls.push({ mesh, from, to, loop, onComplete });
      },
    ),
    stopAnimation: vi.fn(),
    /** Invoke the onComplete callback for the last beginAnimation call for `mesh`. */
    triggerComplete(mesh: any): void {
      for (let i = calls.length - 1; i >= 0; i--) {
        if (calls[i].mesh === mesh && calls[i].onComplete) {
          calls[i].onComplete!();
          return;
        }
      }
    },
    /** Return the last beginAnimation call for `mesh`, or null. */
    lastCallFor(mesh: any): BeginCall | null {
      for (let i = calls.length - 1; i >= 0; i--) {
        if (calls[i].mesh === mesh) return calls[i];
      }
      return null;
    },
  };
}

function makeMesh(name = "npc_1") {
  return {
    name,
    animations: [] as any[],
    rotation: { x: 0, y: 0, z: 0 },
    scaling: {
      x: 1,
      y: 1,
      z: 1,
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AnimationSystem", () => {
  let scene: ReturnType<typeof makeScene>;
  let sys: AnimationSystem;
  let mesh: ReturnType<typeof makeMesh>;

  beforeEach(() => {
    scene = makeScene();
    sys = new AnimationSystem(scene as any);
    mesh = makeMesh("hero");
  });

  // ── Construction ───────────────────────────────────────────────────────────

  describe("construction", () => {
    it("constructs without throwing", () => {
      expect(() => new AnimationSystem(scene as any)).not.toThrow();
    });

    it("no clip is active on a fresh mesh", () => {
      expect(sys.getActiveClip("hero")).toBeUndefined();
    });

    it("isDeadClip returns false for unknown mesh", () => {
      expect(sys.isDeadClip("nobody")).toBe(false);
    });
  });

  // ── Looping clips ──────────────────────────────────────────────────────────

  describe("playIdle", () => {
    it("sets active clip to 'idle'", () => {
      sys.playIdle(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("idle");
    });

    it("calls beginAnimation with loop=true", () => {
      sys.playIdle(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(true);
    });

    it("is a no-op if already idle", () => {
      sys.playIdle(mesh);
      const callCount = scene._calls.length;
      sys.playIdle(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playIdle(mesh);
      expect(scene._calls.length).toBe(callCount);
      expect(sys.getActiveClip(mesh.name)).toBe("death");
    });

    it("transitions from walk to idle", () => {
      sys.playWalk(mesh);
      sys.playIdle(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("idle");
    });
  });

  describe("playWalk", () => {
    it("sets active clip to 'walk'", () => {
      sys.playWalk(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("walk");
    });

    it("calls beginAnimation with loop=true", () => {
      sys.playWalk(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(true);
    });

    it("is a no-op if already walking", () => {
      sys.playWalk(mesh);
      const callCount = scene._calls.length;
      sys.playWalk(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playWalk(mesh);
      expect(scene._calls.length).toBe(callCount);
    });
  });

  describe("playRun", () => {
    it("sets active clip to 'run'", () => {
      sys.playRun(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("run");
    });

    it("calls beginAnimation with loop=true", () => {
      sys.playRun(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(true);
    });

    it("is a no-op if already running", () => {
      sys.playRun(mesh);
      const callCount = scene._calls.length;
      sys.playRun(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playRun(mesh);
      expect(scene._calls.length).toBe(callCount);
    });
  });

  describe("playAlert", () => {
    it("sets active clip to 'alert'", () => {
      sys.playAlert(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("alert");
    });

    it("calls beginAnimation with loop=true", () => {
      sys.playAlert(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(true);
    });

    it("is a no-op if already on alert", () => {
      sys.playAlert(mesh);
      const callCount = scene._calls.length;
      sys.playAlert(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playAlert(mesh);
      expect(scene._calls.length).toBe(callCount);
    });
  });

  describe("playInvestigate", () => {
    it("sets active clip to 'investigate'", () => {
      sys.playInvestigate(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("investigate");
    });

    it("calls beginAnimation with loop=true", () => {
      sys.playInvestigate(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(true);
    });

    it("is a no-op if already investigating", () => {
      sys.playInvestigate(mesh);
      const callCount = scene._calls.length;
      sys.playInvestigate(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playInvestigate(mesh);
      expect(scene._calls.length).toBe(callCount);
    });
  });

  describe("playReturn", () => {
    it("sets active clip to 'return'", () => {
      sys.playReturn(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("return");
    });

    it("calls beginAnimation with loop=true", () => {
      sys.playReturn(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(true);
    });

    it("is a no-op if already returning", () => {
      sys.playReturn(mesh);
      const callCount = scene._calls.length;
      sys.playReturn(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playReturn(mesh);
      expect(scene._calls.length).toBe(callCount);
    });
  });

  // ── One-shot clips ─────────────────────────────────────────────────────────

  describe("playAttackTelegraph", () => {
    it("sets active clip to 'telegraph'", () => {
      sys.playAttackTelegraph(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("telegraph");
    });

    it("calls beginAnimation with loop=false", () => {
      sys.playAttackTelegraph(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(false);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playAttackTelegraph(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("calls onComplete callback after animation finishes", () => {
      const done = vi.fn();
      sys.playAttackTelegraph(mesh, done);
      scene.triggerComplete(mesh);
      expect(done).toHaveBeenCalledOnce();
    });

    it("resets scaling to (1,1,1) on completion", () => {
      mesh.scaling.set(1.25, 0.82, 1.25);
      sys.playAttackTelegraph(mesh);
      scene.triggerComplete(mesh);
      expect(mesh.scaling.x).toBe(1);
      expect(mesh.scaling.y).toBe(1);
      expect(mesh.scaling.z).toBe(1);
    });

    it("clears active clip on completion", () => {
      sys.playAttackTelegraph(mesh);
      scene.triggerComplete(mesh);
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
    });

    it("does not clear active if a new clip started before completion", () => {
      sys.playAttackTelegraph(mesh);
      // Manually override active to simulate a new clip starting before callback
      sys.playIdle(mesh);
      // Now trigger the stale telegraph callback – should not delete "idle"
      scene.triggerComplete(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("idle");
    });

    it("can re-trigger after previous telegraph completes", () => {
      sys.playAttackTelegraph(mesh);
      scene.triggerComplete(mesh);
      sys.playAttackTelegraph(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("telegraph");
    });
  });

  describe("playStagger", () => {
    it("sets active clip to 'stagger'", () => {
      sys.playStagger(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("stagger");
    });

    it("calls beginAnimation with loop=false", () => {
      sys.playStagger(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(false);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playStagger(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("resets scaling to (1,1,1) on completion", () => {
      sys.playStagger(mesh);
      scene.triggerComplete(mesh);
      expect(mesh.scaling.x).toBe(1);
      expect(mesh.scaling.y).toBe(1);
      expect(mesh.scaling.z).toBe(1);
    });

    it("clears active clip on completion", () => {
      sys.playStagger(mesh);
      scene.triggerComplete(mesh);
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
    });
  });

  describe("playHitReact", () => {
    it("sets active clip to 'hit'", () => {
      sys.playHitReact(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("hit");
    });

    it("calls beginAnimation with loop=false", () => {
      sys.playHitReact(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(false);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playHitReact(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("resets scaling to (1,1,1) on completion", () => {
      sys.playHitReact(mesh);
      scene.triggerComplete(mesh);
      expect(mesh.scaling.x).toBe(1);
      expect(mesh.scaling.y).toBe(1);
      expect(mesh.scaling.z).toBe(1);
    });

    it("clears active clip on completion", () => {
      sys.playHitReact(mesh);
      scene.triggerComplete(mesh);
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
    });
  });

  describe("playDeath", () => {
    it("sets active clip to 'death'", () => {
      sys.playDeath(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("death");
    });

    it("calls beginAnimation with loop=false", () => {
      sys.playDeath(mesh);
      expect(scene.lastCallFor(mesh)!.loop).toBe(false);
    });

    it("registers the mesh as dead via isDeadClip", () => {
      sys.playDeath(mesh);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("is a no-op if already dead", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playDeath(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("death clip persists — active never cleared by completion", () => {
      sys.playDeath(mesh);
      // death uses beginAnimation without onComplete, so no callback fires
      // but even if we had one, the clip stays
      expect(sys.getActiveClip(mesh.name)).toBe("death");
    });

    it("stops prior animation before starting death", () => {
      sys.playWalk(mesh);
      sys.playDeath(mesh);
      // stopAnimation was called at least twice (once for walk, once for death pre-stop)
      expect(scene.stopAnimation).toHaveBeenCalled();
    });

    it("assigns three animation tracks to the mesh", () => {
      sys.playDeath(mesh);
      // rotation.z + scaling.y + scaling.x
      expect(mesh.animations.length).toBe(3);
    });
  });

  // ── stopAnimation ──────────────────────────────────────────────────────────

  describe("stopAnimation", () => {
    it("clears the active clip", () => {
      sys.playWalk(mesh);
      sys.stopAnimation(mesh);
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
    });

    it("resets mesh scaling to (1,1,1)", () => {
      mesh.scaling.set(1, 1.04, 1);
      sys.playWalk(mesh);
      sys.stopAnimation(mesh);
      expect(mesh.scaling.x).toBe(1);
      expect(mesh.scaling.y).toBe(1);
      expect(mesh.scaling.z).toBe(1);
    });

    it("calls scene.stopAnimation", () => {
      sys.playIdle(mesh);
      sys.stopAnimation(mesh);
      expect(scene.stopAnimation).toHaveBeenCalledWith(mesh);
    });

    it("is a no-op on dead mesh — preserves death clip", () => {
      sys.playDeath(mesh);
      sys.stopAnimation(mesh);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("is safe to call when no clip is active", () => {
      expect(() => sys.stopAnimation(mesh)).not.toThrow();
    });
  });

  // ── isDeadClip ─────────────────────────────────────────────────────────────

  describe("isDeadClip", () => {
    it("returns false before any animation", () => {
      expect(sys.isDeadClip(mesh.name)).toBe(false);
    });

    it("returns false for looping clips", () => {
      sys.playIdle(mesh);
      expect(sys.isDeadClip(mesh.name)).toBe(false);
    });

    it("returns true after playDeath", () => {
      sys.playDeath(mesh);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });
  });

  // ── getActiveClip ──────────────────────────────────────────────────────────

  describe("getActiveClip", () => {
    it("returns undefined for unknown mesh", () => {
      expect(sys.getActiveClip("phantom")).toBeUndefined();
    });

    it("returns correct clip for each looping state", () => {
      const cases: Array<[() => void, AnimationClip]> = [
        [() => sys.playIdle(mesh),        "idle"],
        [() => sys.playWalk(mesh),        "walk"],
        [() => sys.playRun(mesh),         "run"],
        [() => sys.playAlert(mesh),       "alert"],
        [() => sys.playInvestigate(mesh), "investigate"],
        [() => sys.playReturn(mesh),      "return"],
      ];
      for (const [play, expected] of cases) {
        // Reset state by unregistering and refreshing
        sys.unregisterMesh(mesh.name);
        play();
        expect(sys.getActiveClip(mesh.name)).toBe(expected);
      }
    });
  });

  // ── unregisterMesh ─────────────────────────────────────────────────────────

  describe("unregisterMesh", () => {
    it("removes the active clip entry", () => {
      sys.playWalk(mesh);
      sys.unregisterMesh(mesh.name);
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
    });

    it("clears dead state as well", () => {
      sys.playDeath(mesh);
      sys.unregisterMesh(mesh.name);
      expect(sys.isDeadClip(mesh.name)).toBe(false);
    });

    it("is safe to call for unregistered mesh", () => {
      expect(() => sys.unregisterMesh("ghost")).not.toThrow();
    });

    it("allows a new death animation after unregister", () => {
      sys.playDeath(mesh);
      sys.unregisterMesh(mesh.name);
      // After unregister, the mesh is no longer dead — can play again
      sys.playDeath(mesh);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });
  });

  // ── Multiple meshes ────────────────────────────────────────────────────────

  describe("multiple mesh tracking", () => {
    it("tracks clips independently per mesh", () => {
      const m2 = makeMesh("npc_2");
      sys.playIdle(mesh);
      sys.playRun(m2);
      expect(sys.getActiveClip(mesh.name)).toBe("idle");
      expect(sys.getActiveClip(m2.name)).toBe("run");
    });

    it("stopping one mesh does not affect another", () => {
      const m2 = makeMesh("npc_2");
      sys.playAlert(mesh);
      sys.playAlert(m2);
      sys.stopAnimation(mesh);
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
      expect(sys.getActiveClip(m2.name)).toBe("alert");
    });
  });

  // ── updateNPCAnimation ─────────────────────────────────────────────────────

  describe("updateNPCAnimation", () => {
    it("plays death when isDead=true", () => {
      sys.updateNPCAnimation(mesh, "IDLE", false, false, true);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("does not re-trigger death when already dead", () => {
      sys.updateNPCAnimation(mesh, "IDLE", false, false, true);
      const callCount = scene._calls.length;
      sys.updateNPCAnimation(mesh, "IDLE", false, false, true);
      expect(scene._calls.length).toBe(callCount);
    });

    it("plays stagger when isStaggered=true", () => {
      sys.updateNPCAnimation(mesh, "IDLE", false, true, false);
      expect(sys.getActiveClip(mesh.name)).toBe("stagger");
    });

    it("does not re-trigger stagger when already staggering", () => {
      sys.updateNPCAnimation(mesh, "IDLE", false, true, false);
      const callCount = scene._calls.length;
      sys.updateNPCAnimation(mesh, "IDLE", false, true, false);
      expect(scene._calls.length).toBe(callCount);
    });

    it("isDead takes priority over isStaggered", () => {
      sys.updateNPCAnimation(mesh, "IDLE", false, true, true);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("plays hit react when justTakenDamage=true", () => {
      sys.updateNPCAnimation(mesh, "IDLE", false, false, false, true);
      expect(sys.getActiveClip(mesh.name)).toBe("hit");
    });

    it("holds hit clip during its duration — blocks other transitions", () => {
      // Simulate hit playing (not yet completed)
      sys.playHitReact(mesh);
      // telegraph is true but hit is still active — should not change
      sys.updateNPCAnimation(mesh, "IDLE", true, false, false, false);
      expect(sys.getActiveClip(mesh.name)).toBe("hit");
    });

    it("plays telegraph when isAttackTelegraph=true", () => {
      sys.updateNPCAnimation(mesh, "IDLE", true, false, false);
      expect(sys.getActiveClip(mesh.name)).toBe("telegraph");
    });

    it("does not re-trigger telegraph when already telegraphing", () => {
      sys.updateNPCAnimation(mesh, "IDLE", true, false, false);
      const callCount = scene._calls.length;
      sys.updateNPCAnimation(mesh, "IDLE", true, false, false);
      expect(scene._calls.length).toBe(callCount);
    });

    it.each([
      ["CHASE",       "run"],
      ["FLEE",        "run"],
      ["ALERT",       "alert"],
      ["INVESTIGATE", "investigate"],
      ["RETURN",      "return"],
      ["VICTORY",     "victory"],
      ["ATTACK",      "walk"],
      ["PATROL",      "walk"],
      ["IDLE",        "idle"],
      ["",            "idle"],
      ["UNKNOWN",     "idle"],
    ] as const)(
      "AI state '%s' → clip '%s'",
      (aiState, expectedClip) => {
        sys.updateNPCAnimation(mesh, aiState, false, false, false);
        expect(sys.getActiveClip(mesh.name)).toBe(expectedClip);
      },
    );
  });

  // ── playVictory ────────────────────────────────────────────────────────────

  describe("playVictory", () => {
    it("sets active clip to 'victory'", () => {
      sys.playVictory(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("victory");
    });

    it("calls beginAnimation with loop=true", () => {
      sys.playVictory(mesh);
      const call = scene.lastCallFor(mesh);
      expect(call).not.toBeNull();
      expect(call!.loop).toBe(true);
    });

    it("is a no-op if already celebrating", () => {
      sys.playVictory(mesh);
      const callCount = scene._calls.length;
      sys.playVictory(mesh);
      expect(scene._calls.length).toBe(callCount);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playVictory(mesh);
      expect(scene._calls.length).toBe(callCount);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("transitions from idle to victory", () => {
      sys.playIdle(mesh);
      sys.playVictory(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("victory");
    });
  });

  // ── playSpawn ──────────────────────────────────────────────────────────────

  describe("playSpawn", () => {
    it("sets active clip to 'spawn'", () => {
      sys.playSpawn(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("spawn");
    });

    it("calls beginAnimation with loop=false", () => {
      sys.playSpawn(mesh);
      const call = scene.lastCallFor(mesh);
      expect(call).not.toBeNull();
      expect(call!.loop).toBe(false);
    });

    it("is a no-op on dead mesh", () => {
      sys.playDeath(mesh);
      const callCount = scene._calls.length;
      sys.playSpawn(mesh);
      expect(scene._calls.length).toBe(callCount);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("calls onComplete callback after animation finishes", () => {
      const cb = vi.fn();
      sys.playSpawn(mesh, cb);
      scene.triggerComplete(mesh);
      expect(cb).toHaveBeenCalledOnce();
    });

    it("resets scaling to (1,1,1) on completion", () => {
      sys.playSpawn(mesh);
      mesh.scaling.set(0, 1.2, 0);
      scene.triggerComplete(mesh);
      expect(mesh.scaling.x).toBe(1);
      expect(mesh.scaling.y).toBe(1);
      expect(mesh.scaling.z).toBe(1);
    });

    it("clears active clip on completion", () => {
      sys.playSpawn(mesh);
      scene.triggerComplete(mesh);
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
    });

    it("does not clear active if a new clip started before completion", () => {
      sys.playSpawn(mesh);
      sys.playIdle(mesh);
      scene.triggerComplete(mesh);
      expect(sys.getActiveClip(mesh.name)).toBe("idle");
    });

    it("assigns three animation tracks to the mesh", () => {
      sys.playSpawn(mesh);
      expect(mesh.animations).toHaveLength(3);
    });
  });

  // ── updatePetAnimation ────────────────────────────────────────────────────

  describe("updatePetAnimation", () => {
    it("plays death when isDead=true", () => {
      sys.updatePetAnimation(mesh, false, false, true);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("does not re-trigger death when already dead", () => {
      sys.updatePetAnimation(mesh, false, false, true);
      const callCount = scene._calls.length;
      sys.updatePetAnimation(mesh, false, false, true);
      expect(scene._calls.length).toBe(callCount);
    });

    it("plays run when isSprinting=true", () => {
      sys.updatePetAnimation(mesh, false, true, false);
      expect(sys.getActiveClip(mesh.name)).toBe("run");
    });

    it("does not re-trigger run when already running", () => {
      sys.updatePetAnimation(mesh, false, true, false);
      const callCount = scene._calls.length;
      sys.updatePetAnimation(mesh, false, true, false);
      expect(scene._calls.length).toBe(callCount);
    });

    it("plays walk when isMoving=true", () => {
      sys.updatePetAnimation(mesh, true, false, false);
      expect(sys.getActiveClip(mesh.name)).toBe("walk");
    });

    it("does not re-trigger walk when already walking", () => {
      sys.updatePetAnimation(mesh, true, false, false);
      const callCount = scene._calls.length;
      sys.updatePetAnimation(mesh, true, false, false);
      expect(scene._calls.length).toBe(callCount);
    });

    it("plays idle when not moving", () => {
      sys.updatePetAnimation(mesh, false, false, false);
      expect(sys.getActiveClip(mesh.name)).toBe("idle");
    });

    it("does not re-trigger idle when already idling", () => {
      sys.updatePetAnimation(mesh, false, false, false);
      const callCount = scene._calls.length;
      sys.updatePetAnimation(mesh, false, false, false);
      expect(scene._calls.length).toBe(callCount);
    });

    it("isDead takes priority over isSprinting and isMoving", () => {
      sys.updatePetAnimation(mesh, true, true, true);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("isSprinting takes priority over isMoving", () => {
      sys.updatePetAnimation(mesh, true, true, false);
      expect(sys.getActiveClip(mesh.name)).toBe("run");
    });
  });

  // ── getSnapshot / restoreSnapshot ─────────────────────────────────────────

  describe("getSnapshot / restoreSnapshot", () => {
    it("getSnapshot returns empty object when no clips are active", () => {
      expect(sys.getSnapshot()).toEqual({});
    });

    it("getSnapshot captures active clips for all tracked meshes", () => {
      const m2 = makeMesh("npc_2");
      sys.playIdle(mesh);
      sys.playRun(m2);
      const snap = sys.getSnapshot();
      expect(snap[mesh.name]).toBe("idle");
      expect(snap[m2.name]).toBe("run");
    });

    it("getSnapshot returns a plain object copy — mutating it does not affect system state", () => {
      sys.playIdle(mesh);
      const snap = sys.getSnapshot();
      snap[mesh.name] = "run" as AnimationClip;
      expect(sys.getActiveClip(mesh.name)).toBe("idle");
    });

    it("restoreSnapshot replaces active-clip state", () => {
      sys.playIdle(mesh);
      const snap: Record<string, AnimationClip> = { [mesh.name]: "walk" };
      sys.restoreSnapshot(snap);
      expect(sys.getActiveClip(mesh.name)).toBe("walk");
    });

    it("restoreSnapshot clears meshes not present in snapshot", () => {
      sys.playIdle(mesh);
      sys.restoreSnapshot({});
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
    });

    it("restoreSnapshot preserves death state so isDeadClip returns true", () => {
      const snap: Record<string, AnimationClip> = { [mesh.name]: "death" };
      sys.restoreSnapshot(snap);
      expect(sys.isDeadClip(mesh.name)).toBe(true);
    });

    it("restoreSnapshot ignores entries with invalid clip names", () => {
      const snap = { [mesh.name]: "invalid_clip" } as Record<string, AnimationClip>;
      sys.restoreSnapshot(snap);
      expect(sys.getActiveClip(mesh.name)).toBeUndefined();
    });

    it("round-trip: getSnapshot then restoreSnapshot reproduces original state", () => {
      const m2 = makeMesh("npc_2");
      sys.playAlert(mesh);
      sys.playDeath(m2);
      const snap = sys.getSnapshot();
      const fresh = new AnimationSystem(scene as any);
      fresh.restoreSnapshot(snap);
      expect(fresh.getActiveClip(mesh.name)).toBe("alert");
      expect(fresh.isDeadClip(m2.name)).toBe(true);
    });
  });
});
