/**
 * Arrest as a kernel feature: a guard stops a wanted player, and the player
 * pays the fine, goes to jail, talks their way out, or resists.
 *
 * Inputs:   services law, purse, skills, feedback, modal, player; the crime
 *           system's guard challenge; events `player:kill` and
 *           `player:assault` (crimes against peaceful settlers).
 * Outputs:  the `arrest` service; `crime:committed` and
 *           `disposition:changed` events.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { simClock } from "../../core/sim-clock";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { GuardEncounterUI, type GuardEncounterAction } from "../../ui/guard-encounter-ui";
import { AIState, type NPC } from "../../entities/npc";
import type { CrimeSystem } from "../../systems/crime-system";
import type { PersuasionSystem } from "../../systems/persuasion-system";
import { FeedbackKey, ModalKey, PlayerKey, PurseKey, SkillsKey, declareStateless } from "../services";

/** The law the arrest acts on. */
export interface LawService {
  readonly crime: CrimeSystem;
  readonly persuasion: PersuasionSystem;
  /** Serve time for a bounty: the clock moves on and skills slip. */
  serveJail(bounty: number, factionId: string): { message: string };
  addInfamy(amount: number): void;
  /** Game time (minutes) for crime records. */
  now(): number;
}

const ASSAULT_DEBOUNCE_MS = 3000;

export interface ArrestService {
  readonly panel: GuardEncounterUI;
  /** Escape: refusing to answer counts as resisting. */
  resist(): void;
}

export const LawKey = createServiceKey<LawService>("law");
export const ArrestKey = createServiceKey<ArrestService>("arrest");

interface Challenge { guard: NPC; factionId: string; bounty: number }

export class ArrestFeature implements Feature {
  public readonly id = "arrest";
  public readonly panel = new GuardEncounterUI();
  private _challenge: Challenge | null = null;
  private _s: ServiceRegistry | null = null;

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "bounties and jail time belong to the crime and jail systems, which the save system saves");
    const s = ctx.kernel.services;
    this._s = s;
    const crime = s.get(LawKey).crime;

    crime.onGuardChallenge = (guard, factionId, bounty) => {
      this._challenge = { guard, factionId, bounty };
      this._show();
      s.get(ModalKey).suspendGameplay();
      ctx.kernel.events.emit("crime:committed", { crimeType: "challenge", factionId, bounty });
    };
    this.panel.onResolve = (action) => this._resolve(action, ctx);

    // Killing or striking a peaceful settler is a crime; witnesses post a
    // bounty and nearby guards come for the player.  Assault is booked at
    // most once per 3 s, so a combo doesn't stack five bounties.
    let lastAssault = Number.NEGATIVE_INFINITY;
    ctx.on("player:kill", ({ civilian, factionId }) => {
      if (civilian) crime.commitCrime("murder", factionId ?? "village_guard", s.get(LawKey).now());
    });
    ctx.on("player:assault", ({ factionId }) => {
      const now = simClock.now();
      if (now - lastAssault < ASSAULT_DEBOUNCE_MS) return;
      lastAssault = now;
      crime.commitCrime("assault", factionId, s.get(LawKey).now());
    });

    ctx.provide(ArrestKey, {
      panel: this.panel,
      resist: () => { if (this.panel.isVisible) this._resolve("resist_arrest", ctx); },
    });

    ctx.scope.add(() => {
      crime.onGuardChallenge = null;
      this.panel.onResolve = null;
      if (this.panel.isVisible) this.panel.close();
      this._challenge = null;
      this._s = null;
    });
  }

  private _speech(): number {
    return this._s?.get(SkillsKey).level("speechcraft") ?? 0;
  }

  /** (Re)draw the panel for the current challenge, with an optional status line. */
  private _show(status?: string, isError = false): void {
    const c = this._challenge, s = this._s;
    if (!c || !s) return;
    this.panel.open({
      guardName: c.guard.key,
      factionId: c.factionId,
      bounty: c.bounty,
      playerGold: s.get(PurseKey).gold(),
      canPersuade: s.get(LawKey).persuasion.canAttemptPersuasion(c.guard.key, this._speech()),
    });
    if (status) this.panel.showStatus(status, isError);
  }

  private _close(): void {
    this.panel.close();
    this._challenge = null;
    this._s?.get(ModalKey).restoreGameplay();
  }

  private _attack(guard: NPC): void {
    const s = this._s!;
    const p = s.get(PlayerKey).position();
    guard.isAggressive = true;
    guard.provoked = true;
    guard.aiState = AIState.CHASE;
    guard.lastKnownPlayerPos = new Vector3(p.x, p.y ?? 0, p.z);
    s.get(FeedbackKey).notify(`${guard.displayName} attacks!`, 2500);
  }

  private _resolve(action: GuardEncounterAction, ctx: FeatureContext): void {
    const c = this._challenge, s = this._s;
    if (!c || !s) return;
    const law = s.get(LawKey);
    const feedback = s.get(FeedbackKey);
    const skills = s.get(SkillsKey);
    const speechXp = (n: number) => skills.gainXP("speechcraft", n);
    const name = c.guard.key;

    switch (action) {
      case "pay_fine": {
        const purse = s.get(PurseKey);
        const paid = law.crime.payBounty(c.factionId, purse.gold());
        if (paid <= 0 || !purse.spend(paid)) {
          this._show("You do not have enough gold to pay the fine.", true);
          return;
        }
        feedback.notify(`Fine paid (${paid}g). You are free to go.`, 2500);
        speechXp(4);
        feedback.markDirty();
        this._close();
        return;
      }
      case "go_to_jail": {
        const result = law.serveJail(c.bounty, c.factionId);
        law.addInfamy(Math.ceil(c.bounty / 12));
        feedback.notify(result.message, 4200);
        feedback.markDirty();
        this._close();
        return;
      }
      case "resist_arrest": {
        const surcharge = Math.max(10, Math.ceil(c.bounty * 0.25));
        c.bounty = law.crime.adjustBounty(c.factionId, surcharge);
        law.addInfamy(Math.ceil(surcharge / 5));
        this._attack(c.guard);
        feedback.markDirty();
        this._close();
        return;
      }
      case "persuade": {
        const speech = this._speech();
        if (!law.persuasion.canAttemptPersuasion(name, speech)) {
          this._show("Your Speechcraft is too low to attempt persuasion.", true);
          return;
        }
        const before = law.persuasion.getDisposition(name);
        // A big bounty takes threats; a small one, bluster.
        const result = law.persuasion.attemptPersuasionAction(name, speech, c.bounty >= 300 ? "coerce" : "boast");
        ctx.kernel.events.emit("disposition:changed", { npcId: name, oldValue: before, newValue: result.newDisposition });

        if (result.outcome === "critical_success") {
          law.crime.clearBounty(c.factionId);
          feedback.addFame(2);
          speechXp(18);
          feedback.notify(`${name} withdraws the charges.`, 2800);
          feedback.markDirty();
          this._close();
          return;
        }
        if (result.outcome === "success") {
          c.bounty = law.crime.setBounty(c.factionId, Math.floor(c.bounty * 0.5));
          speechXp(12);
          feedback.markDirty();
          if (c.bounty <= 0) {
            feedback.notify("Persuasion successful. Your bounty has been cleared.", 2800);
            this._close();
          } else {
            this._show(`Persuasion worked. Reduced bounty to ${c.bounty}g.`);
          }
          return;
        }
        if (result.outcome === "critical_failure") {
          const surcharge = Math.max(20, Math.ceil(c.bounty * 0.3));
          c.bounty = law.crime.adjustBounty(c.factionId, surcharge);
          law.addInfamy(3);
          speechXp(3);
          feedback.notify("Persuasion backfired!", 2200);
          this._attack(c.guard);
          feedback.markDirty();
          this._close();
          return;
        }
        const surcharge = Math.max(5, Math.ceil(c.bounty * 0.1));
        c.bounty = law.crime.adjustBounty(c.factionId, surcharge);
        speechXp(5);
        this._show(`Persuasion failed. Bounty increased to ${c.bounty}g.`, true);
        feedback.markDirty();
        return;
      }
    }
  }
}
