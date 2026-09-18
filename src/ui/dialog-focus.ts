/**
 * Dialog focus management — trap + restore for modal overlays.
 *
 * `manageDialogFocus(container)` captures the currently focused element,
 * moves focus into the dialog (when it isn't already inside), and installs a
 * capture-phase Tab trap that cycles focus within the dialog.  Call
 * `release()` when the dialog closes to remove the trap and restore focus.
 *
 * Conventions (match the close-callback pattern):
 * - Call it at the END of `open()` / `show()` so panel-specific focus
 *   (e.g. first-button focus) wins — the helper only moves focus when it is
 *   currently outside the container.
 * - Call `release()` in `close()` / `hide()` / `destroy()` (null-safe).
 * - At most one session per panel: guard with `if (!this._focusSession)`.
 *
 * Escape handling is intentionally out of scope — Escape stays owned by the
 * editor-hub listener and the game cascade.
 *
 * Limitations: no visibility filtering (jsdom has no layout), so focusables
 * inside `display: none` subsections are still tab stops.  Keep inactive
 * wizard steps free of tab stops or accept the minor quirk.
 */

export interface DialogFocusSession {
  /** Remove the Tab trap and restore the previously focused element. */
  release(): void;
}

/** Selectors for natively focusable / focus-marked elements. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

/** Live query of tab stops inside a container (document order). */
export function queryDialogTabStops(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
}

/**
 * Begin a focus session for an open dialog.
 * SSR-safe: returns a no-op session when `document` is absent.
 */
export function manageDialogFocus(container: HTMLElement): DialogFocusSession {
  if (typeof document === "undefined") {
    return { release() {} };
  }
  const doc = container.ownerDocument ?? document;
  const previous = doc.activeElement as HTMLElement | null;

  // Move focus inside only when it is currently outside the dialog, so
  // panel-specific focus set earlier in open() is preserved.
  if (!container.contains(doc.activeElement)) {
    if (container.tabIndex < 0) container.tabIndex = -1;
    try {
      container.focus({ preventScroll: true });
    } catch {
      container.focus();
    }
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== "Tab") return;
    const stops = queryDialogTabStops(container);
    if (stops.length === 0) {
      e.preventDefault();
      return;
    }
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = doc.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  doc.addEventListener("keydown", onKeyDown, true);

  let released = false;
  return {
    release(): void {
      if (released) return;
      released = true;
      doc.removeEventListener("keydown", onKeyDown, true);
      try {
        previous?.focus?.({ preventScroll: true });
      } catch {
        try {
          previous?.focus?.();
        } catch {
          /* ignored — opener may be detached */
        }
      }
    },
  };
}
