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
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { RaceSystem } from "../../systems/race-system";
import { BirthsignSystem } from "../../systems/birthsign-system";
import { ClassSystem } from "../../systems/class-system";
import type { AttributeSystem } from "../../systems/attribute-system";
import type { SkillProgressionSystem } from "../../systems/skill-progression-system";
import type { CharacterCreationResult } from "../../ui/character-creation-ui";
import type { WorldSeed } from "../../world/world-seed";
import { FeedbackKey, declareStateless } from "../services";

/** What the wizard returns. */
export type CharacterChoice = CharacterCreationResult;

export interface CharacterHostService {
  readonly attributes: AttributeSystem;
  readonly skills: SkillProgressionSystem;
  /** Max health, magicka, stamina and carry weight from the attributes. */
  syncMaxStats(): void;
  /** A birthsign's flat bonuses on top. */
  addMaxStats(b: { maxHealth: number; maxMagicka: number; maxStamina: number; carryWeight: number }): void;
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
  /** Run the creation wizard (falls back to a Nord warrior if it fails). */
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

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "race, birthsign and class are saved by the save system");
    const s = ctx.kernel.services;
    const host = () => s.get(CharacterHostKey);
    const feedback = () => s.get(FeedbackKey);

    this.races.onRaceChosen = (race) => {
      feedback().notify(`Race chosen: ${race.name} (${race.heritage})${race.power ? ` — Power: ${race.power.name}` : ""}`, 3000);
      host().syncMaxStats();
      // Argonians breathe water and shrug off disease.
      host().setRacialTraits({ waterBreathing: race.waterBreathing ?? false, diseaseImmune: race.id === "argonian" });
      feedback().markDirty();
    };
    this.birthsigns.onBirthsignChosen = (sign) => {
      feedback().notify(`Birthsign chosen: ${sign.name}${sign.power ? ` — Power: ${sign.power.name}` : ""}`, 3000);
      host().addMaxStats(this.birthsigns.getStatBonuses());
      feedback().markDirty();
    };
    this.classes.onClassChosen = (cls) => {
      feedback().notify(`Class chosen: ${cls.name} (${cls.specialization}) — Major skills: ${cls.majorSkills.join(", ")}`, 4000);
      host().syncMaxStats();
      feedback().markDirty();
    };
    const power = (p: { name: string; description: string }) => {
      feedback().notify(`${p.name}: ${p.description}`, 3000);
      feedback().markDirty();
    };
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

    ctx.scope.add(() => {
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
    if (!choice || !this._choose(choice.raceId, choice.birthsignId, choice.classId)) this._choose("nord", "warrior", "warrior");
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
