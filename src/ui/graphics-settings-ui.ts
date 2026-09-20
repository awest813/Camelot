import type { QualityTier } from "../systems/graphics-system";
import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";
import { getGraphicsTierIcon, getDifficultyIcon } from "./icon-utils";

// ── Tier metadata ─────────────────────────────────────────────────────────────

const TIER_LABELS: Record<QualityTier, string> = {
  low:    "Low",
  medium: "Medium",
  high:   "High",
  ultra:  "Ultra",
};

const TIER_DESCRIPTIONS: Record<QualityTier, string> = {
  low:    "Best for integrated GPUs. Reduced shadows, no post-processing, 75% render scale.",
  medium: "Balanced preset. Full shadows with FXAA anti-aliasing.",
  high:   "Recommended. Soft shadows with tone mapping and vignette.",
  ultra:  "High-end desktops. Bloom, sharpening, 2048² shadow map.",
};

const TIERS: QualityTier[] = ["low", "medium", "high", "ultra"];

// ── Difficulty metadata ───────────────────────────────────────────────────────

export type Difficulty = "easy" | "normal" | "hard";

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy:   "Easy",
  normal: "Normal",
  hard:   "Hard",
};

const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy:   "Foes deal 40% less damage.",
  normal: "The intended challenge.",
  hard:   "Foes deal 50% more damage.",
};

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

// ── Audio & Camera metadata ──────────────────────────────────────────────────

export type CameraSensitivity = "low" | "standard" | "high";

const VOLUME_PRESETS: number[] = [0.25, 0.5, 0.75, 1.0];

const SENSITIVITY_PRESETS: Array<{ key: CameraSensitivity; label: string; desc: string }> = [
  { key: "low",      label: "Low (0.5×)",      desc: "Smooth, relaxed turn speed" },
  { key: "standard", label: "Standard (1.0×)", desc: "Balanced mouse look" },
  { key: "high",     label: "High (1.5×)",     desc: "Quick, responsive turns" },
];

// ── GraphicsSettingsUI ────────────────────────────────────────────────────────

/**
 * GraphicsSettingsUI — modal overlay for switching graphics quality tiers,
 * difficulty, audio volume/mute, and camera sensitivity.
 */
export class GraphicsSettingsUI {
  public isVisible: boolean = false;
  private _focusSession: DialogFocusSession | null = null;

  public onTierSelect: ((tier: QualityTier) => void) | null = null;
  public onDifficultySelect: ((difficulty: Difficulty) => void) | null = null;
  public onAudioMuteToggle: ((isMuted: boolean) => void) | null = null;
  public onVolumeChange: ((volume: number) => void) | null = null;
  public onCameraSensitivityChange: ((sensitivity: CameraSensitivity) => void) | null = null;
  public onClose: (() => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _tierBtns: Map<QualityTier, HTMLButtonElement> = new Map();
  private _difficultyBtns: Map<Difficulty, HTMLButtonElement> = new Map();
  private _volumeBtns: Map<number, HTMLButtonElement> = new Map();
  private _sensBtns: Map<CameraSensitivity, HTMLButtonElement> = new Map();
  private _muteBtn: HTMLButtonElement | null = null;
  private _statusEl: HTMLSpanElement | null = null;

  private _currentDifficulty: Difficulty = "normal";
  private _isMuted: boolean = false;
  private _currentVolume: number = 0.5;
  private _currentSensitivity: CameraSensitivity = "standard";

  public show(
    currentTier: QualityTier,
    currentDifficulty: Difficulty = this._currentDifficulty,
    isMuted: boolean = this._isMuted,
    volume: number = this._currentVolume,
    sensitivity: CameraSensitivity = this._currentSensitivity,
  ): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    this._highlightTier(currentTier);
    this._highlightDifficulty(currentDifficulty);
    this._highlightAudio(isMuted, volume);
    this._highlightSensitivity(sensitivity);
    if (this._root) this._root.style.display = "flex";
    this.isVisible = true;
    if (!this._focusSession && this._root) this._focusSession = manageDialogFocus(this._root);
  }

  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
    this._focusSession?.release();
    this._focusSession = null;
  }

  public destroy(): void {
    this._root?.remove();
    this._root = null;
    this._tierBtns.clear();
    this._difficultyBtns.clear();
    this._volumeBtns.clear();
    this._sensBtns.clear();
    this._muteBtn = null;
    this._statusEl = null;
    this.isVisible = false;
    this._focusSession?.release();
    this._focusSession = null;
  }

  private _highlightTier(tier: QualityTier): void {
    for (const [t, btn] of this._tierBtns) {
      btn.classList.toggle("is-active", t === tier);
      btn.setAttribute("aria-pressed", String(t === tier));
    }
  }

  private _highlightDifficulty(difficulty: Difficulty): void {
    this._currentDifficulty = difficulty;
    for (const [d, btn] of this._difficultyBtns) {
      btn.classList.toggle("is-active", d === difficulty);
      btn.setAttribute("aria-pressed", String(d === difficulty));
    }
  }

  private _highlightAudio(isMuted: boolean, volume: number): void {
    this._isMuted = isMuted;
    this._currentVolume = volume;
    if (this._muteBtn) {
      this._muteBtn.textContent = isMuted ? "🔇 Unmute Audio" : "🔊 Mute Audio";
      this._muteBtn.classList.toggle("is-active", isMuted);
      this._muteBtn.setAttribute("aria-pressed", String(isMuted));
    }
    for (const [v, btn] of this._volumeBtns) {
      const active = Math.abs(v - volume) < 0.08 && !isMuted;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
  }

  private _highlightSensitivity(sensitivity: CameraSensitivity): void {
    this._currentSensitivity = sensitivity;
    for (const [s, btn] of this._sensBtns) {
      btn.classList.toggle("is-active", s === sensitivity);
      btn.setAttribute("aria-pressed", String(s === sensitivity));
    }
  }

  public showStatus(message: string): void {
    if (this._statusEl) {
      this._statusEl.textContent = message;
    }
  }

  private _ensureDom(): void {
    if (this._root) return;

    // Root overlay
    const root = document.createElement("div");
    root.className = "graphics-settings";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Game Settings");
    root.style.display = "none";

    // Panel
    const panel = document.createElement("div");
    panel.className = "graphics-settings__panel";

    // Header
    const header = document.createElement("div");
    header.className = "graphics-settings__header";

    const title = document.createElement("h2");
    title.className = "graphics-settings__title";
    title.textContent = "Game Settings";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "graphics-settings__close";
    closeBtn.setAttribute("aria-label", "Close settings");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Subtitle
    const subtitle = document.createElement("p");
    subtitle.className = "graphics-settings__subtitle";
    subtitle.textContent = "Configure visual quality, gameplay difficulty, audio and camera controls.";
    panel.appendChild(subtitle);

    // ── Section 1: Graphics Quality ──────────────────────────────────────────
    const tierTitle = document.createElement("h3");
    tierTitle.className = "graphics-settings__title";
    tierTitle.textContent = "Graphics Quality";
    tierTitle.style.marginTop = "14px";
    panel.appendChild(tierTitle);

    const grid = document.createElement("div");
    grid.className = "graphics-settings__grid";

    for (const tier of TIERS) {
      const card = document.createElement("button");
      card.className = "graphics-settings__card";
      card.setAttribute("aria-pressed", "false");

      const iconEl = document.createElement("span");
      iconEl.className = "graphics-settings__card-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = getGraphicsTierIcon(tier);
      iconEl.style.fontSize = "18px";
      iconEl.style.marginBottom = "4px";
      iconEl.style.display = "block";

      const labelEl = document.createElement("span");
      labelEl.className = "graphics-settings__card-label";
      labelEl.textContent = TIER_LABELS[tier];

      const descEl = document.createElement("span");
      descEl.className = "graphics-settings__card-desc";
      descEl.textContent = TIER_DESCRIPTIONS[tier];

      card.appendChild(iconEl);
      card.appendChild(labelEl);
      card.appendChild(descEl);
      card.addEventListener("click", () => {
        this.showStatus(`Preset selected: ${TIER_LABELS[tier]} (applies on reload)`);
        this.onTierSelect?.(tier);
      });

      this._tierBtns.set(tier, card);
      grid.appendChild(card);
    }

    panel.appendChild(grid);

    // ── Section 2: Difficulty ────────────────────────────────────────────────
    const diffTitle = document.createElement("h3");
    diffTitle.className = "graphics-settings__title";
    diffTitle.textContent = "Difficulty";
    diffTitle.style.marginTop = "18px";
    panel.appendChild(diffTitle);

    const diffGrid = document.createElement("div");
    diffGrid.className = "graphics-settings__grid";

    for (const difficulty of DIFFICULTIES) {
      const card = document.createElement("button");
      card.className = "graphics-settings__card";
      card.setAttribute("aria-pressed", "false");

      const iconEl = document.createElement("span");
      iconEl.className = "graphics-settings__card-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = getDifficultyIcon(difficulty);
      iconEl.style.fontSize = "18px";
      iconEl.style.marginBottom = "4px";
      iconEl.style.display = "block";

      const labelEl = document.createElement("span");
      labelEl.className = "graphics-settings__card-label";
      labelEl.textContent = DIFFICULTY_LABELS[difficulty];

      const descEl = document.createElement("span");
      descEl.className = "graphics-settings__card-desc";
      descEl.textContent = DIFFICULTY_DESCRIPTIONS[difficulty];

      card.appendChild(iconEl);
      card.appendChild(labelEl);
      card.appendChild(descEl);
      card.addEventListener("click", () => {
        this._highlightDifficulty(difficulty);
        this.showStatus(`Difficulty set to ${DIFFICULTY_LABELS[difficulty]}`);
        this.onDifficultySelect?.(difficulty);
      });

      this._difficultyBtns.set(difficulty, card);
      diffGrid.appendChild(card);
    }

    panel.appendChild(diffGrid);

    // ── Section 3: Audio & Sound ─────────────────────────────────────────────
    const audioTitle = document.createElement("h3");
    audioTitle.className = "graphics-settings__title";
    audioTitle.textContent = "Audio & Sound";
    audioTitle.style.marginTop = "18px";
    panel.appendChild(audioTitle);

    const audioRow = document.createElement("div");
    audioRow.className = "graphics-settings__audio-row";

    const muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "graphics-settings__chip-btn";
    muteBtn.textContent = this._isMuted ? "🔇 Unmute Audio" : "🔊 Mute Audio";
    muteBtn.addEventListener("click", () => {
      this._isMuted = !this._isMuted;
      this._highlightAudio(this._isMuted, this._currentVolume);
      this.showStatus(this._isMuted ? "Audio muted" : "Audio unmuted");
      this.onAudioMuteToggle?.(this._isMuted);
    });
    this._muteBtn = muteBtn;
    audioRow.appendChild(muteBtn);

    for (const vol of VOLUME_PRESETS) {
      const volBtn = document.createElement("button");
      volBtn.type = "button";
      volBtn.className = "graphics-settings__chip-btn";
      volBtn.textContent = `${Math.round(vol * 100)}% Volume`;
      volBtn.addEventListener("click", () => {
        this._isMuted = false;
        this._currentVolume = vol;
        this._highlightAudio(false, vol);
        this.showStatus(`Master volume: ${Math.round(vol * 100)}%`);
        this.onVolumeChange?.(vol);
      });
      this._volumeBtns.set(vol, volBtn);
      audioRow.appendChild(volBtn);
    }

    panel.appendChild(audioRow);

    // ── Section 4: Camera & Controls ─────────────────────────────────────────
    const sensTitle = document.createElement("h3");
    sensTitle.className = "graphics-settings__title";
    sensTitle.textContent = "Camera Look Sensitivity";
    sensTitle.style.marginTop = "18px";
    panel.appendChild(sensTitle);

    const sensRow = document.createElement("div");
    sensRow.className = "graphics-settings__sens-row";

    for (const sens of SENSITIVITY_PRESETS) {
      const sensBtn = document.createElement("button");
      sensBtn.type = "button";
      sensBtn.className = "graphics-settings__chip-btn";
      sensBtn.textContent = sens.label;
      sensBtn.title = sens.desc;
      sensBtn.addEventListener("click", () => {
        this._highlightSensitivity(sens.key);
        this.showStatus(`Look sensitivity: ${sens.label}`);
        this.onCameraSensitivityChange?.(sens.key);
      });
      this._sensBtns.set(sens.key, sensBtn);
      sensRow.appendChild(sensBtn);
    }

    panel.appendChild(sensRow);

    // ── Status Bar ───────────────────────────────────────────────────────────
    const statusBar = document.createElement("div");
    statusBar.className = "graphics-settings__status-bar";

    const statusEl = document.createElement("span");
    statusEl.textContent = "Ready";
    this._statusEl = statusEl;
    statusBar.appendChild(statusEl);

    panel.appendChild(statusBar);

    root.appendChild(panel);

    root.addEventListener("click", (e) => {
      if (e.target === root) {
        this.hide();
        this.onClose?.();
      }
    });

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.hide();
        this.onClose?.();
      }
    });

    document.body.appendChild(root);
    this._root = root;
  }
}
