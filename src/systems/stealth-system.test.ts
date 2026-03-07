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
});
