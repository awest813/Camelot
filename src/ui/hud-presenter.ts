/**
 * The per-frame HUD: health, magicka, stamina and XP bars, the stats panel
 * while the inventory is open, the clock, compass, sneak and combat
 * readouts, the crosshair hidden under menus and conversations, the active
 * effects and quick-slot bars, and the debug overlay.  Values are written
 * only when they change.
 *
 * Moved out of game.ts (engine overhaul, Phase 1); the Phase 3 UI reads the
 * same sources.
 */
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";
import type { Player } from "../entities/player";
import type { UIManager } from "./ui-manager";
import type { ActiveEffectHUD } from "./active-effect-hud";
import type { QuickSlotHUD } from "./quickslot-hud";
import type { TimeSystem } from "../systems/time-system";
import type { StealthSystem } from "../systems/stealth-system";
import type { CombatSystem } from "../systems/combat-system";
import type { ActiveEffectsSystem } from "../systems/active-effects-system";
import type { QuickSlotSystem } from "../systems/quickslot-system";

export interface HudSources {
  readonly engine: AbstractEngine;
  readonly scene: Scene;
  readonly ui: UIManager;
  readonly player: Player;
  readonly time: TimeSystem;
  readonly stealth: StealthSystem;
  readonly combat: CombatSystem;
  readonly effects: ActiveEffectsSystem;
  readonly effectsHud: ActiveEffectHUD;
  readonly quickSlots: QuickSlotSystem;
  readonly quickSlotsHud: QuickSlotHUD;
  characterLevel(): number;
  inventoryOpen(): boolean;
  talking(): boolean;
  /** A menu or panel that hides the crosshair is open. */
  overlayOpen(): boolean;
  cellName(): string;
  weatherLabel(): string;
  /** Meshes the LOD system culled on its last pass. */
  lodCulled(): number;
}

export class HudPresenter {
  private _lastHealth = -1;
  private _lastMagicka = -1;
  private _lastStamina = -1;
  private _lastExperience = -1;
  private _lastLevel = -1;
  private _lastCharacterLevel = -1;
  private _lastClockMinutes = Number.NaN;
  private _hudInDialogue = false;
  /** Throttles the debug overlay's scene queries. */
  private _debugOverlayFrameSkip = 0;
  private _tick = 0;

  constructor(private readonly _src: () => HudSources) {}

  public update(): void {
    const src = this._src();
    // Only update UI bars when values have actually changed
    if (src.player.health !== this._lastHealth) {
        this._lastHealth = src.player.health;
        src.ui.updateHealth(src.player.health, src.player.maxHealth);
    }
    if (src.player.magicka !== this._lastMagicka) {
        this._lastMagicka = src.player.magicka;
        src.ui.updateMagicka(src.player.magicka, src.player.maxMagicka);
    }
    if (src.player.stamina !== this._lastStamina) {
        this._lastStamina = src.player.stamina;
        src.ui.updateStamina(src.player.stamina, src.player.maxStamina);
    }

    if (src.player.experience !== this._lastExperience || src.player.level !== this._lastLevel || src.characterLevel() !== this._lastCharacterLevel) {
        this._lastExperience = src.player.experience;
        this._lastLevel = src.player.level;
        this._lastCharacterLevel = src.characterLevel();
        src.ui.updateXP(src.player.experience, src.player.experienceToNextLevel, src.player.level, src.characterLevel());
    }

    // Refresh the stats panel every frame while inventory is open so live values
    // (health regen, damage taken, equipment changes) are always current.
    if (src.inventoryOpen()) {
        src.ui.updateStats(src.player, src.characterLevel());
    }

    // Update clock display only when the displayed in-game minute changes —
    // the timeString getter allocates, so don't build it every frame.
    const clockMinutes = Math.floor(src.time.gameTime);
    if (clockMinutes !== this._lastClockMinutes) {
        this._lastClockMinutes = clockMinutes;
        src.ui.updateClock(src.time.timeString);
    }

    // Update compass heading from camera yaw
    src.ui.updateCompass(src.player.camera.rotation.y);

    // Update stealth HUD when crouching
    if (src.stealth.isCrouching) {
        src.ui.updateStealthHUD(src.stealth.stealthLabel);
    } else {
        src.ui.updateStealthHUD(null);
    }

    // Combat-state readout: combo chain, finisher, and riposte window.
    {
        const combat = src.combat;
        let combatLabel: string | null = null;
        if (combat.isDodging) combatLabel = "Dodging!";
        else if (combat.finisherReady && combat.activeWeaponArchetype !== "bow") combatLabel = "⚔ FINISHER READY";
        else if (combat.riposteReady) combatLabel = "Riposte ready!";
        else if (combat.comboStack > 1) combatLabel = `Combo ×${combat.comboStack}`;
        src.ui.updateCombatState(combatLabel);
    }

    // Hide the crosshair while any HTML modal overlay owns the screen
    // (barter, level-up, guard challenge, travel, stable, settings, …).
    // Conversations hide the crosshair and the quick-slot bar (Bethesda-style).
    const talking = src.talking();
    if (talking !== this._hudInDialogue) {
      this._hudInDialogue = talking;
      document.body.classList.toggle("is-in-dialogue", talking);
    }
    src.ui.setHtmlOverlayActive(talking || src.overlayOpen());

    // Update active effects HUD (30 Hz, same as activeEffectsSystem)
    if (++this._tick % 2 === 0) {
      src.effectsHud.update(src.effects.activeEffects);
      src.quickSlotsHud.update(src.quickSlots);
    }

    if (!src.ui.isDebugVisible) {
        // Primed so the first visible frame fills the overlay (otherwise it
        // sat empty for 12 frames — seconds at low frame rates).
        this._debugOverlayFrameSkip = 11;
    } else if (++this._debugOverlayFrameSkip >= 12) {
        this._debugOverlayFrameSkip = 0;
        const eng = src.engine;
        const drawCounter = (eng as { _drawCalls?: { current: number } })._drawCalls;
        src.ui.updateDebugOverlay({
            fps:           eng.getFps(),
            drawCalls:     drawCounter?.current ?? 0,
            activeMeshes:  src.scene.getActiveMeshes().length,
            totalVertices: src.scene.getTotalVertices(),
            playerPos: {
                x: src.player.camera.position.x,
                y: src.player.camera.position.y,
                z: src.player.camera.position.z,
            },
            carryWeight:    src.player.carryWeight,
            maxCarryWeight: src.player.maxCarryWeight,
            currentCell:    src.cellName() ?? "exterior",
            gameTime:       src.time.timeString,
            stealthLabel:   src.stealth.stealthLabel,
            lodCulled:      src.lodCulled(),
            weather:        src.weatherLabel(),
        });
    }
  }
}
