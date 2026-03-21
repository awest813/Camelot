import { BIRTHSIGNS, type BirthsignDefinition } from "../systems/birthsign-system";
import { CHARACTER_CLASSES, type CharacterClass } from "../systems/class-system";
import { RACES, type RaceDefinition } from "../systems/race-system";

interface CharacterCreationResult {
  name: string;
  raceId: string;
  birthsignId: string;
  classId: string;
}

/**
 * Twelve zodiac-inspired medieval name suggestions presented on the Name step.
 * Each entry pairs a zodiac sign with a medieval-sounding given name and a
 * gender-neutral descriptor drawn from medieval heraldic tradition.
 */
const ZODIAC_NAME_SUGGESTIONS: ReadonlyArray<{ sign: string; name: string }> = [
  { sign: "Aries",       name: "Arion"    },
  { sign: "Taurus",      name: "Toberon"  },
  { sign: "Gemini",      name: "Geminus"  },
  { sign: "Cancer",      name: "Caelan"   },
  { sign: "Leo",         name: "Leoric"   },
  { sign: "Virgo",       name: "Virael"   },
  { sign: "Libra",       name: "Liberon"  },
  { sign: "Scorpio",     name: "Scorian"  },
  { sign: "Sagittarius", name: "Sagitta"  },
  { sign: "Capricorn",   name: "Caprian"  },
  { sign: "Aquarius",    name: "Aquilan"  },
  { sign: "Pisces",      name: "Pisceon"  },
];

const guardianLabel = (guardian: BirthsignDefinition["guardian"]): string => {
  return guardian.charAt(0).toUpperCase() + guardian.slice(1);
};

const heritageLabel = (heritage: RaceDefinition["heritage"]): string => {
  return heritage.charAt(0).toUpperCase() + heritage.slice(1);
};

export class CharacterCreationUI {
  public async open(): Promise<CharacterCreationResult> {
    return new Promise<CharacterCreationResult>((resolve) => {
      const root = document.createElement("div");
      root.className = "character-create";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-labelledby", "character-create-title");

      const panel = document.createElement("section");
      panel.className = "character-create__panel";
      root.appendChild(panel);

      const title = document.createElement("h2");
      title.id = "character-create-title";
      title.className = "character-create__title";
      title.textContent = "Forge Your Character";
      panel.appendChild(title);

      const subtitle = document.createElement("p");
      subtitle.className = "character-create__subtitle";
      panel.appendChild(subtitle);

      const stepPills = document.createElement("div");
      stepPills.className = "character-create__steps";
      panel.appendChild(stepPills);

      const nameStep = document.createElement("span");
      nameStep.className = "character-create__step-pill is-active";
      nameStep.textContent = "1. Name";
      nameStep.setAttribute("aria-current", "step");
      stepPills.appendChild(nameStep);

      const raceStep = document.createElement("span");
      raceStep.className = "character-create__step-pill";
      raceStep.textContent = "2. Race";
      stepPills.appendChild(raceStep);

      const birthsignStep = document.createElement("span");
      birthsignStep.className = "character-create__step-pill";
      birthsignStep.textContent = "3. Birthsign";
      stepPills.appendChild(birthsignStep);

      const classStep = document.createElement("span");
      classStep.className = "character-create__step-pill";
      classStep.textContent = "4. Class";
      stepPills.appendChild(classStep);

      const cards = document.createElement("div");
      cards.className = "character-create__cards";
      panel.appendChild(cards);

      const details = document.createElement("aside");
      details.className = "character-create__details";
      panel.appendChild(details);

      const detailsTitle = document.createElement("h3");
      detailsTitle.className = "character-create__details-title";
      details.appendChild(detailsTitle);

      const detailsBody = document.createElement("p");
      detailsBody.className = "character-create__details-body";
      details.appendChild(detailsBody);

      const detailsMeta = document.createElement("ul");
      detailsMeta.className = "character-create__meta";
      details.appendChild(detailsMeta);

      const actions = document.createElement("div");
      actions.className = "character-create__actions";
      panel.appendChild(actions);

      const backButton = document.createElement("button");
      backButton.className = "character-create__button character-create__button--secondary";
      backButton.textContent = "Back";
      backButton.disabled = true;
      actions.appendChild(backButton);

      const continueButton = document.createElement("button");
      continueButton.className = "character-create__button";
      continueButton.textContent = "Continue";
      continueButton.disabled = true;
      actions.appendChild(continueButton);

      document.body.appendChild(root);

      let step: "name" | "race" | "birthsign" | "class" = "name";
      let enteredName: string = "";
      let selectedRace: RaceDefinition | null = null;
      let selectedBirthsign: BirthsignDefinition | null = null;
      let selectedClass: CharacterClass | null = null;

      const clearCards = () => {
        while (cards.firstChild) cards.removeChild(cards.firstChild);
      };

      const setAllStepPills = (active: typeof step) => {
        const steps: typeof step[] = ["name", "race", "birthsign", "class"];
        const pills = [nameStep, raceStep, birthsignStep, classStep];
        steps.forEach((s, i) => {
          if (s === active) {
            pills[i].classList.add("is-active");
            pills[i].setAttribute("aria-current", "step");
          } else {
            pills[i].classList.remove("is-active");
            pills[i].removeAttribute("aria-current");
          }
        });
      };

      const setDetails = (entry: RaceDefinition | BirthsignDefinition | CharacterClass | null) => {
        detailsMeta.innerHTML = "";
        if (!entry) {
          detailsTitle.textContent = "Choose an option";
          detailsBody.textContent = "Pick a card to preview your starting strengths and progression.";
          return;
        }

        detailsTitle.textContent = entry.name;
        detailsBody.textContent = entry.description;

        if ("heritage" in entry) {
          // RaceDefinition
          const heritage = document.createElement("li");
          heritage.textContent = `Heritage: ${heritageLabel(entry.heritage)}`;
          detailsMeta.appendChild(heritage);

          if (entry.power) {
            const power = document.createElement("li");
            power.textContent = `Power: ${entry.power.name}`;
            detailsMeta.appendChild(power);
          }

          if (entry.attributeBonus) {
            const bonusParts = Object.entries(entry.attributeBonus)
              .filter(([, v]) => v !== 0)
              .map(([k, v]) => `${k} ${v! > 0 ? "+" : ""}${v}`);
            if (bonusParts.length) {
              const attrLi = document.createElement("li");
              attrLi.textContent = `Attributes: ${bonusParts.join(", ")}`;
              detailsMeta.appendChild(attrLi);
            }
          }
        } else if ("guardian" in entry) {
          // BirthsignDefinition
          const guardian = document.createElement("li");
          guardian.textContent = `Guardian: ${guardianLabel(entry.guardian)}`;
          detailsMeta.appendChild(guardian);

          if (entry.power) {
            const power = document.createElement("li");
            power.textContent = `Power: ${entry.power.name}`;
            detailsMeta.appendChild(power);
          }
        } else {
          // CharacterClass
          const spec = document.createElement("li");
          spec.textContent = `Specialization: ${entry.specialization}`;
          detailsMeta.appendChild(spec);

          const attrs = document.createElement("li");
          attrs.textContent = `Favored attributes: ${entry.favoredAttributes.join(", ")}`;
          detailsMeta.appendChild(attrs);

          const majors = document.createElement("li");
          majors.textContent = `Major skills: ${entry.majorSkills.join(", ")}`;
          detailsMeta.appendChild(majors);
        }
      };

      // ── Step: Name ─────────────────────────────────────────────────────────

      const renderName = () => {
        clearCards();
        subtitle.textContent =
          "Name your hero. Choose a name below or type your own — each is inspired by a sign of the medieval zodiac.";
        continueButton.textContent = "Continue";
        continueButton.disabled = enteredName.trim().length === 0;
        continueButton.setAttribute("aria-disabled", continueButton.disabled.toString());
        backButton.disabled = true;
        backButton.setAttribute("aria-disabled", "true");
        setAllStepPills("name");

        // Text input
        const inputWrap = document.createElement("div");
        inputWrap.className = "character-create__name-wrap";
        cards.appendChild(inputWrap);

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "character-create__name-input";
        nameInput.placeholder = "Enter your name…";
        nameInput.maxLength = 30;
        nameInput.value = enteredName;
        inputWrap.appendChild(nameInput);

        setTimeout(() => nameInput.focus(), 10);

        nameInput.addEventListener("input", () => {
          enteredName = nameInput.value;
          continueButton.disabled = enteredName.trim().length === 0;
        });

        // Zodiac name suggestions
        const suggestLabel = document.createElement("p");
        suggestLabel.className = "character-create__suggest-label";
        suggestLabel.textContent = "Zodiac-inspired suggestions:";
        cards.appendChild(suggestLabel);

        const suggestGrid = document.createElement("div");
        suggestGrid.className = "character-create__suggest-grid";
        cards.appendChild(suggestGrid);

        for (const { sign, name } of ZODIAC_NAME_SUGGESTIONS) {
          const btn = document.createElement("button");
          btn.className = "character-create__suggest-btn";
          btn.title = sign;
          btn.textContent = name;
          btn.addEventListener("click", () => {
            enteredName = name;
            nameInput.value = name;
            continueButton.disabled = false;
          });
          suggestGrid.appendChild(btn);
        }

        // Show the zodiac sign as a tooltip hint
        detailsTitle.textContent = "Your Name";
        detailsBody.textContent =
          "Your name will be known across the realm.  " +
          "Pick a zodiac-sign name for a touch of destiny, or forge your own legend.";
        detailsMeta.innerHTML = "";
      };

      // ── Step: Race ─────────────────────────────────────────────────────────

      const renderRaces = () => {
        clearCards();
        subtitle.textContent = "Choose your race to define your heritage, innate talents, and appearance.";
        continueButton.textContent = "Continue";
        continueButton.disabled = !selectedRace;
        backButton.disabled = false;
        setAllStepPills("race");

        for (const race of RACES) {
          const card = document.createElement("button");
          card.className = "character-create__card";
          const isSelected = selectedRace?.id === race.id;
          if (isSelected) card.classList.add("is-selected");
          card.setAttribute("aria-pressed", isSelected.toString());

          const cardName = document.createElement("strong");
          cardName.textContent = race.name;
          card.appendChild(cardName);

          const cardTag = document.createElement("span");
          cardTag.className = "character-create__tag";
          cardTag.textContent = heritageLabel(race.heritage);
          card.appendChild(cardTag);

          card.addEventListener("click", () => {
            selectedRace = race;
            setDetails(race);
            renderRaces();
          });
          cards.appendChild(card);
        }

        setDetails(selectedRace);
      };

      // ── Step: Birthsign ────────────────────────────────────────────────────

      const renderBirthsigns = () => {
        clearCards();
        subtitle.textContent = "Pick your birthsign to define innate gifts and unique powers.";
        continueButton.textContent = "Continue";
        continueButton.disabled = !selectedBirthsign;
        backButton.disabled = false;
        setAllStepPills("birthsign");

        for (const sign of BIRTHSIGNS) {
          const card = document.createElement("button");
          card.className = "character-create__card";
          const isSelected = selectedBirthsign?.id === sign.id;
          if (isSelected) card.classList.add("is-selected");
          card.setAttribute("aria-pressed", isSelected.toString());

          const cardName = document.createElement("strong");
          cardName.textContent = sign.name;
          card.appendChild(cardName);

          const cardTag = document.createElement("span");
          cardTag.className = "character-create__tag";
          cardTag.textContent = guardianLabel(sign.guardian);
          card.appendChild(cardTag);

          card.addEventListener("click", () => {
            selectedBirthsign = sign;
            setDetails(sign);
            renderBirthsigns();
          });
          cards.appendChild(card);
        }

        setDetails(selectedBirthsign);
      };

      // ── Step: Class ────────────────────────────────────────────────────────

      const renderClasses = () => {
        clearCards();
        subtitle.textContent = "Select a class to shape your early skill growth and combat style.";
        continueButton.textContent = "Begin Adventure";
        continueButton.disabled = !selectedClass;
        backButton.disabled = false;
        setAllStepPills("class");

        for (const cls of CHARACTER_CLASSES) {
          const card = document.createElement("button");
          card.className = "character-create__card";
          const isSelected = selectedClass?.id === cls.id;
          if (isSelected) card.classList.add("is-selected");
          card.setAttribute("aria-pressed", isSelected.toString());

          const cardName = document.createElement("strong");
          cardName.textContent = cls.name;
          card.appendChild(cardName);

          const cardTag = document.createElement("span");
          cardTag.className = "character-create__tag";
          cardTag.textContent = cls.specialization;
          card.appendChild(cardTag);

          card.addEventListener("click", () => {
            selectedClass = cls;
            setDetails(cls);
            renderClasses();
          });
          cards.appendChild(card);
        }

        setDetails(selectedClass);
      };

      backButton.addEventListener("click", () => {
        if (step === "race") {
          step = "name";
          renderName();
        } else if (step === "birthsign") {
          step = "race";
          renderRaces();
        } else if (step === "class") {
          step = "birthsign";
          renderBirthsigns();
        }
      });

      continueButton.addEventListener("click", () => {
        if (step === "name") {
          if (!enteredName.trim()) return;
          step = "race";
          renderRaces();
          return;
        }
        if (step === "race") {
          if (!selectedRace) return;
          step = "birthsign";
          renderBirthsigns();
          return;
        }
        if (step === "birthsign") {
          if (!selectedBirthsign) return;
          step = "class";
          renderClasses();
          return;
        }

        if (!enteredName.trim() || !selectedRace || !selectedBirthsign || !selectedClass) return;
        root.remove();
        resolve({
          name: enteredName.trim(),
          raceId: selectedRace.id,
          birthsignId: selectedBirthsign.id,
          classId: selectedClass.id,
        });
      });

      renderName();
    });
  }
}

