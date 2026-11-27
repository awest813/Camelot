/**
 * Who the player is, as a kernel feature: race, birthsign and class (with
 * their stat bonuses and racial traits), and the character-creation wizard
 * that picks them, names the hero and seeds the world.
 *
 * Inputs:   services character-host, feedback.
 * Outputs:  the `character` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { skillName } from "../../systems/skill-progression-system";
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { RaceSystem } from "../../systems/race-system";
import { BirthsignSystem } from "../../systems/birthsign-system";
import { ClassSystem } from "../../systems/class-system";
import type { AttributeSystem } from "../../systems/attribute-system";
import type { SkillProgressionSystem } from "../../systems/skill-progression-system";
import type { CharacterCreationResult } from "../../ui/character-creation-ui";
import type { WorldSeed } from "../../world/world-seed";
import { ClockKey, FeedbackKey, declareStateless } from "../services";
import { PowersHud, type PowerLine } from "../../ui/powers-hud";

/** What the wizard returns. */
export type CharacterChoice = CharacterCreationResult;

export interface CharacterHostService {
  readonly attributes: AttributeSystem;
  readonly skills: SkillProgressionSystem;
  /** Bring max health, magicka, stamina and carry weight up to date with the attributes, the omen and any disease. */
  syncMaxStats(): void;
  setRacialTraits(t: { waterBreathing: boolean; diseaseImmune: boolean }): void;
  /** The wizard owns the screen (play paused, pointer free), then hands it back. */
  beginCreation(): void;
  endCreation(): void;
  /** Show the wizard; resolves with the player's choices. */
  ask(): Promise<CharacterChoice>;
  /** Name the hero and fill health, magicka and stamina to their new maxima (plus `bonus`). */
  becomeHero(name: string, bonus: { maxHealth: number; maxMagicka: number; maxStamina: number }): void;
  seedWorld(seed: WorldSeed): void;
  /** The hero is ready: tips (skip preference saved when given), the first achievement, restored editor drafts. */
  welcome(skipTips: boolean | null): void;
}

export interface CharacterService {
  readonly races: RaceSystem;
  readonly birthsigns: BirthsignSystem;
  readonly classes: ClassSystem;
  /** Run the creation wizard (falls back to a Hill-folk warrior if it fails). */
  create(): Promise<void>;
  readonly creating: boolean;
}

export const CharacterHostKey = createServiceKey<CharacterHostService>("character-host");
export const CharacterKey = createServiceKey<CharacterService>("character");

export class CharacterFeature implements Feature {
  public readonly id = "character";
  public readonly races = new RaceSystem();
  public readonly birthsigns = new BirthsignSystem();
  public readonly classes = new ClassSystem();
  private _creating = false;
  /** The daily powers' HUD chip (heritage on V, omen on Shift+V). */
  public readonly powersHud = new PowersHud();

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "race, birthsign and class are saved by the save system");
    const s = ctx.kernel.services;
    const host = () => s.get(CharacterHostKey);
    const feedback = () => s.get(FeedbackKey);

    this.races.onRaceChosen = (race) => {
      feedback().notify(`Heritage: ${race.name}${race.power ? ` — Power: ${race.power.name}` : ""}`, 3000);
      host().syncMaxStats();
      // Some peoples breathe water, or shrug off disease (the Fen-folk).
      host().setRacialTraits({ waterBreathing: race.waterBreathing ?? false, diseaseImmune: race.diseaseImmune ?? false });
      feedback().markDirty();
    };
    this.birthsigns.onBirthsignChosen = (sign) => {
      feedback().notify(`Omen: ${sign.name}${sign.power ? ` — Power: ${sign.power.name}` : ""}`, 3000);
      host().syncMaxStats(); // the omen's bonus goes on top
      feedback().markDirty();
    };
    this.classes.onClassChosen = (cls) => {
      feedback().notify(`Calling: ${cls.name} (${cls.specialization}) — Major skills: ${cls.majorSkills.map(skillName).join(", ")}`, 4000);
      host().syncMaxStats();
      feedback().markDirty();
    };
    const power = (p: { name: string; description: string }) => {
      feedback().notify(`${p.name}: ${p.description}`, 3000);
      feedback().markDirty();
    };
    // A disease saps the maxima; its cure gives them back.
    ctx.on("disease:contracted", () => host().syncMaxStats());
    ctx.on("disease:cured", () => host().syncMaxStats());
    this.races.onPowerActivated = power;
    this.birthsigns.onPowerActivated = power;

    // eslint-disable-next-line @typescript-eslint/no-this-alias -- getter below
    const self = this;
    ctx.provide(CharacterKey, {
      races: this.races,
      birthsigns: this.birthsigns,
      classes: this.classes,
      get creating() { return self._creating; },
      create: () => this._create(),
    });

    // The powers chip: what each daily power is, and when it is ready (2 Hz is plenty).
    let wait = 0;
    ctx.system({
      id: "character.powers-hud", phase: "ui", update: (dt) => {
        wait -= dt;
        if (wait > 0) return;
        wait = 0.5;
        const now = (s.tryGet(ClockKey)?.elapsedHours() ?? 0) * 60;
        const lines: PowerLine[] = [];
        const race = this.races.chosenRace?.power;
        if (race && !this._creating) lines.push({ key: "V", name: race.name, minutesLeft: this.races.powerCooldownRemaining(now) });
        const omen = this.birthsigns.chosenBirthsign?.power;
        if (omen && !this._creating) lines.push({ key: "Shift+V", name: omen.name, minutesLeft: this.birthsigns.powerCooldownRemaining(now) });
        this.powersHud.update(lines);
      },
    });

    ctx.scope.add(() => {
      this.powersHud.destroy();
      this.races.onRaceChosen = this.races.onPowerActivated = null;
      this.birthsigns.onBirthsignChosen = this.birthsigns.onPowerActivated = null;
      this.classes.onClassChosen = null;
    });
    this._host = host;
    this._feedback = feedback;
  }

  private _host!: () => CharacterHostService;
  private _feedback!: () => { notify(text: string, ms?: number): void };

  private _choose(raceId: string, signId: string, classId: string): boolean {
    const h = this._host();
    const race = this.races.chooseRace(raceId, h.attributes, h.skills);
    const sign = this.birthsigns.chooseBirthsign(signId, h.attributes, h.skills);
    const cls = this.classes.chooseClass(classId, h.attributes, h.skills);
    return race && sign && cls;
  }

  private async _create(): Promise<void> {
    const h = this._host();
    this._creating = true;
    h.beginCreation();
    let choice: CharacterChoice | null = null;
    try {
      choice = await h.ask();
    } catch (error) {
      console.error("Character creation failed; applying defaults", error);
    }
    if (!choice || !this._choose(choice.raceId, choice.birthsignId, choice.classId)) this._choose("hillfolk", "sword_stone", "warrior");
    if (choice) {
      h.becomeHero(choice.name, this.birthsigns.getStatBonuses());
      if (choice.worldSeed) h.seedWorld(choice.worldSeed);
    }
    this._creating = false;
    h.endCreation();
    h.welcome(choice ? choice.skipGameplayTips : null);
    if (choice) this._feedback().notify(`Welcome, ${choice.name}! Character creation complete.`, 2800);
  }
}
