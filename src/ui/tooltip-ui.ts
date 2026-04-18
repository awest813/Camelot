/**
 * TooltipUI — lightweight HTML tooltip system.
 *
 * Attach a tooltip to any DOM element so contextual help text appears after a
 * short hover delay.  Used across the game UI for attribute descriptions,
 * skill names, item details, and editor controls.
 *
 * Usage:
 * ```ts
 * const tips = new TooltipUI();
 * tips.attach(strengthBtn, "Governs melee damage and carry weight.");
 * tips.attach(agilityBtn, "Governs ranged accuracy and sneak.");
 * // Later, when the UI is destroyed:
 * tips.detachAll();
 * ```
 *
 * The tooltip element is appended to `document.body` and positioned via
 * `position: fixed` relative to the hovered element.  Positioning is handled
 * by `@floating-ui/dom` with flip, shift, and offset middleware so the tooltip
 * automatically avoids viewport edges, scroll containers, and transforms.
 */

import { computePosition, flip, shift, offset } from "@floating-ui/dom";

/** Options accepted by `TooltipUI` constructor. */
export interface TooltipOptions {
  /** Milliseconds to wait after mouseenter before showing the tooltip. Default: 220. */
  showDelay?: number;
  /** Milliseconds to wait after mouseleave before hiding the tooltip.  Default: 80. */
  hideDelay?: number;
}

interface AttachedTooltip {
  content: string;
  onEnter: (e: MouseEvent) => void;
  onLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

export class TooltipUI {
  private readonly _showDelay: number;
  private readonly _hideDelay: number;

  private _tooltipEl: HTMLDivElement | null = null;
  private _showTimer: ReturnType<typeof setTimeout> | null = null;
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;

  /** Elements that currently have a tooltip attached. */
  private readonly _attached: Map<Element, AttachedTooltip> = new Map();

  /** The element whose tooltip is currently visible (or null). */
  private _activeTarget: Element | null = null;

  constructor(opts: TooltipOptions = {}) {
    this._showDelay = opts.showDelay ?? 220;
    this._hideDelay = opts.hideDelay ?? 80;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Attach a tooltip to `element` with the given `content` text.
   * If `element` already has a tooltip attached its content is replaced.
   */
  public attach(element: Element, content: string): void {
    if (typeof document === "undefined") return;

    // Replace existing attachment.
    if (this._attached.has(element)) {
      this.detach(element);
    }

    const onEnter = (e: MouseEvent) => this._scheduleShow(element, content, e);
    const onLeave = () => this._scheduleHide();
    const onFocus = () => this._scheduleShow(element, content, null);
    const onBlur  = () => this._scheduleHide();

    element.addEventListener("mouseenter", onEnter as EventListener);
    element.addEventListener("mouseleave", onLeave);
    element.addEventListener("focus", onFocus);
    element.addEventListener("blur", onBlur);

    this._attached.set(element, { content, onEnter, onLeave, onFocus, onBlur });

    // Mark element with aria-describedby pointing at the singleton tooltip.
    this._ensureDom();
    if (!this._tooltipEl) return;
    const id = this._tooltipEl.id;
    element.setAttribute("aria-describedby", id);
  }

  /**
   * Remove the tooltip from `element`.
   * Hides immediately if `element` is the currently active target.
   */
  public detach(element: Element): void {
    const entry = this._attached.get(element);
    if (!entry) return;

    element.removeEventListener("mouseenter", entry.onEnter as EventListener);
    element.removeEventListener("mouseleave", entry.onLeave);
    element.removeEventListener("focus", entry.onFocus);
    element.removeEventListener("blur", entry.onBlur);
    element.removeAttribute("aria-describedby");

    this._attached.delete(element);

    if (this._activeTarget === element) {
      this._cancelTimers();
      this._hide();
    }
  }

  /** Remove tooltips from every attached element and destroy the tooltip DOM node. */
  public detachAll(): void {
    for (const el of Array.from(this._attached.keys())) {
      this.detach(el);
    }
    this._cancelTimers();
    this._tooltipEl?.remove();
    this._tooltipEl = null;
  }

  /**
   * Update the content of an already-attached tooltip.
   * Refreshes live content if the tooltip is currently visible for that element.
   */
  public updateContent(element: Element, content: string): void {
    const entry = this._attached.get(element);
    if (!entry) return;
    entry.content = content;
    if (this._activeTarget === element && this._tooltipEl) {
      this._tooltipEl.textContent = content;
    }
  }

  /** Number of elements that currently have a tooltip attached. */
  public get attachedCount(): number {
    return this._attached.size;
  }

  /** Whether the tooltip is currently visible. */
  public get isVisible(): boolean {
    return this._activeTarget !== null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._tooltipEl || typeof document === "undefined") return;

    const el = document.createElement("div");
    el.id = "camelot-tooltip";
    el.className = "tooltip";
    el.setAttribute("role", "tooltip");
    el.setAttribute("aria-live", "polite");
    el.style.position = "fixed";
    el.style.pointerEvents = "none";
    el.style.zIndex = "99999";
    // Start hidden.
    el.style.display = "none";
    document.body.appendChild(el);
    this._tooltipEl = el;
  }

  private _scheduleShow(target: Element, content: string, event: MouseEvent | null): void {
    this._cancelTimers();
    this._hideTimer = null;
    this._showTimer = setTimeout(() => {
      this._activeTarget = target;
      this._showContent(content, target, event);
    }, this._showDelay);
  }

  private _scheduleHide(): void {
    this._cancelTimers();
    this._hideTimer = setTimeout(() => {
      this._hide();
    }, this._hideDelay);
  }

  private _showContent(content: string, target: Element, _event: MouseEvent | null): void {
    this._ensureDom();
    if (!this._tooltipEl) return;

    this._tooltipEl.textContent = content;
    this._tooltipEl.style.display = "block";
    this._tooltipEl.classList.add("tooltip--visible");

    this._position(target);
  }

  private _hide(): void {
    if (!this._tooltipEl) return;
    this._tooltipEl.classList.remove("tooltip--visible");
    this._tooltipEl.style.display = "none";
    this._activeTarget = null;
  }

  /**
   * Position the tooltip relative to the reference element using floating-ui.
   * Uses flip (try opposite side), shift (slide along axis), and offset
   * middleware so the tooltip stays visible regardless of viewport edges,
   * scroll containers, or CSS transforms.
   */
  private _position(target: Element): void {
    if (!this._tooltipEl) return;

    const tooltip = this._tooltipEl;

    computePosition(target as HTMLElement, tooltip, {
      placement: "bottom",
      middleware: [
        offset(10),
        flip(),
        shift({ padding: 10 }),
      ],
    }).then(({ x, y }) => {
      tooltip.style.left = `${x}px`;
      tooltip.style.top  = `${y}px`;
    });
  }

  private _cancelTimers(): void {
    if (this._showTimer !== null) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
  }
}
