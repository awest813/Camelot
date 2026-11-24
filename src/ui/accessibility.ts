/**
 * Accessibility preferences: interface scale and reduced motion.  Kept in
 * the browser (not the save), applied to the page as soon as they load:
 *   - `--ui-scale` on <html>; every UI root (each child of <body> but the
 *     game canvas) is zoomed by it, so the 3D view keeps its resolution;
 *   - the `reduce-motion` class on <html>, which stops CSS animations and
 *     transitions, and is read by the screen flash, camera shake and the
 *     panel animator.
 * Reduced motion follows the system setting until the player chooses.
 *
 * Engine overhaul, Phase 8 (accessibility pass).
 */

export const UI_SCALES = [0.85, 1, 1.25, 1.5] as const;
export type UiScale = (typeof UI_SCALES)[number];

export interface AccessibilityPrefs {
  uiScale: UiScale;
  reduceMotion: boolean;
}

const STORAGE_KEY = "camelot.accessibility";

const systemReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

export function defaultPrefs(): AccessibilityPrefs {
  return { uiScale: 1, reduceMotion: systemReducedMotion() };
}

/** Saved preferences, with anything missing or invalid at its default. */
export function loadPrefs(): AccessibilityPrefs {
  const prefs = defaultPrefs();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<AccessibilityPrefs> | null;
    if (raw && (UI_SCALES as readonly number[]).includes(raw.uiScale as number)) prefs.uiScale = raw.uiScale as UiScale;
    if (raw && typeof raw.reduceMotion === "boolean") prefs.reduceMotion = raw.reduceMotion;
  } catch {
    // No storage (private window, tests): defaults.
  }
  return prefs;
}

export function savePrefs(prefs: AccessibilityPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Not kept, but still applied for this session.
  }
}

let current: AccessibilityPrefs = { uiScale: 1, reduceMotion: false };

/** Apply preferences to the page. */
export function applyPrefs(prefs: AccessibilityPrefs): void {
  current = { ...prefs };
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.style.setProperty("--ui-scale", String(prefs.uiScale));
  html.classList.toggle("reduce-motion", prefs.reduceMotion);
}

/** The preferences in effect. */
export function currentPrefs(): AccessibilityPrefs {
  return { ...current };
}

/** The interface scale in effect (page coordinates ÷ this = UI coordinates). */
export function uiScale(): number {
  return current.uiScale;
}

/** Whether to hold back motion: screen flashes, camera shake, panel animations. */
export function reducedMotion(): boolean {
  return current.reduceMotion;
}
