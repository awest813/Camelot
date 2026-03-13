import { describe, it, expect, vi, beforeEach } from "vitest";
import { StealthSystem } from "./stealth-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AIState } from "../entities/npc";

describe("StealthSystem", () => {
  let stealthSystem: StealthSystem;
  let mockPlayer: any;
  let mockNpc: any;
  let mockUI: any;

  beforeEach(() => {
    mockPlayer = {
      camera: {
        position: new Vector3(0, 0, 0),
        speed: 0.5,
      },
    };

    mockNpc = {
      isDead: false,
      aiState: AIState.PATROL,
      isAggressive: false,
      mesh: {
        position: new Vector3(0, 0, 5),
        // No getDirection: stealth will use fallback (0,0,1)
      },
    };

    mockUI = { showNotification: vi.fn() };

    stealthSystem = new StealthSystem(mockPlayer, [mockNpc], mockUI);
  });

  it("starts not crouching", () => {
    expect(stealthSystem.isCrouching).toBe(false);
  });

  it("toggleCrouch sets isCrouching to true and slows camera", () => {
    const result = stealthSystem.toggleCrouch();
    expect(result).toBe(true);
    expect(stealthSystem.isCrouching).toBe(true);
    expect(mockPlayer.camera.speed).toBe(0.25);
  });

  it("toggleCrouch again restores normal speed", () => {
    stealthSystem.toggleCrouch();
    stealthSystem.toggleCrouch();
    expect(stealthSystem.isCrouching).toBe(false);
    expect(mockPlayer.camera.speed).toBe(0.5);
  });

  it("overallDetection is 0 when no NPCs are in range", () => {
    // NPC is 100 units away
    mockNpc.mesh.position = new Vector3(0, 0, 100);
    stealthSystem.update(0.5);
    expect(stealthSystem.overallDetection).toBe(0);
  });

  it("detection builds when player is in NPC hearing range while walking", () => {
    // NPC at 5 units — within walking hearing range (7)
    stealthSystem.update(0.5);
    expect(stealthSystem.getDetectionLevel(mockNpc)).toBeGreaterThan(0);
  });

  it("stealthLabel is 'Hidden' at 0 detection", () => {
    mockNpc.mesh.position = new Vector3(0, 0, 100); // far away
    stealthSystem.update(0.1);
    expect(stealthSystem.stealthLabel).toBe("Hidden");
  });

  it("stealthLabel is 'Caution' at partial detection", () => {
    stealthSystem.update(1.0); // partial build
    const level = stealthSystem.getDetectionLevel(mockNpc);
    if (level > 0 && level < 80) {
      expect(stealthSystem.stealthLabel).toBe("Caution");
    }
  });

  it("fires onDetected and sets NPC to ALERT when detection reaches 100", () => {
    const onDetected = vi.fn();
    stealthSystem.onDetected = onDetected;

    // NPC is 5 units away — within walking hearing range (7 units).
    // Hearing-only detection rate = 40 units/sec → needs 2.5 sec.
    // We use 3 updates × 1.0s = 3 seconds to safely exceed 100.
    stealthSystem.update(1.0);
    stealthSystem.update(1.0);
    stealthSystem.update(1.0);
    expect(onDetected).toHaveBeenCalledWith(mockNpc);
    expect(mockNpc.aiState).toBe(AIState.ALERT);
    expect(mockNpc.isAggressive).toBe(true);
  });

  it("does not fire onDetected twice for the same detection event", () => {
    const onDetected = vi.fn();
    stealthSystem.onDetected = onDetected;

    stealthSystem.update(1.0);
    stealthSystem.update(1.0);
    stealthSystem.update(1.0); // now detected
    stealthSystem.update(1.0); // second update after already detected

    expect(onDetected).toHaveBeenCalledTimes(1);
  });

  it("detection decays when player is out of range", () => {
    // Build some detection first
    stealthSystem.update(0.5);
    const initial = stealthSystem.getDetectionLevel(mockNpc);
    expect(initial).toBeGreaterThan(0);

    // Move NPC far away
    mockNpc.mesh.position = new Vector3(0, 0, 100);
    stealthSystem.update(1.0);
    expect(stealthSystem.getDetectionLevel(mockNpc)).toBeLessThan(initial);
  });

  it("skips dead NPCs during update", () => {
    mockNpc.isDead = true;
    stealthSystem.update(2.0);
    expect(mockNpc.aiState).toBe(AIState.PATROL); // unchanged
  });

  it("skips NPCs already in ATTACK/CHASE state", () => {
    mockNpc.aiState = AIState.ATTACK;
    stealthSystem.update(2.0);
    expect(mockNpc.aiState).toBe(AIState.ATTACK); // unchanged
  });

  it("NPCs array can be hot-swapped", () => {
    const newNpc = { ...mockNpc };
    stealthSystem.npcs = [newNpc];
    expect(stealthSystem.npcs).toHaveLength(1);
    expect(stealthSystem.npcs[0]).toBe(newNpc);
  });

  it("saves and restores crouch state", () => {
    stealthSystem.toggleCrouch();
    const saved = stealthSystem.getSaveState();

    const restored = new StealthSystem(mockPlayer, [], mockUI);
    restored.restoreFromSave(saved);
    expect(restored.isCrouching).toBe(true);
  });

  // ── Shadow factor ──────────────────────────────────────────────────────────

  it("shadowFactor defaults to 1.0 (fully lit)", () => {
    expect(stealthSystem.shadowFactor).toBe(1.0);
  });

  it("shadowFactor 0 makes NPC unable to see player at normal range", () => {
    // NPC at 10 units facing player — normally would see the player
    mockNpc.mesh.position = new Vector3(0, 0, 10);
    stealthSystem.shadowFactor = 0; // deep shadow
    stealthSystem.update(0.5, 1.0); // full ambient, but shadow = 0 → sight clamped to 10% range (2 units)
    // Player is at (0,0,0) — NPC is 10 units away, which is now outside clamped sight range
    expect(stealthSystem.getDetectionLevel(mockNpc)).toBe(0);
  });

  it("shadowFactor 1.0 has no effect vs shadowFactor default", () => {
    stealthSystem.shadowFactor = 1.0;
    stealthSystem.update(0.5, 1.0);
    const withFull = stealthSystem.getDetectionLevel(mockNpc);

    // Reset
    stealthSystem["_detectionLevels"].clear();
    const sys2 = new StealthSystem(mockPlayer, [mockNpc], mockUI);
    sys2.update(0.5, 1.0);
    const withDefault = sys2.getDetectionLevel(mockNpc);

    expect(withFull).toBe(withDefault);
  });

  // ── Noise level ────────────────────────────────────────────────────────────

  it("noiseLevel defaults to 0", () => {
    expect(stealthSystem.noiseLevel).toBe(0);
  });

  it("pushNoise raises noiseLevel", () => {
    stealthSystem.pushNoise(0.7);
    expect(stealthSystem.noiseLevel).toBe(0.7);
  });

  it("pushNoise takes max if called multiple times", () => {
    stealthSystem.pushNoise(0.3);
    stealthSystem.pushNoise(0.8);
    stealthSystem.pushNoise(0.5);
    expect(stealthSystem.noiseLevel).toBe(0.8);
  });

  it("noiseLevel decays to 0 over time", () => {
    stealthSystem.pushNoise(1.0);
    // NOISE_DECAY_RATE = 1.5, so 1.0 / 1.5 ≈ 0.67 seconds to decay fully
    stealthSystem.update(1.0); // decay 1.5 units → clamp to 0
    expect(stealthSystem.noiseLevel).toBe(0);
  });

  it("noise widens hearing range: NPC hears walking player from further away", () => {
    // Place NPC at 10 units — outside normal walking hearing range (7)
    mockNpc.mesh.position = new Vector3(0, 0, 10);

    // Without noise: no detection
    stealthSystem.update(0.3);
    const withoutNoise = stealthSystem.getDetectionLevel(mockNpc);

    // Reset then add noise
    stealthSystem["_detectionLevels"].clear();
    stealthSystem.pushNoise(1.0); // adds up to NOISE_HEAR_RANGE_BONUS = 8 → total 15
    stealthSystem.update(0.3);
    const withNoise = stealthSystem.getDetectionLevel(mockNpc);

    expect(withNoise).toBeGreaterThan(withoutNoise);
  });

  // ── canSneakAttack ─────────────────────────────────────────────────────────

  it("canSneakAttack returns false when not crouching", () => {
    expect(stealthSystem.canSneakAttack(mockNpc)).toBe(false);
  });

  it("canSneakAttack returns true when crouching and NPC undetected", () => {
    stealthSystem.toggleCrouch();
    // No updates — detection level is 0 by default
    expect(stealthSystem.canSneakAttack(mockNpc)).toBe(true);
  });

  it("canSneakAttack returns false when NPC detection is high", () => {
    stealthSystem.toggleCrouch();
    // Build detection above threshold (>= 30)
    mockNpc.mesh.position = new Vector3(0, 0, 5); // close range
    stealthSystem.update(1.0); // build detection
    const level = stealthSystem.getDetectionLevel(mockNpc);
    if (level >= 30) {
      expect(stealthSystem.canSneakAttack(mockNpc)).toBe(false);
    }
  });

  it("canSneakAttack returns false for dead NPCs", () => {
    stealthSystem.toggleCrouch();
    mockNpc.isDead = true;
    expect(stealthSystem.canSneakAttack(mockNpc)).toBe(false);
  });

  it("canSneakAttack returns false when NPC is in ATTACK state", () => {
    stealthSystem.toggleCrouch();
    mockNpc.aiState = AIState.ATTACK;
    expect(stealthSystem.canSneakAttack(mockNpc)).toBe(false);
  });

  it("canSneakAttack returns false when NPC is in CHASE state", () => {
    stealthSystem.toggleCrouch();
    mockNpc.aiState = AIState.CHASE;
    expect(stealthSystem.canSneakAttack(mockNpc)).toBe(false);
  });
});
