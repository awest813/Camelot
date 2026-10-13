/**
 * atmosphere — time-of-day model for sun, moon, sky, ambient light and fog.
 *
 * Pure math (no Babylon imports) so the whole day/night curve is unit-tested.
 * `AtmosphereController` (sky-dome.ts) feeds the resulting state into the
 * scene's lights, fog, and the procedural sky shader every frame.
 *
 * Conventions: +Y up.  The sun rises in the east (+X), crosses the southern
 * sky (−Z) and sets in the west (−X).  Sunrise 06:00, sunset 20:00 to match
 * TimeSystem's canonical hours.
 */

export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

export interface AtmosphereState {
  /** Unit vector from the ground toward the sun. */
  sunDir: Vec3;
  /** Unit vector from the ground toward the moon. */
  moonDir: Vec3;
  /** Sun elevation above the horizon in radians (negative below). */
  sunElevation: number;
  /**
   * Unit vector the directional light travels along (toward the ground).
   * Follows the sun by day and the moon by night, so moonlit scenes still
   * get soft directional light and shadows.
   */
  lightDir: Vec3;
  /** Directional light colour (linear-ish RGB, [0, 1]). */
  lightColor: RGB;
  /** Directional light intensity multiplier [0, 1] (before weather). */
  lightIntensity: number;
  /** Hemispheric sky colour and its intensity multiplier. */
  ambientSky: RGB;
  ambientGround: RGB;
  ambientIntensity: number;
  /** Sky gradient colours for the sky shader. */
  zenith: RGB;
  horizon: RGB;
  /** Fog colour — equals the sky horizon so distant geometry melts into it. */
  fog: RGB;
  /** Warm glow colour around the sun near the horizon. */
  sunGlow: RGB;
  /** Sun disc colour (HDR — values >1 feed bloom). */
  sunDisc: RGB;
  /** Star visibility [0, 1]. */
  stars: number;
  /** Suggested camera exposure multiplier (eyes adapt at night). */
  exposure: number;
}

const DEG = Math.PI / 180;
const SUNRISE = 6;
const SUNSET = 20;
const MAX_SUN_ELEVATION = 62 * DEG;
const MAX_MOON_ELEVATION = 48 * DEG;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Direction toward a body on an east→south→west arc; `t` ∈ [0, 1] across the arc. */
function arcDirection(t: number, maxElevation: number, out: Vec3): number {
  const elevation = Math.sin(Math.PI * t) * maxElevation;
  // Azimuth swings from east (+X) through south (−Z) to west (−X).
  const az = Math.PI * t;
  const ce = Math.cos(elevation);
  out[0] = Math.cos(az) * ce;
  out[1] = Math.sin(elevation);
  out[2] = -Math.sin(az) * ce * 0.85 - 0.15 * ce;
  const len = Math.hypot(out[0], out[1], out[2]);
  out[0] /= len; out[1] /= len; out[2] /= len;
  return elevation;
}

/**
 * Sun direction for an hour of day (0–24, fractional).  Outside daylight
 * hours the sun continues below the horizon so dawn/dusk transitions are
 * continuous.
 */
export function sunDirection(hour: number): { dir: Vec3; elevation: number } {
  const dir: Vec3 = [0, 0, 0];
  const h = ((hour % 24) + 24) % 24;
  const dayLen = SUNSET - SUNRISE;
  let t = (h - SUNRISE) / dayLen;
  if (t < -0.5) t += 24 / dayLen;
  // Below-horizon portion: mirror the arc downward so elevation goes negative.
  if (t >= 0 && t <= 1) {
    const e = arcDirection(t, MAX_SUN_ELEVATION, dir);
    return { dir, elevation: e };
  }
  const nightLen = 24 - dayLen;
  const nt = t > 1 ? ((t - 1) * dayLen) / nightLen : 1 + (t * dayLen) / nightLen;
  // nt ∈ [0, 1] across the night; sun travels west → north → east below the horizon.
  const elevation = -Math.sin(Math.PI * nt) * 40 * DEG;
  const az = Math.PI + Math.PI * nt;
  const ce = Math.cos(elevation);
  dir[0] = Math.cos(az) * ce;
  dir[1] = Math.sin(elevation);
  dir[2] = -Math.sin(az) * ce;
  return { dir, elevation };
}

/** Moon direction: rises near sunset, highest around 01:00. */
export function moonDirection(hour: number): { dir: Vec3; elevation: number } {
  const dir: Vec3 = [0, 0, 0];
  const h = ((hour % 24) + 24) % 24;
  // Moon arc from 19:00 to 07:00 (12 h), wrapping midnight.
  const rel = (h - 19 + 24) % 24;
  if (rel <= 12) {
    const e = arcDirection(rel / 12, MAX_MOON_ELEVATION, dir);
    return { dir, elevation: e };
  }
  dir[0] = 0; dir[1] = -1; dir[2] = 0;
  return { dir, elevation: -Math.PI / 2 };
}

// Palette keyed by sun elevation.
const ZENITH_DAY: RGB = [0.13, 0.32, 0.74];
const ZENITH_DUSK: RGB = [0.20, 0.24, 0.46];
const ZENITH_NIGHT: RGB = [0.012, 0.02, 0.05];
const HORIZON_DAY: RGB = [0.60, 0.73, 0.88];
const HORIZON_DUSK: RGB = [0.96, 0.58, 0.36];
const HORIZON_NIGHT: RGB = [0.04, 0.06, 0.11];
const SUN_HIGH: RGB = [1.0, 0.96, 0.88];
const SUN_LOW: RGB = [1.0, 0.62, 0.34];
const MOON_LIGHT: RGB = [0.55, 0.66, 0.92];
const AMB_SKY_DAY: RGB = [0.62, 0.72, 0.88];
const AMB_SKY_DUSK: RGB = [0.72, 0.56, 0.54];
const AMB_SKY_NIGHT: RGB = [0.30, 0.38, 0.62];
const AMB_GROUND_DAY: RGB = [0.44, 0.39, 0.30];
const AMB_GROUND_NIGHT: RGB = [0.08, 0.09, 0.13];

/**
 * Full atmosphere state for an hour of day.
 *
 * @param cloudiness  0 (clear) … 1 (storm).  Desaturates the sky toward grey,
 *                    mutes the sun glow and hides stars.
 */
export function computeAtmosphere(hour: number, cloudiness = 0): AtmosphereState {
  const sun = sunDirection(hour);
  const moon = moonDirection(hour);
  const e = sun.elevation;
  const c = clamp01(cloudiness);

  // 0 = full night, 1 = full day.  Twilight spans −8° … +12°.
  const day = smoothstep(-8 * DEG, 12 * DEG, e);
  // Peaks while the sun is near the horizon.
  const dusk = smoothstep(-10 * DEG, 0, e) * (1 - smoothstep(4 * DEG, 22 * DEG, e));

  let zenith = mixRGB(ZENITH_NIGHT, ZENITH_DAY, day);
  zenith = mixRGB(zenith, ZENITH_DUSK, dusk * 0.6);
  let horizon = mixRGB(HORIZON_NIGHT, HORIZON_DAY, day);
  horizon = mixRGB(horizon, HORIZON_DUSK, dusk * 0.75);

  // Overcast: pull everything toward a flat grey of matching brightness.
  const lum = (col: RGB) => col[0] * 0.3 + col[1] * 0.55 + col[2] * 0.15;
  const grey = (col: RGB, k: number): RGB => {
    const l = lum(col) * k;
    return [l, l, l * 1.04];
  };
  zenith = mixRGB(zenith, grey(zenith, 1.25), c * 0.85);
  horizon = mixRGB(horizon, grey(horizon, 0.95), c * 0.8);

  const sunUp = smoothstep(-2 * DEG, 6 * DEG, e);
  const moonUp = smoothstep(-2 * DEG, 8 * DEG, moon.elevation) * (1 - day);

  let lightDir: Vec3;
  let lightColor: RGB;
  let lightIntensity: number;
  if (sunUp > 0.001 || moonUp < 0.001) {
    lightDir = [-sun.dir[0], -sun.dir[1], -sun.dir[2]];
    lightColor = mixRGB(SUN_LOW, SUN_HIGH, smoothstep(4 * DEG, 40 * DEG, e));
    lightIntensity = sunUp * (0.55 + 0.45 * smoothstep(0, 45 * DEG, e));
    // Keep the shadow-casting direction sane right at the horizon.
    if (lightDir[1] > -0.12) {
      lightDir[1] = -0.12;
      const l = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);
      lightDir = [lightDir[0] / l, lightDir[1] / l, lightDir[2] / l];
    }
  } else {
    lightDir = [-moon.dir[0], -moon.dir[1], -moon.dir[2]];
    if (lightDir[1] > -0.2) {
      lightDir[1] = -0.2;
      const l = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);
      lightDir = [lightDir[0] / l, lightDir[1] / l, lightDir[2] / l];
    }
    lightColor = MOON_LIGHT;
    lightIntensity = moonUp * 0.34;
  }
  lightIntensity *= 1 - c * 0.75;

  let ambientSky = mixRGB(AMB_SKY_NIGHT, AMB_SKY_DAY, day);
  ambientSky = mixRGB(ambientSky, AMB_SKY_DUSK, dusk * 0.5);
  ambientSky = mixRGB(ambientSky, grey(ambientSky, 1.1), c * 0.7);
  const ambientGround = mixRGB(AMB_GROUND_NIGHT, AMB_GROUND_DAY, day);
  // Overcast skies scatter more light into the shadows.
  const ambientIntensity = lerp(0.42, 1.0, day) * (1 + c * 0.25);

  const sunGlow = mixRGB([1.0, 0.85, 0.6], [1.0, 0.5, 0.25], dusk);
  const discBoost = 18 * sunUp * (1 - c * 0.92);
  const sunDisc: RGB = [lightColor[0] * discBoost, lightColor[1] * discBoost, lightColor[2] * discBoost];

  return {
    sunDir: sun.dir,
    moonDir: moon.dir,
    sunElevation: e,
    lightDir,
    lightColor,
    lightIntensity,
    ambientSky,
    ambientGround,
    ambientIntensity,
    zenith,
    horizon,
    fog: [horizon[0], horizon[1], horizon[2]],
    sunGlow,
    sunDisc,
    stars: (1 - smoothstep(-14 * DEG, -2 * DEG, e)) * (1 - c),
    exposure: lerp(1.6, 1.0, day),
  };
}

/** Cloudiness [0, 1] implied by each weather state. */
export const WEATHER_CLOUDINESS: Record<string, number> = {
  clear: 0.15,
  overcast: 0.7,
  foggy: 0.6,
  rain: 0.85,
  storm: 1.0,
};
