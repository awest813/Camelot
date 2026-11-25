/**
 * Notices: what systems report on the event bus, told to the player.
 * Swimming, diseases, world events, mark and recall, merchant restocks,
 * effects wearing off, perks, zone respawns and the weather.  Each system
 * reports an event (it is given the bus as `system.events`); this feature
 * is the one place that turns those into on-screen messages.
 *
 * Inputs:   events swim:*, disease:*, worldEvent:triggered, mark:*,
 *           merchant:restocked, effect:expired, perk:unlocked,
 *           zone:respawned, weather:changed; service feedback.
 * Outputs:  notifications; a dirty save after a restock or a new perk.
 *
 * Engine overhaul (systems wired by events, not callback properties).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { FeedbackKey, declareStateless } from "../services";

/** Names the events carry only as ids. */
export interface NoticeNames {
  disease(id: string): string;
  merchant(id: string): string;
  /** The weather now, as the player reads it ("Light rain"). */
  weather(): string;
}

export class NoticesFeature implements Feature {
  public readonly id = "notices";

  constructor(private readonly _names: NoticeNames) {}

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "messages only");
    const fb = () => ctx.kernel.services.get(FeedbackKey);
    const say = (text: string, ms: number) => fb().notify(text, ms);
    const n = this._names;

    ctx.on("swim:entered", () => say("Entered water.", 1500));
    ctx.on("swim:exited", () => say("Surfaced.", 1500));
    ctx.on("swim:breathLow", () => say("Running out of breath!", 2000));
    ctx.on("disease:contracted", ({ diseaseId }) => say(`Contracted ${n.disease(diseaseId)}!`, 3000));
    ctx.on("disease:cured", ({ diseaseId }) => say(`Cured of ${n.disease(diseaseId)}.`, 2000));
    ctx.on("worldEvent:triggered", ({ def }) => say(`📜 ${def.title}`, 3000));
    ctx.on("mark:set", () => say("Position Marked.", 2000));
    ctx.on("mark:recalled", () => say("Recalled to marked position.", 2000));
    ctx.on("merchant:restocked", ({ merchantId }) => {
      say(`${n.merchant(merchantId)} has restocked their wares.`, 2000);
      fb().markDirty();
    });
    ctx.on("effect:expired", ({ effect }) => say(`${effect.name} has worn off.`, 1800));
    ctx.on("perk:unlocked", ({ perkName }) => {
      say(`Perk unlocked: ${perkName}!`, 3500);
      fb().markDirty();
    });
    ctx.on("zone:respawned", ({ zoneId }) => say(`${zoneId} has respawned — new dangers await!`, 2500));
    ctx.on("weather:changed", () => say(`Weather: ${n.weather()}`, 2500));
  }
}
