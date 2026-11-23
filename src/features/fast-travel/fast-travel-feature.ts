/**
 * Fast travel as a kernel feature: known destinations, the travel menu (Y)
 * with its Recall row, travelling (time passes, an interior fades in), and
 * the chance of a travel event on arrival.
 *
 * Inputs:   services travel-host, gameplay, feedback, modal.
 * Outputs:  the `travel` service and the `fast-travel` service
 *           (discover / isDiscovered) other features use.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { Rng } from "../../core/rng/rng";
import { FastTravelSystem } from "../../systems/fast-travel-system";
import { FastTravelUI, type FastTravelOptionView } from "../../ui/fast-travel-ui";
import { FastTravelKey, FeedbackKey, GameplayKey, ModalKey, declareStateless } from "../services";

/** The menu row id for "Recall to Mark". */
export const RECALL_ID = "__recall";
/** Chance of a travel event when you arrive. */
const ARRIVAL_EVENT_CHANCE = 0.35;

/** What travelling needs from the game. */
export interface TravelHostService {
  /** Where the player stands now. */
  position(): Vector3;
  teleport(to: Vector3): void;
  inCombat(): boolean;
  sneaking(): boolean;
  encumbered(): boolean;
  isInterior(cellId: string): boolean;
  /** Whether the player is inside an interior now. */
  indoors(): boolean;
  enterCell(cellId: string, at: Vector3): void;
  /** Fade out, run `onBlack`, fade back in, then `onDone`. */
  fade(onBlack: () => void, onDone: () => void): void;
  /** Let `hours` pass (respawns, restocks, hourly events); returns the new time of day. */
  passHours(hours: number): string;
  /** Roll a travel event for an arrival at `at`; returns its message, if any. */
  arrivalEvent(at: Vector3): string | null;
  hasMark(): boolean;
  /** Recall to the mark; false when there is none. */
  recall(): boolean;
}

export interface TravelService {
  readonly places: FastTravelSystem;
  readonly menu: FastTravelUI;
  /** Y: open or close the travel menu. */
  toggleMenu(): void;
  /** Travel to a known place (or RECALL_ID). */
  travel(locationId: string): void;
}

export const TravelHostKey = createServiceKey<TravelHostService>("travel-host");
export const TravelKey = createServiceKey<TravelService>("travel");

export class FastTravelFeature implements Feature {
  public readonly id = "fast-travel";
  public readonly places = new FastTravelSystem();
  public readonly menu = new FastTravelUI();
  private _s: ServiceRegistry | null = null;
  private _rng: Rng | null = null;

  constructor() {
    this.places.discoverLocation("start_village", "Starting Village", new Vector3(0, 2, 0));
  }

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "known places and the Recall mark are saved by the save system");
    const s = ctx.kernel.services;
    this._s = s;
    this._rng = ctx.kernel.rng.stream("travel-arrival");
    this.menu.onClose = () => s.get(ModalKey).restoreGameplay();
    this.menu.onTravel = (id) => this._travel(id);

    ctx.provide(FastTravelKey, {
      isDiscovered: (id) => this.places.isDiscovered(id),
      discover: (id, name, at) => this.places.discoverLocation(id, name, at),
    });
    ctx.provide(TravelKey, {
      places: this.places,
      menu: this.menu,
      toggleMenu: () => {
        if (this.menu.isVisible) { this.menu.close(); return; }
        if (!s.get(GameplayKey).canAct()) return;
        this._openMenu();
      },
      travel: (id) => this._travel(id),
    });

    ctx.scope.add(() => {
      this.menu.onClose = null;
      this.menu.onTravel = null;
      if (this.menu.isVisible) this.menu.close();
      this._s = null;
    });
  }

  private _openMenu(): void {
    const s = this._s!;
    const host = s.get(TravelHostKey);
    const here = host.position();
    const options: FastTravelOptionView[] = this.places.discoveredLocations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      estimatedHours: this.places.estimateTravelHours(here, loc.id) ?? 1,
    }));
    if (host.hasMark()) options.push({ id: RECALL_ID, name: "✦ Recall to Mark", estimatedHours: 0, detail: "instant" });
    if (options.length === 0) {
      s.get(FeedbackKey).notify("No locations discovered yet.", 2000);
      return;
    }
    this.menu.open(options);
    s.get(ModalKey).suspendGameplay();
  }

  private _travel(locationId: string): void {
    const s = this._s;
    if (!s) return;
    const host = s.get(TravelHostKey);
    const feedback = s.get(FeedbackKey);
    const refuse = (text: string, ms = 2200) => feedback.notify(text, ms);

    if (locationId === RECALL_ID) {
      // Teleporting and its message are the recall system's own.
      if (host.inCombat()) { refuse("Cannot recall while in combat."); this.menu.close(); return; }
      if (host.sneaking()) { refuse("Cannot recall while sneaking."); this.menu.close(); return; }
      const recalled = host.recall();
      this.menu.close();
      if (!recalled) { refuse("No mark has been placed.", 2000); return; }
      feedback.markDirty();
      return;
    }

    const hours = this.places.estimateTravelHours(host.position(), locationId);
    if (hours === null) return refuse("Unknown destination.", 2000);
    if (host.inCombat()) return refuse("Cannot fast travel while in combat.");
    if (host.sneaking()) return refuse("Cannot fast travel while sneaking.");
    if (host.encumbered()) return refuse("Cannot fast travel while overencumbered.");
    const loc = this.places.getDiscoveredLocation(locationId);
    if (!loc) return refuse(`Location "${locationId}" has not been discovered.`);

    const toInterior = host.isInterior(locationId);
    const dest = new Vector3(loc.position.x, loc.position.y, loc.position.z);
    const arrive = () => {
      const time = host.passHours(hours);
      feedback.notify(`Fast travelled to ${loc.name}. (${hours.toFixed(1)}h passed) — ${time}`, 3200);
      this.menu.close();
      if (this._rng && this._rng.next() < ARRIVAL_EVENT_CHANCE) {
        const event = host.arrivalEvent(dest);
        if (event) feedback.notify(`🌫 ${event}`, 4000);
      }
      feedback.markDirty();
    };

    if (toInterior || host.indoors()) {
      host.fade(
        () => host.enterCell(toInterior ? locationId : "exterior", dest),
        () => {
          // An interior's entry point is where you stand once inside. The open
          // world is not itself a destination.
          if (toInterior) this.places.discoverLocation(locationId, loc.name, host.position().clone());
          arrive();
        },
      );
    } else {
      host.teleport(dest);
      arrive();
    }
  }
}
