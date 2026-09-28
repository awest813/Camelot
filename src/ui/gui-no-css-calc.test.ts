import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ValueAndUnit } from "@babylonjs/gui/2D/valueAndUnit";

/**
 * Babylon GUI dimensions are not CSS: "calc(100% - 10px)" parses to NaN, and a
 * NaN-sized ScrollViewer erased its whole parent panel (Alchemy/Enchanting
 * never appeared). DOM `el.style.width = "calc(…)"` is fine and is excluded.
 */
describe("Babylon GUI dimensions", () => {
  it("parse calc() to NaN (why it is banned below)", () => {
    const v = new ValueAndUnit(1);
    v.fromString("calc(100% - 10px)");
    expect(Number.isNaN(v.internalValue)).toBe(true);
  });

  it("are never assigned CSS calc() in UI/system sources", () => {
    const offenders: string[] = [];
    const guiAssign = /(?<!\.style)\.(width|height|top|left|paddingTop|paddingBottom|paddingLeft|paddingRight)\s*=\s*["'`]calc\(/;
    for (const dir of ["src/ui", "src/systems"]) {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
        readFileSync(join(dir, file), "utf8").split("\n").forEach((line, i) => {
          if (guiAssign.test(line)) offenders.push(`${dir}/${file}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
