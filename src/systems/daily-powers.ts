/**
 * The daily powers: the heritage's (V) and the omen's (Shift+V), each usable
 * once a day.  The heritage's dispatches its active effects; the omens':
 *
 *   Pendragon's Blood, Grail's Grace — heal 150 / 200 over five seconds;
 *   Under the Hill  — unseen and unheard for a minute;
 *   Warden's Key    — the next locked chest opens;
 *   Spellbound      — the foe in front of you is held for ten seconds;
 *   Adder's Bite    — the foe in front of you is poisoned (3 a second, 20 s).
 *
 * A power aimed at a foe needs one in front of you; nothing is spent without.
 */
import type { BirthsignSystem } from "./birthsign-system";
import type { ContainerSystem } from "./container-system";
import type { StealthSystem } from "./stealth-system";
import type { SpellSystem } from "./spell-system";
import type { ActiveEffectsSystem } from "./active-effects-system";
import type { RaceSystem } from "./race-system";

/** Use the heritage's power if it is ready (V). */
export function useHeritagePower(races: RaceSystem, effects: ActiveEffectsSystem, now: number, notify: (text: string, ms: number) => void): void {
  const power = races.chosenRace?.power;
  if (!power) { notify("No heritage power available.", 2000); return; }
  if (!races.canActivatePower(now)) {
    notify(`${power.name} is recharging (${Math.ceil(races.powerCooldownRemaining(now))} game-minutes remaining).`, 2500);
    return;
  }
  races.activatePower(now, effects);
}

/** How far (m) an omen's power reaches a foe in front of you. */
export const OMEN_REACH = 15;

export interface OmenPowerDeps {
  omens: BirthsignSystem | undefined;
  containers: ContainerSystem | undefined;
  stealth: Pick<StealthSystem, "unseenSeconds">;
  spells: Pick<SpellSystem, "targetInFront">;
  effects: Pick<ActiveEffectsSystem, "addEffect">;
  /** Game time (minutes). */
  now: number;
  notify(text: string, ms: number): void;
}

/** Use the omen's power if it has one and it is ready; true when it was used. */
export function useOmenPower(d: OmenPowerDeps): boolean {
  const power = d.omens?.chosenBirthsign?.power;
  if (!d.omens || !power) { d.notify("Your omen grants no power.", 2000); return false; }
  if (!d.omens.canActivatePower(d.now)) {
    const mins = Math.ceil(d.omens.powerCooldownRemaining(d.now));
    d.notify(`${power.name} is recharging (${mins} game-minutes remaining).`, 2500);
    return false;
  }
  const aimed = power.id === "spellbound" || power.id === "adders_bite";
  const target = aimed ? d.spells.targetInFront(OMEN_REACH) : null;
  if (aimed && !target) { d.notify(`${power.name}: no foe in front of you.`, 2000); return false; }
  if (!d.omens.activatePower(d.now)) return false;
  const heal = (total: number) => d.effects.addEffect({
    id: `omen_${power.id}_${d.now}`, name: power.name, effectType: "health_restore", magnitude: total / 5, duration: 5,
  });
  switch (power.id) {
    case "pendragons_blood": heal(150); break;
    case "grails_grace": heal(200); break;
    case "under_the_hill": d.stealth.unseenSeconds = 60; break;
    case "wardens_key": if (d.containers) d.containers.masterKeys += 1; break;
    case "spellbound":
      target!.applyStatusEffect({ type: "freeze", damagePerTick: 0, tickInterval: 1, tickTimer: 1, remainingDuration: 10 });
      target!.isStaggered = true;
      target!.isAttackTelegraphing = false;
      target!.staggerTimer = 10;
      break;
    case "adders_bite":
      target!.applyStatusEffect({ type: "poison", damagePerTick: 3, tickInterval: 1, tickTimer: 1, remainingDuration: 20 });
      target!.provoked = true;
      break;
  }
  return true;
}
