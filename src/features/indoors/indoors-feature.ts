/**
 * NPCs going indoors: villagers who reach their door at bedtime, and
 * townsfolk sheltering from a raid, are hidden "inside" (mesh disabled,
 * collisions and gravity off) until they're needed again.
 *
 * Other features keep someone inside with a named hold
 * (`hold(npc, "raid")`); everyone else comes back out as soon as their
 * schedule stops saying "sleep".
 *
 * Inputs:   events `npc:atBed`, `npc:released`; services schedules, buildings.
 * Outputs:  the `indoors` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { NPC } from "../../entities/npc";
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { BuildingsKey, ScheduleKey, ownTransient, IndoorsKey } from "../services";

/** A sleeper this close (m) to a building at its bed spot goes inside. */
export const DOOR_REACH = 2.5;

export interface IndoorsService {
  /** Hide an NPC inside now. */
  send(npc: NPC): void;
  isIndoors(npc: NPC): boolean;
  /** Keep an NPC inside regardless of its schedule until `releaseHolds(holder)`. */
  hold(npc: NPC, holder: string): void;
  /** Drop every hold by `holder` (those NPCs come out when their schedule allows). */
  releaseHolds(holder: string): void;
}

export { IndoorsKey };

interface Inside {
  membership: number;
  collide: number;
  holds: Set<string>;
}

export class IndoorsFeature implements Feature {
  public readonly id = "indoors";
  private readonly _inside = new Map<NPC, Inside>();

  public install(ctx: FeatureContext): void {
    ownTransient(ctx, "who is inside (the wake check lets out anyone whose schedule no longer says sleep)");
    const s = ctx.kernel.services;

    ctx.provide(IndoorsKey, {
      send: (npc) => this._send(npc),
      isIndoors: (npc) => this._inside.has(npc),
      hold: (npc, holder) => {
        if (!this._inside.has(npc)) this._send(npc);
        this._inside.get(npc)?.holds.add(holder);
      },
      releaseHolds: (holder) => {
        for (const e of this._inside.values()) e.holds.delete(holder);
      },
    });

    // Villagers who reach their door at bedtime go inside until morning.
    ctx.on("npc:atBed", ({ npc }) => {
      if (this._inside.has(npc)) return;
      const p = npc.mesh.position;
      if (s.get(BuildingsKey).nearBuilding(p.x, p.z, DOOR_REACH)) this._send(npc);
    });

    ctx.on("npc:released", ({ npcName }) => {
      for (const npc of this._inside.keys()) if (npc.key === npcName) this._inside.delete(npc);
    });

    // Out again once nothing holds them and their schedule no longer says
    // sleep (also covers NPCs that went in without a sleep/wake transition).
    ctx.system({
      id: "indoors.wake",
      phase: "sim",
      update: () => {
        const schedules = s.get(ScheduleKey);
        for (const [npc, e] of this._inside) {
          if (e.holds.size > 0) continue;
          if (schedules.behaviorOf(npc) !== "sleep") this._bring(npc);
        }
      },
    });

    // Uninstalling lets everyone out.
    ctx.scope.add(() => {
      for (const npc of [...this._inside.keys()]) this._bring(npc);
    });
  }

  private _send(npc: NPC): void {
    if (this._inside.has(npc)) return;
    const body = npc.physicsAggregate?.body;
    const shape = npc.physicsAggregate?.shape;
    this._inside.set(npc, {
      membership: shape?.filterMembershipMask ?? ~0,
      collide: shape?.filterCollideMask ?? ~0,
      holds: new Set(),
    });
    npc.mesh.setEnabled(false);
    if (body) {
      body.setLinearVelocity(Vector3.Zero());
      body.setGravityFactor(0);
    }
    if (shape) {
      shape.filterMembershipMask = 0;
      shape.filterCollideMask = 0;
    }
  }

  private _bring(npc: NPC): void {
    const e = this._inside.get(npc);
    if (!e) return;
    this._inside.delete(npc);
    if (npc.mesh.isDisposed()) return;
    npc.mesh.setEnabled(true);
    const body = npc.physicsAggregate?.body;
    const shape = npc.physicsAggregate?.shape;
    if (body) body.setGravityFactor(1);
    if (shape) {
      shape.filterMembershipMask = e.membership;
      shape.filterCollideMask = e.collide;
    }
  }
}
