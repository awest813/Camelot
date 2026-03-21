import type { ActiveEffect, ActiveEffectType } from "../systems/active-effects-system";

// ── Effect-type display metadata ───────────────────────────────────────────────

interface EffectMeta {
  icon: string;
  /** CSS class suffix applied to the pill for color-coding. */
  colorKey: string;
}

const EFFECT_META: Record<ActiveEffectType, EffectMeta> = {
  health_restore:   { icon: "❤",  colorKey: "heal"    },
  magicka_restore:  { icon: "✦",  colorKey: "magicka" },
  stamina_restore:  { icon: "⚡",  colorKey: "stamina" },
  fortify_health:   { icon: "🛡",  colorKey: "fortify" },
  fortify_magicka:  { icon: "🔮",  colorKey: "fortify" },
  fortify_strength: { icon: "💪",  colorKey: "fortify" },
  resist_damage:    { icon: "🔰",  colorKey: "fortify" },
  fire_damage:      { icon: "🔥",  colorKey: "harm"    },
  frost_damage:     { icon: "❄",   colorKey: "harm"    },
  shock_damage:     { icon: "⚡",  colorKey: "harm"    },
  silence:          { icon: "🔇",  colorKey: "harm"    },
  burden:           { icon: "⚖",   colorKey: "harm"    },
};

// ── Helper ─────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!isFinite(seconds)) return "∞";
  const s = Math.ceil(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

// ── ActiveEffectHUD ────────────────────────────────────────────────────────────

/**
 * ActiveEffectHUD — visual HUD strip that renders each currently active
 * magical / alchemical effect as a compact pill.
 *
 * Every pill shows:
 *  • An icon representing the effect category.
 *  • The effect's display name.
 *  • A compact duration countdown.
 *  • A thin progress bar shrinking from full to empty as time elapses.
 *
 * Call `update(effects)` every game-loop tick (or whenever the effects list
 * changes) to keep the display in sync.
 *
 * Wire-up example (game.ts):
 * ```ts
 * this.activeEffectHUD = new ActiveEffectHUD();
 * this.activeEffectHUD.show();
 *
 * // In the render / update loop:
 * this.activeEffectHUD.update(this.activeEffectsSystem.activeEffects);
 * ```
 */
export class ActiveEffectHUD {
  public isVisible: boolean = false;

  private _root: HTMLDivElement | null = null;
  private _strip: HTMLDivElement | null = null;

  /** Cached pill elements keyed by effect id. */
  private readonly _pills: Map<string, {
    pill:      HTMLDivElement;
    label:     HTMLSpanElement;
    countdown: HTMLSpanElement;
    bar:       HTMLDivElement;
  }> = new Map();

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Make the HUD visible. Creates DOM lazily on first call. */
  public show(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (this._root) {
      this._root.style.display = "flex";
    }
    this.isVisible = true;
  }

  /** Hide the HUD without destroying it. */
  public hide(): void {
    if (this._root) {
      this._root.style.display = "none";
    }
    this.isVisible = false;
  }

  /**
   * Synchronise the displayed pills with the current active-effects list.
   *
   * New effects get a pill; effects no longer in the list have their pill
   * removed; existing effects have their countdown and progress bar updated.
   */
  public update(effects: ReadonlyArray<Readonly<ActiveEffect>>): void {
    if (typeof document === "undefined") return;
    if (!this._root) return;

    const liveIds = new Set(effects.map((e) => e.id));

    // Remove pills for effects that are gone.
    for (const [id, entry] of Array.from(this._pills.entries())) {
      if (!liveIds.has(id)) {
        entry.pill.remove();
        this._pills.delete(id);
      }
    }

    // Add or update pills in order.
    for (const effect of effects) {
      if (this._pills.has(effect.id)) {
        this._updatePill(effect);
      } else {
        this._addPill(effect);
      }
    }
  }

  /** Remove all pills and destroy the root DOM element. */
  public destroy(): void {
    this._pills.clear();
    this._root?.remove();
    this._root  = null;
    this._strip = null;
    this.isVisible = false;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "active-effect-hud";
    root.setAttribute("aria-label", "Active effects");
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.style.display = "none";

    const strip = document.createElement("div");
    strip.className = "active-effect-hud__strip";
    root.appendChild(strip);

    document.body.appendChild(root);
    this._root  = root;
    this._strip = strip;
  }

  private _addPill(effect: Readonly<ActiveEffect>): void {
    if (!this._strip) return;

    const meta = EFFECT_META[effect.effectType];

    const pill = document.createElement("div");
    pill.className = `active-effect-hud__pill active-effect-hud__pill--${meta.colorKey}`;
    pill.setAttribute("data-effect-id", effect.id);
    pill.setAttribute("title", effect.name);

    // Icon
    const iconEl = document.createElement("span");
    iconEl.className = "active-effect-hud__icon";
    iconEl.textContent = meta.icon;
    iconEl.setAttribute("aria-hidden", "true");
    pill.appendChild(iconEl);

    // Name label
    const label = document.createElement("span");
    label.className = "active-effect-hud__name";
    label.textContent = effect.name;
    pill.appendChild(label);

    // Duration countdown
    const countdown = document.createElement("span");
    countdown.className = "active-effect-hud__countdown";
    countdown.textContent = formatDuration(effect.duration);
    pill.appendChild(countdown);

    // Progress bar wrapper + fill
    const barWrap = document.createElement("div");
    barWrap.className = "active-effect-hud__bar-wrap";
    pill.appendChild(barWrap);

    const bar = document.createElement("div");
    bar.className = "active-effect-hud__bar";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    this._setBarProgress(bar, effect.duration, effect.totalDuration);
    barWrap.appendChild(bar);

    this._strip.appendChild(pill);
    this._pills.set(effect.id, { pill, label, countdown, bar });
  }

  private _updatePill(effect: Readonly<ActiveEffect>): void {
    const entry = this._pills.get(effect.id);
    if (!entry) return;

    entry.countdown.textContent = formatDuration(effect.duration);
    this._setBarProgress(entry.bar, effect.duration, effect.totalDuration);
  }

  private _setBarProgress(bar: HTMLDivElement, remaining: number, total: number): void {
    const pct = total > 0 && isFinite(total)
      ? Math.max(0, Math.min(100, (remaining / total) * 100))
      : 100;
    bar.style.width = `${pct}%`;
    bar.setAttribute("aria-valuenow", String(Math.round(pct)));
  }
}

// Re-export helper for tests.
export { formatDuration };
