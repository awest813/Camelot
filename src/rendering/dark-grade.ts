/**
 * dark-grade — Camelot's dark-fantasy colour grade as plain math.
 *
 * One curve shared by every art source so they read as one world:
 *  • imported assets (tools/grade-kaykit-textures.mjs, tools/import-quaternius.mjs
 *    use the same constants as {@link ASSET_GRADE});
 *  • in-engine synthesized surfaces (texture-synth.ts, {@link WORLD_GRADE},
 *    slightly gentler because the screen-space grade adds on top).
 *
 * Desaturate toward luminance, darken, tint shadows cold and highlights
 * bone-warm, then add a little contrast around a mid-grey pivot.
 */

export interface DarkGrade {
  /** Fraction of original saturation kept (0 = greyscale, 1 = unchanged). */
  saturation: number;
  /** Overall brightness multiplier. */
  darken: number;
  /** Multiplier applied in the shadows (cold). */
  shadowTint: readonly [number, number, number];
  /** Multiplier applied in the highlights (bone / ember warm). */
  highlightTint: readonly [number, number, number];
  /** Contrast gain around {@link DarkGrade.pivot}. */
  contrast: number;
  pivot: number;
}

/** The grade baked into imported textures (KayKit, Quaternius). */
export const ASSET_GRADE: DarkGrade = {
  saturation: 0.42,
  darken: 0.8,
  shadowTint: [0.93, 0.97, 1.06],
  highlightTint: [1.06, 1.0, 0.86],
  contrast: 1.12,
  pivot: 0.4,
};

/** Gentler grade for procedural world surfaces (terrain, bark, foliage). */
export const WORLD_GRADE: DarkGrade = {
  saturation: 0.62,
  darken: 0.86,
  shadowTint: [0.95, 0.98, 1.04],
  highlightTint: [1.04, 1.0, 0.9],
  contrast: 1.08,
  pivot: 0.4,
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Grade one sRGB colour with channels in [0, 1]; writes into `out` (may alias `rgb`). */
export function gradeRgb01(
  rgb: ArrayLike<number>,
  grade: DarkGrade = ASSET_GRADE,
  out: number[] = [0, 0, 0],
): number[] {
  const r = rgb[0], g = rgb[1], b = rgb[2];
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const t = smoothstep(0.15, 0.7, l);
  const src = [r, g, b];
  for (let k = 0; k < 3; k++) {
    let v = (l + (src[k] - l) * grade.saturation) * grade.darken;
    v *= grade.shadowTint[k] + (grade.highlightTint[k] - grade.shadowTint[k]) * t;
    out[k] = clamp01((v - grade.pivot) * grade.contrast + grade.pivot);
  }
  return out;
}

/** Grade an RGB triple with channels in [0, 255] in place (used by texture synthesis). */
export function gradeRgb255InPlace(rgb: number[], grade: DarkGrade = WORLD_GRADE): void {
  const c = gradeRgb01([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255], grade);
  rgb[0] = c[0] * 255;
  rgb[1] = c[1] * 255;
  rgb[2] = c[2] * 255;
}
