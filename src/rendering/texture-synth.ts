/**
 * texture-synth — headless, deterministic, tileable texture synthesis.
 *
 * Produces albedo (RGBA8) and height (Float32) buffers for every surface the
 * world uses, plus a normal-map converter.  Everything here is plain
 * TypedArray math with no Babylon dependency, so it runs (and is tested) in
 * Node exactly as it does in the browser.
 *
 * Noise is periodic: every octave's lattice period divides the texture, so all
 * generated textures wrap seamlessly in U and V.
 */

// ── Seeded hashing ────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERM_SIZE = 512;

/** Periodic gradient + cellular noise over a seeded permutation table. */
export class TileableNoise {
  private readonly _perm = new Uint16Array(PERM_SIZE * 2);
  private readonly _gx = new Float32Array(PERM_SIZE);
  private readonly _gy = new Float32Array(PERM_SIZE);
  private readonly _rx = new Float32Array(PERM_SIZE);
  private readonly _ry = new Float32Array(PERM_SIZE);

  constructor(seed = 1337) {
    const rand = mulberry32(seed);
    const p = new Uint16Array(PERM_SIZE);
    for (let i = 0; i < PERM_SIZE; i++) p[i] = i;
    for (let i = PERM_SIZE - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < PERM_SIZE * 2; i++) this._perm[i] = p[i % PERM_SIZE];
    for (let i = 0; i < PERM_SIZE; i++) {
      const a = rand() * Math.PI * 2;
      this._gx[i] = Math.cos(a);
      this._gy[i] = Math.sin(a);
      this._rx[i] = rand();
      this._ry[i] = rand();
    }
  }

  /** Hash of an integer lattice point (already wrapped to its period). */
  public hash(ix: number, iy: number): number {
    return this._perm[this._perm[ix & (PERM_SIZE - 1)] + (iy & (PERM_SIZE - 1))];
  }

  /** Hash in [0, 1). */
  public hash01(ix: number, iy: number): number {
    return this._rx[this.hash(ix, iy)];
  }

  /**
   * Periodic 2D gradient noise in roughly [-1, 1].
   * `x`, `y` are lattice coordinates; the pattern repeats every `period` units.
   */
  public gradient(x: number, y: number, period: number, periodY: number = period): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ix0 = ((x0 % period) + period) % period;
    const iy0 = ((y0 % periodY) + periodY) % periodY;
    const ix1 = (ix0 + 1) % period;
    const iy1 = (iy0 + 1) % periodY;

    const h00 = this.hash(ix0, iy0);
    const h10 = this.hash(ix1, iy0);
    const h01 = this.hash(ix0, iy1);
    const h11 = this.hash(ix1, iy1);

    const d00 = this._gx[h00] * fx + this._gy[h00] * fy;
    const d10 = this._gx[h10] * (fx - 1) + this._gy[h10] * fy;
    const d01 = this._gx[h01] * fx + this._gy[h01] * (fy - 1);
    const d11 = this._gx[h11] * (fx - 1) + this._gy[h11] * (fy - 1);

    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = d00 + (d10 - d00) * u;
    const b = d01 + (d11 - d01) * u;
    return (a + (b - a) * v) * 1.414;
  }

  /**
   * Tileable fractal Brownian motion in roughly [-1, 1].
   * `u`, `v` ∈ [0, 1) texture coordinates; `freq` is the integer base period.
   */
  public fbm(u: number, v: number, freq: number, octaves = 4, gain = 0.5): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = freq;
    for (let o = 0; o < octaves; o++) {
      sum += this.gradient(u * f, v * f, f) * amp;
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    return sum / norm;
  }

  /**
   * Anisotropic tileable fbm: integer base periods `fu` across U and `fv`
   * along V (e.g. stretched wood grain).  Scaling a coordinate before calling
   * {@link fbm} instead would break tiling.
   */
  public fbmA(u: number, v: number, fu: number, fv: number, octaves = 4, gain = 0.5): number {
    let sum = 0, amp = 1, norm = 0, a = fu, b = fv;
    for (let o = 0; o < octaves; o++) {
      sum += this.gradient(u * a, v * b, a, b) * amp;
      norm += amp;
      amp *= gain;
      a *= 2;
      b *= 2;
    }
    return sum / norm;
  }

  /** Anisotropic ridged fbm in [0, 1] (see {@link fbmA}). */
  public ridgedA(u: number, v: number, fu: number, fv: number, octaves = 4): number {
    let sum = 0, amp = 1, norm = 0, a = fu, b = fv;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(this.gradient(u * a, v * b, a, b));
      sum += n * n * amp;
      norm += amp;
      amp *= 0.5;
      a *= 2;
      b *= 2;
    }
    return sum / norm;
  }

  /** Ridged fbm in [0, 1] — sharp creases (bark furrows, cracks, veins). */
  public ridged(u: number, v: number, freq: number, octaves = 4): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = freq;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(this.gradient(u * f, v * f, f));
      sum += n * n * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }

  /**
   * Tileable Worley (cellular) noise.  Returns distances to the nearest (f1)
   * and second-nearest (f2) feature points, in cell units, plus the nearest
   * cell's hash in [0, 1) for per-cell variation.
   */
  public worley(u: number, v: number, cells: number, out: WorleySample): WorleySample {
    const x = u * cells;
    const y = v * cells;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let f1 = 1e9;
    let f2 = 1e9;
    let id = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const gx = cx + ox;
        const gy = cy + oy;
        const wx = ((gx % cells) + cells) % cells;
        const wy = ((gy % cells) + cells) % cells;
        const h = this.hash(wx, wy);
        const px = gx + this._rx[h];
        const py = gy + this._ry[h];
        const dx = px - x;
        const dy = py - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = this._rx[(h + 97) & (PERM_SIZE - 1)];
        } else if (d < f2) {
          f2 = d;
        }
      }
    }
    out.f1 = f1;
    out.f2 = f2;
    out.id = id;
    return out;
  }
}

export interface WorleySample { f1: number; f2: number; id: number }

// ── Small math helpers ────────────────────────────────────────────────────────

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

type RGB = ArrayLike<number>;

function mix(a: RGB, b: RGB, t: number, out: number[]): number[] {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
  return out;
}

// ── Output types ──────────────────────────────────────────────────────────────

/** One synthesized surface: albedo RGBA8 and a [0, 1] height field. */
export interface SynthSurface {
  size: number;
  albedo: Uint8Array;
  height: Float32Array;
  /** Normal-map strength suggested for this surface. */
  bumpStrength: number;
  /** True when the albedo alpha channel carries a cut-out mask. */
  hasAlpha: boolean;
}

export type SurfaceKind =
  | "grass" | "forest_floor" | "sand" | "snow" | "dirt" | "rock"
  | "stone_ruins" | "desert_sandstone" | "watchtower_timber" | "bark_timber"
  | "mossy_stone" | "foliage_canopy" | "iron_metal"
  | "leaf_card" | "grass_blades" | "roof_thatch" | "plaster" | "palm_frond";

export const SURFACE_KINDS: readonly SurfaceKind[] = [
  "grass", "forest_floor", "sand", "snow", "dirt", "rock",
  "stone_ruins", "desert_sandstone", "watchtower_timber", "bark_timber",
  "mossy_stone", "foliage_canopy", "iron_metal",
  "leaf_card", "grass_blades", "roof_thatch", "plaster", "palm_frond",
];

// ── Normal map ────────────────────────────────────────────────────────────────

/**
 * Convert a tileable height field into a tangent-space normal map (RGBA8,
 * OpenGL convention: +Y up).  Alpha stores the height so materials can use
 * parallax mapping on top.
 */
export function heightToNormalMap(height: Float32Array, size: number, strength: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const s = strength * size / 64;
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size;
    const yp = ((y + 1) % size) * size;
    const yr = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (height[yr + xp] - height[yr + xm]) * s;
      const dy = (height[yp + x] - height[ym + x]) * s;
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv; ny *= inv; nz *= inv;
      const i = (yr + x) * 4;
      out[i]     = Math.round((nx * 0.5 + 0.5) * 255);
      // Babylon samples bump maps with V flipped relative to our raster rows.
      out[i + 1] = Math.round((-ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[i + 3] = Math.round(clamp01(height[yr + x]) * 255);
    }
  }
  return out;
}

// ── Surface synthesis ─────────────────────────────────────────────────────────

const _noiseCache = new Map<number, TileableNoise>();
function noiseFor(seed: number): TileableNoise {
  let n = _noiseCache.get(seed);
  if (!n) {
    n = new TileableNoise(seed);
    _noiseCache.set(seed, n);
  }
  return n;
}

type PixelFn = (u: number, v: number, x: number, y: number, rgb: number[]) => { h: number; a?: number };

function synth(size: number, bumpStrength: number, hasAlpha: boolean, fn: PixelFn): SynthSurface {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const rgb = [0, 0, 0];
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    const v = y * inv;
    for (let x = 0; x < size; x++) {
      const u = x * inv;
      const r = fn(u, v, x, y, rgb);
      const i = y * size + x;
      height[i] = r.h;
      const o = i * 4;
      albedo[o]     = rgb[0] < 0 ? 0 : rgb[0] > 255 ? 255 : Math.round(rgb[0]);
      albedo[o + 1] = rgb[1] < 0 ? 0 : rgb[1] > 255 ? 255 : Math.round(rgb[1]);
      albedo[o + 2] = rgb[2] < 0 ? 0 : rgb[2] > 255 ? 255 : Math.round(rgb[2]);
      albedo[o + 3] = r.a === undefined ? 255 : Math.round(clamp01(r.a) * 255);
    }
  }
  if (hasAlpha) bleedColorIntoTransparent(albedo, size);
  return { size, albedo, height, bumpStrength, hasAlpha };
}

/**
 * Copy opaque neighbour colours into fully transparent texels so mipmapping and
 * bilinear filtering don't drag a dark/black fringe around alpha-tested cards.
 */
function bleedColorIntoTransparent(px: Uint8Array, size: number): void {
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    const src = px.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (src[i + 3] !== 0 || (src[i] | src[i + 1] | src[i + 2]) !== 0) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const j = ((((y + oy + size) % size) * size) + ((x + ox + size) % size)) * 4;
            if (src[j + 3] > 0 || (src[j] | src[j + 1] | src[j + 2]) !== 0) {
              r += src[j]; g += src[j + 1]; b += src[j + 2]; n++;
            }
          }
        }
        if (n > 0) {
          px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}

const W: WorleySample = { f1: 0, f2: 0, id: 0 };
const W2: WorleySample = { f1: 0, f2: 0, id: 0 };

/** Synthesize one surface at `size`×`size` (any power of two ≥ 16). */
export function synthesizeSurface(kind: SurfaceKind, size: number, seed = 7): SynthSurface {
  const n = noiseFor(seed);
  const tmp = [0, 0, 0];

  switch (kind) {
    case "grass": {
      const deep: RGB = [52, 84, 30], lush: RGB = [96, 128, 48], dry: RGB = [146, 140, 74], soil: RGB = [86, 68, 44];
      return synth(size, 1.6, false, (u, v, _x, _y, c) => {
        const macro = n.fbm(u, v, 3, 3) * 0.5 + 0.5;
        const clumps = n.fbm(u, v, 24, 3) * 0.5 + 0.5;
        const blades = n.ridgedA(u, v, 64, 16, 2);
        n.worley(u, v, 18, W);
        const gap = smoothstep(0.18, 0.02, W.f1) * smoothstep(0.55, 0.75, n.fbm(u, v, 6, 2) * 0.5 + 0.5);
        mix(deep, lush, clamp01(clumps * 0.8 + blades * 0.4), c);
        mix(c, dry, smoothstep(0.55, 0.85, macro) * 0.55, c);
        mix(c, soil, gap * 0.8, c);
        const shade = 0.82 + blades * 0.3;
        c[0] *= shade; c[1] *= shade; c[2] *= shade;
        return { h: clamp01(clumps * 0.6 + blades * 0.5 - gap * 0.5) };
      });
    }

    case "forest_floor": {
      const soil: RGB = [70, 56, 38], litterA: RGB = [112, 78, 40], litterB: RGB = [84, 64, 34],
        litterC: RGB = [72, 80, 38], moss: RGB = [56, 82, 32];
      return synth(size, 2.2, false, (u, v, _x, _y, c) => {
        n.worley(u, v, 22, W);
        const leaf = smoothstep(0.55, 0.25, W.f1);
        const id = W.id;
        const base: RGB = id < 0.33 ? litterA : id < 0.66 ? litterB : litterC;
        mix(soil, base, leaf * (0.75 + n.fbm(u, v, 48, 2) * 0.25), c);
        const mossMask = smoothstep(0.1, 0.45, n.fbm(u, v, 4, 4));
        mix(c, moss, mossMask * 0.85, c);
        const vein = n.ridged(u, v, 40, 2);
        const shade = 0.85 + vein * 0.25 - (1 - leaf) * 0.15;
        c[0] *= shade; c[1] *= shade; c[2] *= shade;
        return { h: clamp01(leaf * 0.6 + mossMask * 0.3 + vein * 0.15) };
      });
    }

    case "sand": {
      const base: RGB = [214, 184, 128], crest: RGB = [236, 212, 160], trough: RGB = [182, 148, 96];
      return synth(size, 0.7, false, (u, v, x, y, c) => {
        const warp = n.fbm(u, v, 3, 3) * 0.6;
        const ripple = (Math.sin((v * 5 + u + warp) * Math.PI * 2) * 0.5 + 0.5) * (0.55 + 0.45 * (n.fbm(u, v, 2, 2) * 0.5 + 0.5));
        const macro = n.fbm(u, v, 4, 3) * 0.5 + 0.5;
        mix(trough, base, ripple, c);
        mix(c, crest, smoothstep(0.75, 1, ripple) * 0.5 + macro * 0.2, c);
        const grain = n.hash01(x, y) * 18 - 9;
        c[0] += grain; c[1] += grain; c[2] += grain * 0.8;
        return { h: ripple * 0.7 + macro * 0.3 };
      });
    }

    case "snow": {
      const white: RGB = [236, 241, 248], blue: RGB = [196, 212, 232];
      return synth(size, 1.0, false, (u, v, x, y, c) => {
        const drift = n.fbm(u, v, 4, 5) * 0.5 + 0.5;
        mix(blue, white, smoothstep(0.25, 0.75, drift), c);
        const sparkle = n.hash01(x, y) > 0.985 ? 16 : 0;
        c[0] += sparkle; c[1] += sparkle; c[2] += sparkle;
        return { h: drift };
      });
    }

    case "dirt": {
      const dark: RGB = [84, 64, 44], light: RGB = [128, 100, 70], pebble: RGB = [140, 130, 116];
      return synth(size, 2.0, false, (u, v, _x, _y, c) => {
        const m = n.fbm(u, v, 8, 4) * 0.5 + 0.5;
        mix(dark, light, m, c);
        n.worley(u, v, 28, W);
        const peb = smoothstep(0.28, 0.12, W.f1) * (W.id > 0.55 ? 1 : 0);
        mix(c, pebble, peb * (0.6 + W.id * 0.4), c);
        return { h: clamp01(m * 0.5 + peb * 0.6) };
      });
    }

    case "rock": {
      const dark: RGB = [92, 90, 86], light: RGB = [150, 146, 136], lichen: RGB = [128, 132, 86];
      return synth(size, 3.0, false, (u, v, _x, _y, c) => {
        const m = n.fbm(u, v, 4, 5) * 0.5 + 0.5;
        n.worley(u, v, 6, W);
        const crack = smoothstep(0.06, 0.0, W.f2 - W.f1);
        mix(dark, light, m, c);
        mix(c, lichen, smoothstep(0.6, 0.8, n.fbm(u, v, 10, 3) * 0.5 + 0.5) * 0.6, c);
        const s = 1 - crack * 0.55;
        c[0] *= s; c[1] *= s; c[2] *= s;
        return { h: clamp01(m * 0.8 + W.f1 * 0.3 - crack * 0.6) };
      });
    }

    case "stone_ruins":
    case "mossy_stone": {
      const rows = 4;
      const mortar: RGB = [70, 66, 58], stoneA: RGB = [138, 130, 114], stoneB: RGB = [112, 108, 98],
        moss: RGB = [64, 92, 40];
      const mossy = kind === "mossy_stone";
      return synth(size, 3.5, false, (u, v, _x, _y, c) => {
        const row = Math.floor(v * rows);
        const fy = v * rows - row;
        const cols = 2;
        const shift = (row % 2) * 0.5;
        const bx = u * cols + shift;
        const col = Math.floor(bx);
        const fx = bx - col;
        const edge = Math.min(fx, 1 - fx, (fy) * 0.5, (1 - fy) * 0.5) ;
        const chip = n.fbm(u, v, 16, 3) * 0.04;
        const inBrick = smoothstep(0.015, 0.05, edge + chip);
        const id = n.hash01(((col % cols) + cols) % cols, row);
        const grain = n.fbm(u, v, 12, 4) * 0.5 + 0.5;
        mix(stoneB, stoneA, clamp01(id * 0.7 + grain * 0.5), c);
        mix(mortar, c, inBrick, tmp);
        c[0] = tmp[0]; c[1] = tmp[1]; c[2] = tmp[2];
        const mossAmt = mossy
          ? smoothstep(0.0, 0.4, n.fbm(u, v, 3, 4) + (fy - 0.5) * 0.4)
          : smoothstep(0.35, 0.6, n.fbm(u, v, 4, 4)) * (1 - inBrick * 0.7);
        mix(c, moss, mossAmt * 0.8, c);
        const bevel = smoothstep(0.0, 0.12, edge);
        return { h: clamp01(bevel * 0.7 + grain * 0.25 + mossAmt * 0.1) };
      });
    }

    case "desert_sandstone": {
      const a: RGB = [204, 160, 104], b: RGB = [176, 128, 80], d: RGB = [226, 188, 132];
      return synth(size, 2.4, false, (u, v, _x, _y, c) => {
        const warp = n.fbm(u, v, 2, 3) * 0.08;
        const strata = Math.sin((v + warp) * 10 * Math.PI * 2) * 0.5 + 0.5;
        const pits = n.fbm(u, v, 24, 3) * 0.5 + 0.5;
        mix(b, a, strata, c);
        mix(c, d, smoothstep(0.6, 0.9, pits) * 0.4, c);
        const row = Math.floor(v * 3);
        const fy = v * 3 - row;
        const joint = smoothstep(0.03, 0.0, Math.min(fy, 1 - fy));
        const s = 1 - joint * 0.4;
        c[0] *= s; c[1] *= s; c[2] *= s;
        return { h: clamp01(strata * 0.4 + pits * 0.4 - joint * 0.5) };
      });
    }

    case "watchtower_timber": {
      const planks = 4;
      const dark: RGB = [78, 52, 30], light: RGB = [138, 98, 60];
      return synth(size, 2.4, false, (u, v, _x, _y, c) => {
        const p = Math.floor(u * planks);
        const fx = u * planks - p;
        const id = n.hash01(p, 3);
        const warp = n.fbm(u, v, 4, 3) * 0.6;
        const grain = Math.sin((fx * 6 + warp + id * 4) * Math.PI * 2 + n.fbmA(u, v, 2, 8, 2) * 3) * 0.5 + 0.5;
        mix(dark, light, clamp01(grain * 0.6 + id * 0.4), c);
        n.worley(u, v, 5, W);
        const knot = smoothstep(0.12, 0.0, W.f1) * (W.id > 0.6 ? 1 : 0);
        const gap = smoothstep(0.05, 0.0, Math.min(fx, 1 - fx));
        const s = 1 - gap * 0.7 - knot * 0.35;
        c[0] *= s; c[1] *= s; c[2] *= s;
        return { h: clamp01(0.6 + grain * 0.25 - gap * 0.6 - knot * 0.2) };
      });
    }

    case "bark_timber": {
      const dark: RGB = [52, 38, 26], mid: RGB = [96, 74, 52], light: RGB = [128, 108, 84];
      return synth(size, 4.0, false, (u, v, _x, _y, c) => {
        // Stretch vertically: high frequency across U, low along V.
        const warp = n.fbm(u, v, 2, 2) * 0.2;
        const furrow = n.ridgedA(u + warp, v, 16, 2, 3);
        const plates = n.fbm(u, v, 8, 3) * 0.5 + 0.5;
        mix(dark, mid, furrow, c);
        mix(c, light, smoothstep(0.7, 1, furrow) * plates * 0.6, c);
        const lichen = smoothstep(0.65, 0.8, n.fbm(u, v, 5, 3) * 0.5 + 0.5);
        mix(c, [96, 110, 70], lichen * 0.5, c);
        return { h: clamp01(furrow * 0.85 + plates * 0.15) };
      });
    }

    case "foliage_canopy": {
      const deep: RGB = [22, 48, 18], mid: RGB = [48, 88, 30], lit: RGB = [96, 132, 46];
      return synth(size, 3.0, false, (u, v, _x, _y, c) => {
        n.worley(u, v, 20, W);
        n.worley(u + 0.37, v + 0.21, 32, W2);
        const leaf = Math.max(smoothstep(0.5, 0.15, W.f1), smoothstep(0.45, 0.1, W2.f1) * 0.8);
        const tone = (W.id + W2.id) * 0.5;
        mix(deep, mid, leaf, c);
        mix(c, lit, smoothstep(0.5, 1, tone) * leaf * 0.7, c);
        return { h: leaf };
      });
    }

    case "iron_metal": {
      const a: RGB = [82, 86, 94], b: RGB = [124, 128, 138], rust: RGB = [120, 70, 40];
      return synth(size, 1.4, false, (u, v, _x, _y, c) => {
        const brush = n.fbmA(u, v, 4, 64, 2) * 0.5 + 0.5;
        const mottle = n.fbm(u, v, 4, 4) * 0.5 + 0.5;
        mix(a, b, brush * 0.5 + mottle * 0.5, c);
        mix(c, rust, smoothstep(0.68, 0.85, n.fbm(u, v, 6, 4) * 0.5 + 0.5) * 0.7, c);
        return { h: brush * 0.3 + mottle * 0.2 };
      });
    }

    case "roof_thatch": {
      const dark: RGB = [96, 76, 40], light: RGB = [170, 140, 80];
      return synth(size, 3.0, false, (u, v, _x, _y, c) => {
        const straw = n.ridgedA(u, v, 48, 3, 2);
        const rows = 6;
        const fy = v * rows - Math.floor(v * rows);
        const layer = smoothstep(0.0, 0.25, fy);
        mix(dark, light, straw * 0.7 + layer * 0.3, c);
        return { h: clamp01(straw * 0.5 + layer * 0.5) };
      });
    }

    case "plaster": {
      const a: RGB = [214, 204, 180], b: RGB = [184, 172, 148];
      return synth(size, 1.2, false, (u, v, _x, _y, c) => {
        const m = n.fbm(u, v, 6, 5) * 0.5 + 0.5;
        mix(b, a, m, c);
        const stain = smoothstep(0.55, 0.9, n.fbmA(u, v, 3, 2, 3) * 0.5 + 0.5 + Math.sin(v * Math.PI * 2) * 0.15);
        const s = 1 - stain * 0.18;
        c[0] *= s; c[1] *= s; c[2] *= s;
        return { h: m };
      });
    }

    case "leaf_card": {
      // A cluster of leaves on transparent background (for foliage cards).
      const dark: RGB = [30, 62, 22], mid: RGB = [62, 104, 36], lit: RGB = [118, 150, 56];
      return synth(size, 2.0, true, (u, v, _x, _y, c) => {
        // Radial falloff so the cluster reads as a rounded clump, not a square.
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy) * 2;
        n.worley(u, v, 12, W);
        n.worley(u + 0.5, v + 0.31, 17, W2);
        const leafShape = Math.max(smoothstep(0.62, 0.42, W.f1), smoothstep(0.58, 0.40, W2.f1));
        const edgeNoise = n.fbm(u, v, 6, 3) * 0.25;
        const inside = smoothstep(1.0, 0.75, r + edgeNoise);
        const a = leafShape * inside > 0.5 ? 1 : 0;
        const vein = 1 - smoothstep(0.0, 0.05, Math.abs(W.f1 - W.f2) * 0.5 - 0.05);
        mix(dark, mid, W.id, c);
        mix(c, lit, clamp01((1 - r) * 0.6 + W.id * 0.3), c);
        const s = 1 - vein * 0.08 - (1 - leafShape) * 0.12;
        c[0] *= s; c[1] *= s; c[2] *= s;
        if (!a) { c[0] = 0; c[1] = 0; c[2] = 0; }
        return { h: leafShape, a };
      });
    }

    case "palm_frond": {
      // Feather frond along V: central rib with angled leaflets tapering to the tip.
      const dark: RGB = [40, 70, 24], lit: RGB = [104, 136, 48], rib: RGB = [128, 120, 66];
      return synth(size, 1.5, true, (u, v, _x, _y, c) => {
        const along = v;                 // 0 base → 1 tip
        const across = (u - 0.5) * 2;    // −1 … 1
        const halfWidth = 0.95 * Math.sin(Math.PI * Math.min(1, along * 1.05)) * (1 - along * 0.35);
        const leaflet = Math.abs(across) < halfWidth
          ? (Math.sin((along * 16 - Math.abs(across) * 2.2) * Math.PI * 2) > 0.05 ? 1 : 0)
          : 0;
        const onRib = Math.abs(across) < 0.04 ? 1 : 0;
        const a = Math.max(leaflet, onRib * (along < 0.98 ? 1 : 0));
        mix(dark, lit, clamp01(0.3 + Math.abs(across) * 0.6 + n.fbm(u, v, 8, 2) * 0.2), c);
        if (onRib) mix(c, rib, 0.8, c);
        if (!a) { c[0] = 0; c[1] = 0; c[2] = 0; }
        return { h: a * (1 - Math.abs(across) * 0.5), a };
      });
    }

    case "grass_blades": {
      // Vertical tapering blades, bottom-rooted (v = 1 is the ground row).
      const root: RGB = [34, 56, 20], tip: RGB = [108, 138, 52];
      const blades = 20;
      return synth(size, 1.0, true, (u, v, _x, _y, c) => {
        const h = 1 - v; // 0 at ground row, 1 at the top
        let a = 0;
        let tone = 0;
        for (let k = 0; k < 4; k++) {
          const bx = u * blades + k * 0.27;
          const bi = Math.floor(bx);
          const id = n.hash01(((bi % blades) + blades) % blades, k);
          const bladeH = 0.45 + id * 0.55;
          if (h > bladeH) continue;
          const lean = (id - 0.5) * 0.6 * h * h;
          const fx = bx - bi - 0.5 - lean;
          const width = 0.18 + 0.28 * (1 - h / bladeH) - (h > bladeH * 0.9 ? 0.12 : 0);
          if (Math.abs(fx) < width) { a = 1; tone = id; break; }
        }
        mix(root, tip, clamp01(h * 1.2), c);
        const s = 0.8 + tone * 0.35;
        c[0] *= s; c[1] *= s; c[2] *= s;
        if (!a) { c[0] = 0; c[1] = 0; c[2] = 0; }
        return { h: h * a, a };
      });
    }
  }
}
