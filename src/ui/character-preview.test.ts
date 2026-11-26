import { describe, expect, it } from "vitest";
import { previewAttributes } from "./character-preview";
import { RACES } from "../systems/race-system";
import { BIRTHSIGNS } from "../systems/birthsign-system";
import { CHARACTER_CLASSES, FAVORED_ATTRIBUTE_BONUS } from "../systems/class-system";

describe("previewAttributes", () => {
  it("is the common base before anything is chosen", () => {
    const p = previewAttributes(null, null, null);
    expect(p).toHaveLength(7);
    expect(p.every((a) => a.value === 40 && a.delta === 0 && a.sources.length === 0)).toBe(true);
  });

  it("adds the race, the birthsign and the class's favored attributes, naming each", () => {
    const race = RACES[0], sign = BIRTHSIGNS[0], cls = CHARACTER_CLASSES[0];
    const p = previewAttributes(race, sign, cls);
    for (const a of p) {
      const expected = (race.attributeBonus?.[a.name] ?? 0) + (sign.attributeBonus?.[a.name] ?? 0)
        + (cls.favoredAttributes.includes(a.name) ? FAVORED_ATTRIBUTE_BONUS : 0);
      expect(a.delta, a.name).toBe(expected);
      expect(a.value).toBe(Math.min(100, Math.max(1, 40 + expected)));
    }
    const favored = p.find((a) => a.name === cls.favoredAttributes[0])!;
    expect(favored.sources).toContain(`+${FAVORED_ATTRIBUTE_BONUS} ${cls.name}`);
  });
});
