import { describe, it, expect, vi } from "vitest";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Kernel } from "../../core/kernel";
import { AIState, type NPC } from "../../entities/npc";
import type { CrimeSystem } from "../../systems/crime-system";
import type { PersuasionSystem } from "../../systems/persuasion-system";
import { FeedbackKey, ModalKey, PlayerKey, PurseKey, SkillsKey } from "../services";
import { ArrestFeature, ArrestKey, LawKey } from "./arrest-feature";

type Outcome = "critical_success" | "success" | "failure" | "critical_failure";

function setup(opts: { gold?: number; bounty?: number; outcome?: Outcome; speech?: number } = {}) {
  const k = new Kernel();
  const notes: string[] = [];
  const xp: number[] = [];
  let gold = opts.gold ?? 1000;
  const bounties = new Map<string, number>([["town", opts.bounty ?? 100]]);
  const crime = {
    onGuardChallenge: null as null | ((g: NPC, f: string, b: number) => void),
    setBounty: (f: string, v: number) => { bounties.set(f, Math.max(0, Math.round(v))); return bounties.get(f)!; },
    adjustBounty: (f: string, d: number) => crime.setBounty(f, (bounties.get(f) ?? 0) + d),
    clearBounty: (f: string) => { bounties.set(f, 0); return 0; },
    payBounty: (f: string, g: number) => { const b = bounties.get(f) ?? 0; if (b <= 0 || g < b) return 0; bounties.set(f, 0); return b; },
    crimes: [] as string[],
    commitCrime: (type: string, faction: string) => { crime.crimes.push(`${type}:${faction}`); },
  };
  const persuasion = {
    canAttemptPersuasion: () => (opts.speech ?? 30) >= 10,
    getDisposition: () => 50,
    attemptPersuasionAction: vi.fn(() => ({ outcome: opts.outcome ?? "success", newDisposition: 55 })),
  };
  const jail = vi.fn(() => ({ message: "You served your time." }));
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(LawKey, {
    crime: crime as unknown as CrimeSystem, persuasion: persuasion as unknown as PersuasionSystem,
    serveJail: jail, addInfamy: vi.fn(), now: () => 600,
  });
  k.services.provide(PurseKey, { gold: () => gold, spend: (n) => { if (gold < n) return false; gold -= n; return true; } });
  k.services.provide(SkillsKey, { level: () => opts.speech ?? 30, gainXP: (_id, n) => { xp.push(n); } });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  k.services.provide(PlayerKey, { position: () => ({ x: 1, y: 2, z: 3 }), level: () => 1 });
  const committed: number[] = [];
  k.events.on("crime:committed", ({ bounty }) => committed.push(bounty));
  k.install(new ArrestFeature());
  const guard = { key: "Guard Captain", displayName: "Guard Captain", mesh: { name: "Guard Captain" }, isAggressive: false, provoked: false, aiState: AIState.IDLE, lastKnownPlayerPos: null } as unknown as NPC;
  const stop = () => crime.onGuardChallenge!(guard, "town", bounties.get("town")!);
  return { k, notes, xp, modal, jail, guard, stop, committed, crime, panel: k.services.get(ArrestKey).panel,
    gold: () => gold, bounty: () => bounties.get("town")!, persuasion };
}

describe("ArrestFeature (headless, through the kernel)", () => {
  it("a guard stops the player; paying the fine clears the bounty", () => {
    const t = setup({ gold: 500, bounty: 120 });
    t.stop();
    expect(t.panel.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
    expect(t.committed).toEqual([120]);
    t.panel.onResolve!("pay_fine");
    expect(t.gold()).toBe(380);
    expect(t.bounty()).toBe(0);
    expect(t.panel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
    t.k.uninstall("arrest");
  });

  it("too poor to pay: the panel stays, with the reason", () => {
    const t = setup({ gold: 10, bounty: 120 });
    t.stop();
    t.panel.onResolve!("pay_fine");
    expect(t.panel.isVisible).toBe(true);
    expect(t.bounty()).toBe(120);
    t.k.uninstall("arrest");
  });

  it("Escape doesn't walk away from the guard, nor resist: the panel stays and asks again", () => {
    const t = setup({ bounty: 100 });
    t.stop();
    t.k.services.get(ArrestKey).escape();
    expect(t.panel.isVisible).toBe(true);
    expect(t.bounty()).toBe(100);
    t.k.uninstall("arrest");
  });

  it("resisting raises the bounty and the guard attacks", () => {
    const t = setup({ bounty: 100 });
    t.stop();
    t.panel.onResolve!("resist_arrest");
    expect(t.bounty()).toBe(125);
    expect(t.guard.aiState).toBe(AIState.CHASE);
    expect(t.guard.lastKnownPlayerPos).toEqual(new Vector3(1, 2, 3));
    expect(t.notes.at(-1)).toBe("Guard Captain attacks!");
    t.k.uninstall("arrest");
  });

  it("persuasion: a success halves the bounty; a big bounty takes threats", () => {
    const t = setup({ bounty: 400, outcome: "success" });
    t.stop();
    t.panel.onResolve!("persuade");
    expect(t.bounty()).toBe(200);
    expect(t.panel.isVisible, "still open with the reduced bounty").toBe(true);
    expect(t.persuasion.attemptPersuasionAction).toHaveBeenCalledWith("Guard Captain", 30, "coerce");
    expect(t.xp).toEqual([12]);
    t.k.uninstall("arrest");
  });

  it("jail serves the time and closes", () => {
    const t = setup({ bounty: 60 });
    t.stop();
    t.panel.onResolve!("go_to_jail");
    expect(t.jail).toHaveBeenCalledWith(60, "town");
    expect(t.notes.at(-1)).toBe("You served your time.");
    expect(t.panel.isVisible).toBe(false);
    t.k.uninstall("arrest");
  });

  it("killing a settler is murder; striking one is assault, booked once per combo", () => {
    const t = setup();
    t.k.events.emit("player:kill", { npcId: "Bandit_1", npcName: "Bandit", xp: 5, civilian: false });
    t.k.events.emit("player:kill", { npcId: "Farmer_1", npcName: "Farmer", xp: 5, civilian: true, factionId: "town" });
    for (let i = 0; i < 5; i++) t.k.events.emit("player:assault", { npcId: "Smith_1", factionId: "town" });
    expect(t.crime.crimes).toEqual(["murder:town", "assault:town"]);
    t.k.uninstall("arrest");
  });
});
