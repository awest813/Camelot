/**
 * Player settings as a kernel feature: the settings dialog (graphics tier,
 * difficulty, audio, look sensitivity, fullscreen on desktop), the always-on
 * gear button that opens it, and the credits.
 *
 * Inputs:   services settings-host, feedback, modal, gameplay.
 * Outputs:  the `settings` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { GraphicsSettingsUI, CameraSensitivity, Difficulty } from "../../ui/graphics-settings-ui";
import { LazyPanel } from "../../ui/lazy-panel";
import { CreditsUI } from "../../ui/credits-ui";
import { persistGraphicsTier, type QualityTier } from "../../systems/graphics-system";
import { FeedbackKey, GameplayKey, ModalKey, declareStateless } from "../services";

/** NPC damage to the player, by difficulty. */
export const DIFFICULTY_DAMAGE: Record<Difficulty, number> = { easy: 0.6, normal: 1.0, hard: 1.5 };
/** Mouse look: higher is slower (Babylon's angular sensibility). */
export const LOOK_SENSIBILITY: Record<CameraSensitivity, number> = { low: 1200, standard: 800, high: 500 };

export interface SettingsHostService {
  tier(): QualityTier;
  /** A new tier takes a reload; tell the culling first. */
  applyTier(tier: QualityTier): void;
  setDamageTaken(multiplier: number): void;
  readonly audio: { readonly isMuted: boolean; readonly masterVolume: number; toggleMute(): void; setMasterVolume(v: number): void };
  setLookSensibility(value: number): void;
  /** Desktop builds can toggle fullscreen. */
  toggleFullscreen: (() => void) | null;
  paused(): boolean;
}

export interface SettingsService {
  /** The settings dialog (loaded the first time it opens). */
  readonly dialog: LazyPanel<GraphicsSettingsUI>;
  readonly credits: CreditsUI;
  readonly difficulty: Difficulty;
  /** Open the settings dialog (from the pause menu, or the gear button in play). */
  open(): void;
  openCredits(): void;
}

export const SettingsHostKey = createServiceKey<SettingsHostService>("settings-host");
export const SettingsKey = createServiceKey<SettingsService>("settings");

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export class SettingsFeature implements Feature {
  public readonly id = "settings";
  /** Loaded the first time it opens (out of the start-up bundle). */
  public readonly dialog = new LazyPanel<GraphicsSettingsUI>(async () => {
    const { GraphicsSettingsUI } = await import("../../ui/graphics-settings-ui");
    const d = new GraphicsSettingsUI();
    this._wire?.(d);
    return d;
  });
  private _wire: ((d: GraphicsSettingsUI) => void) | null = null;
  public readonly credits = new CreditsUI();
  private _difficulty: Difficulty = "normal";
  private _sensitivity: CameraSensitivity = "standard";
  private _button: HTMLButtonElement | null = null;
  private _s: ServiceRegistry | null = null;

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "settings are player preferences, kept outside the save");
    const s = ctx.kernel.services;
    this._s = s;
    const host = () => s.get(SettingsHostKey);
    const notify = (t: string, ms: number) => s.get(FeedbackKey).notify(t, ms);
    // Back to play (or to the pause menu it was opened from).
    const back = () => { if (!host().paused()) s.get(ModalKey).restoreGameplay(); };
    this.credits.onClose = back;
    this._wire = (d) => {
      d.onTierSelect = (tier) => {
        persistGraphicsTier(tier);
        host().applyTier(tier);
      };
      d.onDifficultySelect = (difficulty) => {
        this._difficulty = difficulty;
        host().setDamageTaken(DIFFICULTY_DAMAGE[difficulty]);
        notify(`Difficulty: ${cap(difficulty)}`, 2400);
      };
      d.onAudioMuteToggle = (muted) => {
        const audio = host().audio;
        if (audio.isMuted !== muted) audio.toggleMute();
        notify(muted ? "Audio muted" : "Audio unmuted", 1500);
      };
      d.onVolumeChange = (volume) => {
        host().audio.setMasterVolume(volume);
        notify(`Master volume: ${Math.round(volume * 100)}%`, 1500);
      };
      d.onCameraSensitivityChange = (sens) => {
        this._sensitivity = sens;
        host().setLookSensibility(LOOK_SENSIBILITY[sens]);
        notify(`Look Sensitivity: ${cap(sens)}`, 1500);
      };
      d.onClose = back;
      const full = host().toggleFullscreen;
      if (full) d.onToggleFullscreen = full;
    };
    const loaded = this.dialog.current;
    if (loaded) this._wire(loaded);

    // eslint-disable-next-line @typescript-eslint/no-this-alias -- getter below
    const self = this;
    ctx.provide(SettingsKey, {
      dialog: this.dialog,
      credits: this.credits,
      get difficulty() { return self._difficulty; },
      open: () => this._open(),
      openCredits: () => this.credits.show(),
    });

    this._addGearButton();
    ctx.scope.add(() => {
      this._button?.remove();
      this._button = null;
      const d = this.dialog.current;
      if (d) {
        d.onTierSelect = d.onDifficultySelect = d.onAudioMuteToggle = null;
        d.onVolumeChange = d.onCameraSensitivityChange = d.onClose = null;
      }
      this._wire = null;
      this.credits.onClose = null;
      this._s = null;
    });
  }

  private _open(): void {
    const host = this._s?.get(SettingsHostKey);
    if (!host) return;
    void this.dialog.get().then((d) => d.show(host.tier(), this._difficulty, host.audio.isMuted, host.audio.masterVolume, this._sensitivity));
  }

  /** A gear button (⚙) that is always on screen, so settings need no key. */
  private _addGearButton(): void {
    if (typeof document === "undefined") return;
    const btn = document.createElement("button");
    btn.className = "graphics-settings-btn";
    btn.setAttribute("aria-label", "Open graphics settings");
    btn.textContent = "⚙";
    btn.addEventListener("click", () => {
      const s = this._s;
      if (!s || this.dialog.isVisible || this.credits.isVisible || !s.get(GameplayKey).canAct()) return;
      this._open();
      s.get(ModalKey).suspendGameplay();
    });
    document.body.appendChild(btn);
    this._button = btn;
  }
}
