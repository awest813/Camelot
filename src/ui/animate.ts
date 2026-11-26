/**
 * Panel animations with the browser's own Web Animations API (it replaced
 * the Motion library: about 19 KB less in the game's start-up code).
 *
 * Keyframes use the same shape as before: per property, a [from, to] pair,
 * with `y` (px) and `scale` animated through the individual `translate` and
 * `scale` CSS properties, so a panel's own `transform` (centring) is left
 * alone.
 */
export interface PanelKeyframes {
  opacity?: [number, number];
  /** Vertical offset in px. */
  y?: [number, number];
  scale?: [number, number];
}

export interface PanelAnimationOptions {
  /** Seconds. */
  duration: number;
  /** Seconds. */
  delay?: number;
  /** Cubic-bezier control points. */
  ease?: [number, number, number, number];
}

/** Animate `el`; resolves when done (at once where the API is missing). */
export function animateEl(el: Element, keyframes: PanelKeyframes, options: PanelAnimationOptions): Promise<void> {
  if (typeof (el as HTMLElement).animate !== "function") return Promise.resolve();
  const frame = (i: 0 | 1): Keyframe => {
    const k: Keyframe = {};
    if (keyframes.opacity) k.opacity = keyframes.opacity[i];
    if (keyframes.y) k.translate = `0 ${keyframes.y[i]}px`;
    if (keyframes.scale) k.scale = String(keyframes.scale[i]);
    return k;
  };
  const anim = (el as HTMLElement).animate([frame(0), frame(1)], {
    duration: options.duration * 1000,
    delay: (options.delay ?? 0) * 1000,
    easing: options.ease ? `cubic-bezier(${options.ease.join(", ")})` : "ease",
    fill: "backwards",
  });
  return anim.finished.then(() => undefined, () => undefined);
}
