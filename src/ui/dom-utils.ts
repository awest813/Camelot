import { $, $N } from "@mathigon/boost";
import type { ElementView } from "@mathigon/boost";

/**
 * dom-utils — thin wrappers around Boost.js that keep the rest of the
 * codebase using plain `HTMLElement` references.
 *
 * Two complementary capabilities are exposed:
 *
 * 1. **makeEl** — creates DOM elements with a single call instead of the
 *    three-step `createElement → setAttribute → append` pattern.  Under the
 *    hood it delegates to Boost.js's `$N()` which handles `class`, `id`,
 *    `text`, `html` and any other attribute in one object literal.
 *
 * 2. **boostFadeIn / boostFadeOut** — CSS-powered fade transitions via
 *    Boost.js's `enter('fade')` / `exit('fade')`.  These complement the
 *    spring-based Motion animations in `UIAnimator` and can be used anywhere
 *    a Promise-based fade is more convenient than a callback.
 *
 * ⚠️  The `compile` and `evaluate` exports from `@mathigon/boost` are NOT
 * used here; they carry an active security notice in the upstream library.
 */

// ── Element creation ──────────────────────────────────────────────────────────

/**
 * Creates a new HTML element using Boost.js's `$N()` and returns the
 * underlying raw `HTMLElement` for compatibility with the rest of the
 * codebase.
 *
 * The `attrs` object mirrors Boost.js's attribute bag:
 *  - `class`  → `className`
 *  - `text`   → `textContent`
 *  - `html`   → `innerHTML`
 *  - any other key is set as an HTML attribute via `setAttribute()`
 *
 * @example
 * const panel = makeEl("section", { class: "my-panel", role: "dialog" });
 * const btn   = makeEl("button", { class: "btn", text: "OK" }, panel);
 */
export function makeEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, unknown>,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const parentView = parent !== undefined ? ($(parent) as ElementView) : undefined;
  const view = $N(tag as string, attrs, parentView);
  return view._el as unknown as HTMLElementTagNameMap[K];
}

// ── Fade animations ───────────────────────────────────────────────────────────

/**
 * Fades an element into view using Boost.js's built-in `enter('fade')`
 * transition.  The element's `display` must already be set to the desired
 * value before calling this.
 *
 * @returns A `Promise` that resolves when the transition finishes.
 */
export function boostFadeIn(element: HTMLElement, durationMs = 300): Promise<void> {
  const view = $(element) as ElementView | undefined;
  if (!view) return Promise.resolve();
  return view.enter("fade", durationMs).promise;
}

/**
 * Fades an element out of view using Boost.js's built-in `exit('fade')`
 * transition.  The caller is responsible for hiding the element inside
 * the `.then()` handler (or with `await`).
 *
 * @returns A `Promise` that resolves when the transition finishes.
 */
export function boostFadeOut(element: HTMLElement, durationMs = 200): Promise<void> {
  const view = $(element) as ElementView | undefined;
  if (!view) return Promise.resolve();
  return view.exit("fade", durationMs).promise;
}
