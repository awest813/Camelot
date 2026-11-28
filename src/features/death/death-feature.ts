/**
 * Death as a kernel feature.  At 0 health the player falls; four seconds
 * later they wake at the nearest discovered place, at half health and 10%
 * lighter in gold, with menus closed, effects purged and attackers calmed.
 *
 * The wait runs on the game clock, so it doesn't run out under the pause
 * menu.  Healing above 0 before then cancels it.
 *
 * The fall shows a veil over the screen (ui/death-veil.ts).
 *
 * Inputs:   services death-host, purse, feedback, fast-travel places.
 * Outputs:  the `player:died` event.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { FeedbackKey, PurseKey, ownTransient } from "../services";
import { TravelKey } from "../services";
import { DeathVeil } from "../../ui/death-veil";

/** Seconds between falling and waking. */
export const REVIVE_DELAY = 4;
/** Share of gold lost on waking. */
const GOLD_LOST = 0.1;

export interface DeathHostService {
  health(): number;
  maxHealth(): number;
  setHealth(value: number): void;
  position(): Vector3;
  /** A red flash for the fall. */
  flash(): void;
  /** End the conversation and close the menus open when the player fell. */
  closeScreens(): void;
  /** Remove every active effect (burns, freezes, buffs). */
  purgeEffects(): void;
  /** Living attackers stand down. */
  calmAttackers(): void;
  /** The player goes down (the view sags; input is held) and gets back up. */
  fall(): void;
  rise(): void;
  /** Whether a place is where the player is: this room when indoors, the open world outside. */
  sameCell?(placeId: string): boolean;
}

export const DeathHostKey = createServiceKey<DeathHostService>("death-host");

export class DeathFeature implements Feature {
  public readonly id = "death";
  public readonly veil = new DeathVeil();

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    let down = false;
    let wake = 0;
    // A load restores health: a fall in progress ends and the player gets up.
    ownTransient(ctx, "a fall in progress", () => {
      if (!down) return;
      down = false;
      this.veil.hide();
      s.get(DeathHostKey).rise();
    });

    ctx.system({
      id: "death.watch", phase: "sim", update: (dt) => {
        const host = s.get(DeathHostKey);
        const alive = host.health() > 0;
        if (!down) {
          if (alive) return;
          down = true;
          wake = REVIVE_DELAY;
          ctx.kernel.events.emit("player:died", {});
          host.flash();
          host.fall();
          this.veil.show();
          return;
        }
        if (alive) { down = false; this.veil.hide(); host.rise(); return; } // healed in time
        wake -= dt;
        if (wake > 0) return;
        down = false;
        this._wake(ctx);
      },
    });
    ctx.scope.add(() => this.veil.hide());
  }

  private _wake(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    const host = s.get(DeathHostKey);
    const feedback = s.get(FeedbackKey);
    host.setHealth(Math.round(host.maxHealth() * 0.5));
    this.veil.hide();
    host.rise();
    host.closeScreens();
    host.purgeEffects();
    host.calmAttackers();

    const pos = host.position();
    let nearest: { name: string; position: { x: number; y: number; z: number } } | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const loc of s.get(TravelKey).places.discoveredLocations) {
      // Only places here: the cave's spot is in the room's own coordinates, not the world's.
      if (host.sameCell && !host.sameCell(loc.id)) continue;
      const dx = loc.position.x - pos.x, dy = loc.position.y - pos.y, dz = loc.position.z - pos.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) { best = d; nearest = loc; }
    }
    if (nearest) pos.set(nearest.position.x, nearest.position.y, nearest.position.z);

    const purse = s.get(PurseKey);
    const lost = Math.floor(purse.gold() * GOLD_LOST);
    if (lost > 0) purse.spend(lost);
    feedback.notify(
      nearest ? `You awaken at ${nearest.name}.${lost > 0 ? ` (${lost} gold lost)` : ""}` : "You feel the will to continue...",
      4000,
    );
    feedback.markDirty();
  }
}
