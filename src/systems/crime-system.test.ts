import { describe, it, expect, vi, beforeEach } from "vitest";
import { CrimeSystem } from "./crime-system";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AIState } from "../entities/npc";

describe("CrimeSystem", () => {
  let crimeSystem: CrimeSystem;
  let mockPlayer: any;
  let mockNpc: any;
  let mockUI: any;

  beforeEach(() => {
    mockPlayer = {
      camera: { position: new Vector3(0, 0, 0) },
    };

    mockNpc = {
      isDead: false,
      aiState: AIState.PATROL,
      mesh: {
        name: "GuardNPC",
        position: new Vector3(0, 0, 5),
      },
    };

    mockUI = { showNotification: vi.fn() };

    crimeSystem = new CrimeSystem(mockPlayer, [mockNpc], mockUI);
  });

  it("starts with zero bounty", () => {
    expect(crimeSystem.getTotalBounty()).toBe(0);
    expect(crimeSystem.getBounty("town_guard")).toBe(0);
  });

  it("commitCrime adds bounty when witnessed", () => {
    const result = crimeSystem.commitCrime("theft", "town_guard", 480);
    expect(result).toBe(25); // theft = 25g
    expect(crimeSystem.getBounty("town_guard")).toBe(25);
    expect(mockUI.showNotification).toHaveBeenCalled();
  });

  it("commitCrime returns 0 when no witnesses are present", () => {
    // NPC is far away (> 15 units)
    mockNpc.mesh.position = new Vector3(0, 0, 50);
    const result = crimeSystem.commitCrime("theft", "town_guard", 480);
    expect(result).toBe(0);
    expect(crimeSystem.getBounty("town_guard")).toBe(0);
  });

  it("accumulates multiple crimes", () => {
    crimeSystem.commitCrime("theft", "town_guard", 480);
    crimeSystem.commitCrime("assault", "town_guard", 490);
    expect(crimeSystem.getBounty("town_guard")).toBe(25 + 40);
    expect(crimeSystem.getTotalBounty()).toBe(65);
  });

  it("murder adds 1000g bounty", () => {
    crimeSystem.commitCrime("murder", "town_guard", 500);
    expect(crimeSystem.getBounty("town_guard")).toBe(1000);
  });

  it("payBounty clears the faction bounty", () => {
    crimeSystem.commitCrime("theft", "town_guard", 480);
    const paid = crimeSystem.payBounty("town_guard", 100);
    expect(paid).toBe(25);
    expect(crimeSystem.getBounty("town_guard")).toBe(0);
    expect(mockUI.showNotification).toHaveBeenCalledTimes(2); // once for crime, once for payment
  });

  it("payBounty returns 0 when player can't afford it", () => {
    crimeSystem.commitCrime("theft", "town_guard", 480);
    const paid = crimeSystem.payBounty("town_guard", 10); // can't afford
    expect(paid).toBe(0);
    expect(crimeSystem.getBounty("town_guard")).toBe(25);
  });

  it("payBounty returns 0 when bounty is 0", () => {
    const paid = crimeSystem.payBounty("town_guard", 100);
    expect(paid).toBe(0);
  });

  it("clearAllBounties wipes all factions", () => {
    crimeSystem.commitCrime("theft", "town_guard", 480);
    crimeSystem.commitCrime("murder", "mage_guild", 480);
    crimeSystem.clearAllBounties();
    expect(crimeSystem.getTotalBounty()).toBe(0);
  });

  it("update triggers onGuardChallenge when player is near guard with bounty", () => {
    const spy = vi.fn();
    crimeSystem.onGuardChallenge = spy;
    crimeSystem.commitCrime("theft", "town_guard", 480);
    crimeSystem.update(1);
    expect(spy).toHaveBeenCalledWith(mockNpc, "town_guard", 25);
  });

  it("update does not challenge when bounty is zero", () => {
    const spy = vi.fn();
    crimeSystem.onGuardChallenge = spy;
    crimeSystem.update(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("update does not challenge when guard is in ATTACK state", () => {
    const spy = vi.fn();
    crimeSystem.onGuardChallenge = spy;
    crimeSystem.commitCrime("theft", "town_guard", 480);
    mockNpc.aiState = AIState.ATTACK;
    crimeSystem.update(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("update respects challenge cooldown", () => {
    const spy = vi.fn();
    crimeSystem.onGuardChallenge = spy;
    crimeSystem.commitCrime("theft", "town_guard", 480);
    crimeSystem.update(1);   // first challenge
    crimeSystem.update(1);   // within cooldown window
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("commitCrime uses explicit witnesses when provided", () => {
    const farNpc = { isDead: false, mesh: { name: "FarNPC", position: new Vector3(0, 0, 100) } };
    // explicit witness even though far away
    const result = crimeSystem.commitCrime("theft", "town_guard", 480, [farNpc as any]);
    expect(result).toBe(25);
  });

  it("saves and restores state", () => {
    crimeSystem.commitCrime("theft", "town_guard", 480);
    const saved = crimeSystem.getSaveState();

    const restored = new CrimeSystem(mockPlayer, [mockNpc], mockUI);
    restored.restoreFromSave(saved);
    expect(restored.getBounty("town_guard")).toBe(25);
  });
});
