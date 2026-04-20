import { $, $N } from "@mathigon/boost";
import type { ElementView } from "@mathigon/boost";
import DOMPurify from "dompurify";

// ── Duration constants ────────────────────────────────────────────────────────

/** Default fade-in duration in milliseconds. */
export const FADE_IN_DURATION_MS = 300;
/** Default fade-out duration in milliseconds. */
export const FADE_OUT_DURATION_MS = 200;

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
 *
 * 3. **sanitizeHtml** — thin wrapper around DOMPurify.sanitize().  Call this
 *    before assigning any user- or mod-supplied string to `innerHTML`.  The
 *    function is a no-op in environments where DOMPurify is unavailable
 *    (e.g. SSR) and returns the original string, so callers never have to
 *    guard against a missing return value.
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
export function boostFadeIn(element: HTMLElement, durationMs = FADE_IN_DURATION_MS): Promise<void> {
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
export function boostFadeOut(element: HTMLElement, durationMs = FADE_OUT_DURATION_MS): Promise<void> {
  const view = $(element) as ElementView | undefined;
  if (!view) return Promise.resolve();
  return view.exit("fade", durationMs).promise;
}

// ── HTML sanitization ─────────────────────────────────────────────────────────

/**
 * Sanitizes an HTML string using DOMPurify before it is written to
 * `innerHTML`.  Always call this function when the HTML content originates
 * from user input, mod data, or any other untrusted source.
 *
 * - Strips `<script>` tags, `javascript:` URIs, and inline event handlers.
 * - Preserves safe structural tags (`<span>`, `<strong>`, `<em>`, etc.) and
 *   inline `style` attributes, so formatted UI snippets survive unmodified.
 * - Falls back to returning the original string in environments where
 *   DOMPurify is unavailable (e.g. non-browser SSR contexts), so callers
 *   do not need to guard the return value.
 *
 * @example
 * element.innerHTML = sanitizeHtml(modSuppliedDescription);
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof DOMPurify.sanitize !== "function") return dirty;
  return DOMPurify.sanitize(dirty);
}
