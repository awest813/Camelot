import { animateMini, type DOMKeyframesDefinition } from "motion";

export interface UIAnimatorOptions {
  /**
   * When true, all animations are skipped and callbacks fire immediately.
   * Useful for tests and for honouring `prefers-reduced-motion`.
   * When omitted the class auto-detects via `window.matchMedia`.
   */
  reducedMotion?: boolean;
}

/**
 * UIAnimator — lightweight wrapper around the Motion library that provides
 * consistent entrance / exit animations for HTML overlay panels.
 *
 * Usage (runtime):
 * ```ts
 * const animator = new UIAnimator();
 * levelUpUI.setAnimator(animator);
 * ```
 *
 * The animator is designed so that existing open/close logic in UI classes
 * is unchanged when no animator is attached.  When an animator is attached:
 *  - `panelIn`  is called right after the element's `display` has been set.
 *  - `panelOut` is called before hiding; it invokes `done` once the exit
 *    animation completes so the caller can then set `display: none`.
 */
export class UIAnimator {
  private readonly _reducedMotion: boolean;

  constructor(options: UIAnimatorOptions = {}) {
    if (options.reducedMotion !== undefined) {
      this._reducedMotion = options.reducedMotion;
    } else {
      this._reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    }
  }

  /**
   * Animate a panel element into view.
   * The caller must have already set the element's `display` value.
   */
  public panelIn(element: HTMLElement): void {
    if (this._reducedMotion) return;
    const keyframes: DOMKeyframesDefinition = { opacity: [0, 1], y: [10, 0], scale: [0.97, 1] };
    animateMini(element, keyframes, { duration: 0.22, ease: [0.22, 1, 0.36, 1] });
  }

  /**
   * Animate a panel element out and invoke `done` when the animation finishes.
   * The caller should hide / remove the element inside the `done` callback.
   * When `reducedMotion` is true, `done` is called synchronously.
   */
  public panelOut(element: HTMLElement, done: () => void): void {
    if (this._reducedMotion) {
      done();
      return;
    }
    const keyframes: DOMKeyframesDefinition = { opacity: [1, 0], y: [0, 6], scale: [1, 0.97] };
    animateMini(element, keyframes, { duration: 0.16, ease: [0.4, 0, 1, 1] }).then(done);
  }
}
