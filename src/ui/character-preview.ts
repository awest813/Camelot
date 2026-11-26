/**
 * What the character creator's ledger shows: the starting attributes a
 * race, birthsign and class add up to, with where each point comes from.
 * The same sums the race, birthsign and class systems apply on creation.
 */
import { ATTRIBUTE_NAMES, DEFAULT_ATTRIBUTES, type AttributeName } from "../systems/attribute-system";
import { FAVORED_ATTRIBUTE_BONUS, type CharacterClass } from "../systems/class-system";
import type { RaceDefinition } from "../systems/race-system";
import type { BirthsignDefinition } from "../systems/birthsign-system";

export interface AttributePreview {
  name: AttributeName;
  /** The starting value. */
  value: number;
  /** Points above (or below) the common base, and from what. */
  delta: number;
  sources: string[];
}

export function previewAttributes(
  race: RaceDefinition | null,
  sign: BirthsignDefinition | null,
  cls: CharacterClass | null,
): AttributePreview[] {
  return ATTRIBUTE_NAMES.map((name) => {
    const sources: string[] = [];
    let delta = 0;
    const add = (n: number | undefined, from: string) => {
      if (!n) return;
      delta += n;
      sources.push(`${n > 0 ? "+" : ""}${n} ${from}`);
    };
    add(race?.attributeBonus?.[name], race?.name ?? "");
    add(sign?.attributeBonus?.[name], sign?.name ?? "");
    if (cls?.favoredAttributes.includes(name)) add(FAVORED_ATTRIBUTE_BONUS, cls.name);
    const value = Math.max(1, Math.min(100, DEFAULT_ATTRIBUTES[name] + delta));
    return { name, value, delta, sources };
  });
}
