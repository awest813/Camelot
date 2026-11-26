import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, GameplayKey, ModalKey } from "../services";
import { SettingsFeature, SettingsHostKey, SettingsKey, type SettingsHostService } from "./settings-feature";

function setup(paused = false) {
  const k = new Kernel();
  const notes: string[] = [];
  const audio = { isMuted: false, masterVolume: 1, toggleMute: vi.fn(() => { audio.isMuted = !audio.isMuted; }), setMasterVolume: vi.fn() };
  let damage = 1, look = 800;
  const host: SettingsHostService = {
    tier: () => "high", applyTier: vi.fn(), setDamageTaken: (m) => { damage = m; }, audio,
    setLookSensibility: (v) => { look = v; }, toggleFullscreen: null, paused: () => paused,
  };
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(SettingsHostKey, host);
  k.services.provide(ModalKey, modal);
  k.services.provide(GameplayKey, { canAct: () => true });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.install(new SettingsFeature());
  return { k, notes, audio, modal, svc: k.services.get(SettingsKey), damage: () => damage, look: () => look };
}

describe("SettingsFeature (headless, through the kernel)", () => {
  it("difficulty, audio and look sensitivity apply at once", async () => {
    const t = setup();
    const d = await t.svc.dialog.get();
    d.onDifficultySelect!("hard");
    expect(t.damage()).toBe(1.5);
    expect(t.svc.difficulty).toBe("hard");
    d.onAudioMuteToggle!(true);
    expect(t.audio.isMuted).toBe(true);
    d.onCameraSensitivityChange!("high");
    expect(t.look()).toBe(500);
    expect(t.notes).toEqual(["Difficulty: Hard", "Audio muted", "Look Sensitivity: High"]);
    t.k.uninstall("settings");
  });

  it("the gear button opens settings over play (loading it), and closing hands play back", async () => {
    const t = setup();
    expect(t.svc.dialog.current, "not loaded at start").toBeNull();
    (document.querySelector(".graphics-settings-btn") as HTMLButtonElement).click();
    const d = await t.svc.dialog.get();
    expect(t.svc.dialog.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();
    d.onClose!();
    expect(t.modal.restoreGameplay).toHaveBeenCalledOnce();
    t.k.uninstall("settings");
    expect(document.querySelector(".graphics-settings-btn"), "the button goes with the feature").toBeNull();
  });

  it("closed from the pause menu, it leaves the pause menu up", async () => {
    const t = setup(true);
    t.svc.open();
    (await t.svc.dialog.get()).onClose!();
    expect(t.modal.restoreGameplay).not.toHaveBeenCalled();
    t.k.uninstall("settings");
  });
});
