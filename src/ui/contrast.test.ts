/**
 * Text contrast of the game's UI colours (WCAG 2 AA: 4.5:1 for text).
 * Colours come from the stylesheet. Translucent backgrounds are composited
 * over white, the worst case for a dark panel above a bright scene.
 * (Engine overhaul, Phase 8 accessibility pass.)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../css/main.css"), "utf8")
  + readFileSync(resolve(__dirname, "../css/tome.css"), "utf8");

type RGBA = [number, number, number, number];

function parse(color: string): RGBA {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(c);
  if (rgb) {
    const [r, g, b, a = "1"] = rgb[1].split(",").map((s) => s.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  throw new Error(`unparsed colour ${color}`);
}

/** A `--panel-*` or `--tome-*` token's value from :root (following one var() hop). */
function token(name: string): string {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`no ${name}`);
  const v = m[1].trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? token(ref[1]) : v;
}

const over = ([r, g, b, a]: RGBA, [R, G, B]: RGBA): RGBA => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
const lum = ([r, g, b]: RGBA) => {
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};

export function contrast(fg: string, bg: string): number {
  const back = over(parse(bg), [255, 255, 255, 1]);
  const front = over(parse(fg), back);
  const [hi, lo] = [lum(front), lum(back)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

describe("UI text contrast (WCAG AA, 4.5:1)", () => {
  const pairs: Array<[string, string, string]> = [
    ["panel text", token("--panel-text"), token("--panel-bg")],
    ["panel dim text", token("--panel-dim"), token("--panel-bg")],
    ["panel title", token("--panel-title"), token("--panel-bg")],
    ["dim text in a section", token("--panel-dim"), token("--panel-section-bg")],
    ["text in a section", token("--panel-text"), token("--panel-section-bg")],
    ["good status", token("--panel-good"), token("--panel-section-bg")],
    ["warning status", token("--panel-warn"), token("--panel-section-bg")],
    ["selected row title", token("--panel-title"), token("--panel-selected-bg")],
    ["locked conversation choice", token("--panel-dim"), "rgba(20, 16, 10, 0.9)"],
    ["conversation choice", token("--panel-text"), "rgba(36, 24, 12, 0.95)"],
    ["highlighted conversation choice", token("--panel-title"), "rgba(60, 40, 18, 0.95)"],
    ["notification", "#E8C656", "rgba(14, 10, 4, 0.96)"],
    ["compass", "#F2E8D8", "rgba(6, 4, 2, 0.72)"],
    ["debug overlay", "#88FF88", "rgba(0, 0, 0, 0.7)"],
    // The tome (menus and the character creator): ink on parchment, gilt and type on leather.
    ["tome ink on parchment", token("--tome-ink"), token("--tome-parchment-deep")],
    ["tome soft ink on parchment", token("--tome-ink-soft"), token("--tome-parchment-deep")],
    ["tome wine heading on parchment", token("--tome-wine"), token("--tome-parchment-deep")],
    ["tome text on leather", token("--tome-leather-text"), token("--tome-leather")],
    ["tome dim text on leather", token("--tome-leather-dim"), token("--tome-leather")],
    ["tome gilt on leather", token("--tome-gilt"), token("--tome-leather")],
    ["tome button text on wine", "#fff3d6", token("--tome-wine")],
  ];
  for (const [what, fg, bg] of pairs) {
    it(`${what}: ${fg} on ${bg}`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("the checker itself: black on white is 21:1, mid-grey fails", () => {
    expect(contrast("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrast("#999", "#fff")).toBeLessThan(4.5);
  });
});
