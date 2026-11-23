import { describe, it, expect, vi } from "vitest";
import { HudPresenter, type HudSources } from "./hud-presenter";

function sources() {
  const ui = {
    updateHealth: vi.fn(), updateMagicka: vi.fn(), updateStamina: vi.fn(), updateXP: vi.fn(), updateStats: vi.fn(),
    updateClock: vi.fn(), updateCompass: vi.fn(), updateStealthHUD: vi.fn(), updateCombatState: vi.fn(),
    setHtmlOverlayActive: vi.fn(), updateDebugOverlay: vi.fn(), isDebugVisible: false,
  };
  const player = { health: 80, maxHealth: 100, magicka: 50, maxMagicka: 100, stamina: 60, maxStamina: 100,
    experience: 10, experienceToNextLevel: 100, level: 2, camera: { rotation: { y: 0 }, position: { x: 0, y: 0, z: 0 } } };
  let talking = false;
  let overlay = false;
  const src = {
    engine: { getFps: () => 60 }, scene: { getActiveMeshes: () => [], getTotalVertices: () => 0 }, ui, player,
    time: { gameTime: 480.2, timeString: "08:00" },
    stealth: { isCrouching: false, stealthLabel: "" },
    combat: { isDodging: false, finisherReady: false, riposteReady: false, comboStack: 0, activeWeaponArchetype: "sword" },
    effects: { activeEffects: [] }, effectsHud: { update: vi.fn() }, quickSlots: {}, quickSlotsHud: { update: vi.fn() },
    characterLevel: () => 3, inventoryOpen: () => false, talking: () => talking, overlayOpen: () => overlay,
    cellName: () => "exterior", weatherLabel: () => "Clear", lodCulled: () => 0,
  } as unknown as HudSources;
  return { src, ui, player, talk: (v: boolean) => { talking = v; }, menu: (v: boolean) => { overlay = v; } };
}

describe("HudPresenter", () => {
  it("writes bars and the clock only when they change", () => {
    const t = sources();
    const hud = new HudPresenter(() => t.src);
    hud.update();
    hud.update();
    expect(t.ui.updateHealth).toHaveBeenCalledOnce();
    expect(t.ui.updateClock).toHaveBeenCalledOnce();
    t.player.health = 70;
    hud.update();
    expect(t.ui.updateHealth).toHaveBeenLastCalledWith(70, 100);
  });

  it("hides the crosshair under a menu or a conversation, and marks the page while talking", () => {
    const t = sources();
    const hud = new HudPresenter(() => t.src);
    t.menu(true);
    hud.update();
    expect(t.ui.setHtmlOverlayActive).toHaveBeenLastCalledWith(true);
    t.menu(false);
    t.talk(true);
    hud.update();
    expect(t.ui.setHtmlOverlayActive).toHaveBeenLastCalledWith(true);
    expect(document.body.classList.contains("is-in-dialogue")).toBe(true);
    t.talk(false);
    hud.update();
    expect(document.body.classList.contains("is-in-dialogue")).toBe(false);
  });
});
