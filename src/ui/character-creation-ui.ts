import { BIRTHSIGNS, type BirthsignDefinition } from "../systems/birthsign-system";
import { CHARACTER_CLASSES, type CharacterClass } from "../systems/class-system";

interface CharacterCreationResult {
  birthsignId: string;
  classId: string;
}

const guardianLabel = (guardian: BirthsignDefinition["guardian"]): string => {
  return guardian.charAt(0).toUpperCase() + guardian.slice(1);
};

export class CharacterCreationUI {
  public async open(): Promise<CharacterCreationResult> {
    return new Promise<CharacterCreationResult>((resolve) => {
      const root = document.createElement("div");
      root.className = "character-create";

      const panel = document.createElement("section");
      panel.className = "character-create__panel";
      root.appendChild(panel);

      const title = document.createElement("h2");
      title.className = "character-create__title";
      title.textContent = "Forge Your Character";
      panel.appendChild(title);

      const subtitle = document.createElement("p");
      subtitle.className = "character-create__subtitle";
      panel.appendChild(subtitle);

      const stepPills = document.createElement("div");
      stepPills.className = "character-create__steps";
      panel.appendChild(stepPills);

      const birthsignStep = document.createElement("span");
      birthsignStep.className = "character-create__step-pill is-active";
      birthsignStep.textContent = "1. Birthsign";
      stepPills.appendChild(birthsignStep);

      const classStep = document.createElement("span");
      classStep.className = "character-create__step-pill";
      classStep.textContent = "2. Class";
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

      let step: "birthsign" | "class" = "birthsign";
      let selectedBirthsign: BirthsignDefinition | null = null;
      let selectedClass: CharacterClass | null = null;

      const clearCards = () => {
        while (cards.firstChild) cards.removeChild(cards.firstChild);
      };

      const setDetails = (entry: BirthsignDefinition | CharacterClass | null) => {
        detailsMeta.innerHTML = "";
        if (!entry) {
          detailsTitle.textContent = "Choose an option";
          detailsBody.textContent = "Pick a card to preview your starting strengths and progression.";
          return;
        }

        detailsTitle.textContent = entry.name;
        detailsBody.textContent = entry.description;

        if ("guardian" in entry) {
          const guardian = document.createElement("li");
          guardian.textContent = `Guardian: ${guardianLabel(entry.guardian)}`;
          detailsMeta.appendChild(guardian);

          if (entry.power) {
            const power = document.createElement("li");
            power.textContent = `Power: ${entry.power.name}`;
            detailsMeta.appendChild(power);
          }
        } else {
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

      const renderBirthsigns = () => {
        clearCards();
        subtitle.textContent = "Pick your birthsign to define innate gifts and unique powers.";
        continueButton.textContent = "Continue";
        continueButton.disabled = !selectedBirthsign;
        backButton.disabled = true;
        birthsignStep.classList.add("is-active");
        classStep.classList.remove("is-active");

        for (const sign of BIRTHSIGNS) {
          const card = document.createElement("button");
          card.className = "character-create__card";
          if (selectedBirthsign?.id === sign.id) card.classList.add("is-selected");

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

      const renderClasses = () => {
        clearCards();
        subtitle.textContent = "Select a class to shape your early skill growth and combat style.";
        continueButton.textContent = "Begin Adventure";
        continueButton.disabled = !selectedClass;
        backButton.disabled = false;
        birthsignStep.classList.remove("is-active");
        classStep.classList.add("is-active");

        for (const cls of CHARACTER_CLASSES) {
          const card = document.createElement("button");
          card.className = "character-create__card";
          if (selectedClass?.id === cls.id) card.classList.add("is-selected");

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
        step = "birthsign";
        renderBirthsigns();
      });

      continueButton.addEventListener("click", () => {
        if (step === "birthsign") {
          if (!selectedBirthsign) return;
          step = "class";
          renderClasses();
          return;
        }

        if (!selectedBirthsign || !selectedClass) return;
        root.remove();
        resolve({ birthsignId: selectedBirthsign.id, classId: selectedClass.id });
      });

      renderBirthsigns();
    });
  }
}

