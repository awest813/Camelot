import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Observer } from "@babylonjs/core/Misc/observable";
import { Item } from "../systems/inventory-system";
import { Quest } from "../systems/quest-system";
import { EquipSlot } from "../systems/equipment-system";
import { getItemIcon } from "./icon-utils";
import { Player } from "../entities/player";
import type { SkillTree } from "../systems/skill-tree-system";
import { AttributeSystem, ATTRIBUTE_NAMES, type AttributeName } from "../systems/attribute-system";
import { HudDom } from "./hud-dom";
import { WaitDialogPanel } from "./wait-dialog";
import { AttributePanelView } from "./attribute-panel";
import { QuestLogView } from "./quest-log-panel";
import { PauseMenuView, type PauseActions } from "./pause-menu";
import { SkillTreeView } from "./skill-tree-panel";
import { InventoryPanelView } from "./inventory-panel";

/** Cardinal labels for the compass strip, clockwise from north. */
const COMPASS_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

type RotatableCamera = {
  rotation: Vector3;
};

// Active cameras in tests/runtime can differ, so detect the rotation contract
// instead of coupling camera shake to one Babylon.js camera subclass.
const hasRotatableCamera = (camera: unknown): camera is RotatableCamera => {
  if (!camera || typeof camera !== "object") return false;
  const rotation = (camera as { rotation?: unknown }).rotation;
  return rotation instanceof Vector3;
};

export class UIManager {
  public scene: Scene;
  /** The HUD's elements (see hud-dom.ts). */
  public readonly hud = new HudDom();

  // Inventory
  /** The inventory (a Preact panel; see inventory-panel.tsx), drawn from the state below. */
  private readonly _inventory = new InventoryPanelView(() => ({
    items: this._inventoryItems,
    equippedIds: this._equippedIds,
    stats: this._lastStatsText ?? "Stats:\nHP: --\nMP: --\nSP: --",
    equipment: this._equipmentLines,
    isConsumable: (item) => !!this.isConsumableItem?.(item),
    detail: (item) => this.itemDetailSuffix?.(item) ?? "",
  }));
  private _inventoryItems: Item[] = [];
  private _equipmentLines: string[] = ["Main Hand", "Off Hand", "Head", "Chest", "Legs", "Feet"].map((slot) => `${slot}: --`);
  private _lastStatsText: string | null = null;

  private _equippedIds: Set<string> = new Set();

  /** Called when the player clicks an inventory item slot. Set by Game to hook into EquipmentSystem. */
  public onInventoryItemClick: ((item: Item) => void) | null = null;
  /** Extra detail line(s) appended to an inventory item's hover text (e.g. gear condition). */
  public itemDetailSuffix: ((item: Item) => string) | null = null;

  /**
   * When set (by Game), inventory rows show a drink/use hint for consumables
   * (same rule as QuickSlotSystem: positive heal / magicka / stamina on stats).
   */
  public isConsumableItem: ((item: Item) => boolean) | null = null;

  // Pause Menu
  /** The pause menu (a Preact panel; see pause-menu.tsx). */
  private readonly _pauseMenu = new PauseMenuView();
  private _pauseActions: PauseActions | null = null;
  public isPauseMenuOpen = false;

  // Impact sparks reuse pre-allocated meshes driven by one shared observer.
  private _sparkRows: Array<{ mesh: Mesh; mat: StandardMaterial; scale: number; active: boolean }> = [];
  private _sparkObs: Observer<Scene> | null = null;

  // Quest Log
  /** The quest log (a Preact panel; see quest-log-panel.tsx). */
  private readonly _questLog = new QuestLogView();
  public isQuestLogOpen = false;

  /** True while the HTML Character Sheet overlay is open (hides crosshair with other blocking panels). */
  private _characterSheetOpen: boolean = false;
  private _htmlOverlayCount: number = 0;
  /** Set by the game layer each frame: true while any HTML modal overlay owns the screen. */
  private _htmlModalActive: boolean = false;
  public get htmlOverlayCount(): number { return this._htmlOverlayCount; }
  public registerHtmlOverlay(): () => void {
    this._htmlOverlayCount++;
    this._syncCrosshairVisibility();
    return () => {
      this._htmlOverlayCount--;
      this._syncCrosshairVisibility();
    };
  }

  /**
   * Report whether any HTML modal overlay (barter, level-up, guard challenge,
   * travel, stable, settings, …) is currently open so the crosshair hides
   * alongside the Babylon-GUI blocking panels.  Cheap to call every frame.
   */
  public setHtmlOverlayActive(active: boolean): void {
    if (active === this._htmlModalActive) return;
    this._htmlModalActive = active;
    this._syncCrosshairVisibility();
  }

  // Camera Shake & Hit-stop
  private _cameraTrauma: number = 0;
  private _initialCameraRotation: Vector3 | null = null;
  private _cameraShakeObs: Observer<Scene> | null = null;
  public onHitStopRequested: ((durationMs: number) => void) | null = null;

  /** Full-screen fade for cell loads and scripted cuts. */
  private _fadeAlpha = 0;
  private _transitionFadeObserver: Observer<Scene> | null = null;

  // Skill Tree
  /** The skill trees (a Preact panel; see skill-tree-panel.tsx). */
  private readonly _skillTree = new SkillTreeView();
  public isSkillTreeOpen = false;

  /** Called when the player clicks a skill upgrade button. Set by Game. */
  public onSkillPurchase: ((treeIndex: number, skillIndex: number) => void) | null = null;

  public isDebugVisible: boolean = false;
  private _lastStealthHudLabel: "Hidden" | "Caution" | "Detected" | null | undefined = undefined;

  // ── Attribute Panel ───────────────────────────────────────────────────────
  /** The Attributes panel (a Preact panel; see attribute-panel.tsx). */
  private readonly _attributePanel = new AttributePanelView();
  public isAttributePanelOpen: boolean = false;

  /** Called when the player clicks a "+1" attribute button.  Set by Game. */
  public onAttributeSpend: ((name: AttributeName) => void) | null = null;

  // ── Wait Dialog ───────────────────────────────────────────────────────────
  /** The Wait dialog (a Preact panel; see wait-dialog.tsx). */
  private readonly _waitDialog = new WaitDialogPanel();
  public isWaitDialogOpen: boolean = false;
  /**
   * The player closed one of these panels from inside it (its ✕, Escape,
   * Cancel or Wait).  The game
   * closes it through its modal registry, which also gives control back.
   * Without a handler the panel just closes.
   */
  public onPanelClosed: ((id: "wait" | "attributes" | "quest-log" | "skill-tree" | "inventory") => void) | null = null;
  /** Called with the chosen hour count when the player confirms the wait. */
  public onWaitConfirm: ((hours: number) => void) | null = null;

  private _lastCompassIndex: number = -1;

  constructor(scene: Scene) {
    this.scene = scene;
    this.updateCompass(0);
    this.updateClock("08:00");
    this.updateXP(0, 1, 1, 1);
  }

  /**
   * Fade to black, optionally run work while fully black, then fade in.
   * If another sequence is running it is cancelled first.
   */
  public playScreenFadeSequence(options: {
    fadeOutMs?: number;
    holdMs?: number;
    fadeInMs?: number;
    onBlack?: () => void;
    onComplete?: () => void;
  } = {}): void {
    this.cancelScreenFade();

    const fadeOutMs = options.fadeOutMs ?? 380;
    const holdMs = options.holdMs ?? 120;
    const fadeInMs = options.fadeInMs ?? 420;
    const total = fadeOutMs + holdMs + fadeInMs;

    const setAlpha = (a: number) => { this._fadeAlpha = a; this.hud.setFade(a); };
    setAlpha(0);
    this.hud.fade.hidden = false;

    let elapsed = 0;
    let blackFired = false;

    this._transitionFadeObserver = this.scene.onBeforeRenderObservable.add(() => {
      elapsed += this.scene.getEngine().getDeltaTime();

      // Fire at full black even when a slow frame steps past the whole hold
      // (at ~9 fps one frame is longer than it), or the move never happens.
      if (!blackFired && elapsed > fadeOutMs) {
        blackFired = true;
        setAlpha(1);
        options.onBlack?.();
      }

      if (elapsed <= fadeOutMs) {
        setAlpha(Math.min(1, elapsed / fadeOutMs));
      } else if (elapsed <= fadeOutMs + holdMs) {
        setAlpha(1);
      } else if (elapsed <= total) {
        const t = (elapsed - fadeOutMs - holdMs) / fadeInMs;
        setAlpha(Math.max(0, 1 - t));
      } else {
        setAlpha(0);
        this.scene.onBeforeRenderObservable.remove(this._transitionFadeObserver);
        this._transitionFadeObserver = null;
        options.onComplete?.();
      }
    });
  }

  /** Stop an in-progress screen fade and hide the overlay. */
  public cancelScreenFade(): void {
    if (this._transitionFadeObserver) {
      this.scene.onBeforeRenderObservable.remove(this._transitionFadeObserver);
      this._transitionFadeObserver = null;
    }
    this._fadeAlpha = 0;
    this.hud.setFade(0);
  }

  public get isScreenFadeActive(): boolean {
    return this._fadeAlpha > 0.001;
  }

  public toggleSkillTree(visible: boolean): void {
    this.isSkillTreeOpen = visible;
    if (visible) {
      this._skillTree.open({
        onBuy: (t, sk) => this.onSkillPurchase?.(t, sk),
        onClose: () => this._closedByPlayer("skill-tree", () => this.toggleSkillTree(false)),
      });
    } else {
      this._skillTree.close();
    }
    this._syncCrosshairVisibility();
  }

  /**
   * Show the skill trees: ranks, unspent points, and (via `prereqMet`)
   * which skills are still locked behind their prerequisites.
   */
  public refreshSkillTree(
    trees: SkillTree[],
    skillPoints: number,
    prereqMet?: (treeIndex: number, skillIndex: number) => boolean,
  ): void {
    this._skillTree.refresh({ trees, skillPoints, prereqMet });
  }


  /** Fired once when the inventory panel transitions from open to closed. */
  public onInventoryClosed: (() => void) | null = null;

  public toggleInventory(visible: boolean): void {
    const wasOpen = this._inventory.isOpen;
    if (visible) {
      this._inventory.open({
        onItem: (item) => this.onInventoryItemClick?.(item),
        onClose: () => this._closedByPlayer("inventory", () => this.toggleInventory(false)),
      });
    } else {
      this._inventory.close();
    }
    this._syncCrosshairVisibility();
    if (!visible && wasOpen) this.onInventoryClosed?.();
  }

  public togglePauseMenu(visible: boolean): void {
    this.isPauseMenuOpen = visible;
    if (visible && this._pauseActions) this._pauseMenu.open(this._pauseActions);
    else this._pauseMenu.close();
    this._syncCrosshairVisibility();
  }

  /** What the pause menu's buttons do (the game sets this once). */
  public setPauseActions(actions: PauseActions): void {
    this._pauseActions = actions;
    if (this.isPauseMenuOpen) this._pauseMenu.open(actions);
  }

  public toggleQuestLog(visible: boolean): void {
    this.isQuestLogOpen = visible;
    if (visible) this._questLog.open(() => this._closedByPlayer("quest-log", () => this.toggleQuestLog(false)));
    else this._questLog.close();
    this._syncCrosshairVisibility();
  }

  /** A panel closed from inside: the game's registry closes it, else `fallback`. */
  private _closedByPlayer(id: "wait" | "attributes" | "quest-log" | "skill-tree" | "inventory", fallback: () => void): void {
    if (this.onPanelClosed) this.onPanelClosed(id);
    else fallback();
  }

  private _syncCrosshairVisibility(): void {
    const hasBlockingPanelOpen =
      this._inventory.isOpen ||
      this.isPauseMenuOpen ||
      this.isQuestLogOpen ||
      this.isSkillTreeOpen ||
      this.isAttributePanelOpen ||
      this.isWaitDialogOpen ||
      this._characterSheetOpen ||
      this._htmlOverlayCount > 0 ||
      this._htmlModalActive;

    this.toggleCrosshair(!hasBlockingPanelOpen);
  }

  /** Notify the HUD when the DOM Character Sheet is toggled so the crosshair stays hidden with other overlays. */
  public setCharacterSheetOpen(open: boolean): void {
    this._characterSheetOpen = open;
    this._syncCrosshairVisibility();
  }

  public updateQuestLog(quests: Quest[]): void {
    this._questLog.update(quests);
  }

  public toggleCrosshair(visible: boolean): void {
    this.hud.setCrosshair(visible);
  }

  /** Whether the crosshair is showing (hidden while a panel owns the screen). */
  public get isCrosshairVisible(): boolean {
    return !this.hud.crosshair.hidden;
  }

  public setCrosshairActive(active: boolean): void {
    this.hud.setCrosshairActive(active);
  }

  public updateStats(player: Player, characterLevel: number): void {
    const text =
      `Stats:\nCharacter Lv: ${characterLevel}  Combat Lv: ${player.level}\nXP: ${Math.floor(player.experience)} / ${player.experienceToNextLevel}\n` +
      `HP: ${Math.floor(player.health)} / ${player.maxHealth}\nMP: ${Math.floor(player.magicka)} / ${player.maxMagicka}\nSP: ${Math.floor(player.stamina)} / ${player.maxStamina}\nDMG Bonus: +${player.bonusDamage}\nArmor: ${player.bonusArmor}`;
    if (this._lastStatsText === text) return;
    this._lastStatsText = text;
    this._inventory.render();
  }

  public setEquippedIds(ids: Set<string>): void {
    this._equippedIds = ids;
  }

  public updateInventory(items: Item[]): void {
    this._inventoryItems = items;
    this._inventory.render();
  }

  public updateEquipment(slots: Map<EquipSlot, import("../systems/inventory-system").Item>): void {
    const slotLabels: { key: EquipSlot; label: string }[] = [
      { key: "mainHand", label: "Main Hand" },
      { key: "offHand",  label: "Off Hand"  },
      { key: "head",     label: "Head"      },
      { key: "chest",    label: "Chest"     },
      { key: "legs",     label: "Legs"      },
      { key: "feet",     label: "Feet"      },
    ];
    this._equipmentLines = slotLabels.map(({ key, label }) => `${label}: ${slots.get(key)?.name ?? "--"}`);
    this._inventory.render();
  }

  public setInteractionText(text: string): void {
    this.hud.setText(this.hud.interaction, text);
  }


  public showNotification(text: string, duration: number = 3000): void {
    this.hud.notify(text, duration);
  }



  public updateHealth(current: number, max: number): void {
    this.hud.setBar(this.hud.health, current, max);
  }

  public updateMagicka(current: number, max: number): void {
    this.hud.setBar(this.hud.magicka, current, max);
  }

  public updateStamina(current: number, max: number): void {
    this.hud.setBar(this.hud.stamina, current, max);
  }

  public updateXP(current: number, max: number, xpLevel: number, characterLevel: number): void {
    this.hud.setBar(this.hud.xp, current, max);
    this.hud.setText(this.hud.level, `CL ${characterLevel}\nLv.${xpLevel}`);
  }

  /**
   * Apply a trauma-based camera shake.
   * Higher intensity (> 0.5) creates violent shaking; lower (< 0.3) is subtle.
   */
  public shakeCamera(intensity: number = 0.5): void {
    this._cameraTrauma = Math.min(1.0, this._cameraTrauma + intensity);
    
    if (!this._cameraShakeObs) {
      this._cameraShakeObs = this.scene.onBeforeRenderObservable.add(() => {
        const camera = this.scene.activeCamera;
        if (!hasRotatableCamera(camera) || this._cameraTrauma <= 0) {
          if (this._cameraTrauma <= 0 && this._cameraShakeObs) {
            this.scene.onBeforeRenderObservable.remove(this._cameraShakeObs);
            this._cameraShakeObs = null;
            // Smoothly lerp back to 0 roll/z if needed
            if (hasRotatableCamera(camera)) camera.rotation.set(camera.rotation.x, camera.rotation.y, 0);
          }
          return;
        }

        const dt = this.scene.getEngine().getDeltaTime() / 1000;
        const shake = Math.pow(this._cameraTrauma, 2); // Squared trauma for more visceral curves
        
        // Use multiple sine waves at different frequencies for an organic "rumble" 
        // rather than pure white-noise jitter.
        const time = performance.now() * 0.001;
        const yaw   = (Math.sin(time * 50) + Math.sin(time * 26) * 0.5) * 0.04 * shake;
        const pitch = (Math.cos(time * 48) + Math.sin(time * 19) * 0.5) * 0.04 * shake;
        const roll  = (Math.sin(time * 30)) * 0.03 * shake;
        
        camera.rotation.y += yaw;
        camera.rotation.x += pitch;
        camera.rotation.z += roll;

        // Decay trauma over time
        this._cameraTrauma = Math.max(0, this._cameraTrauma - 1.4 * dt);
        
        // Return roll to zero
        camera.rotation.z *= 0.85;
      });
    }
  }

  /** Pre-allocate the impact spark pool (once): one sphere + own material each. */
  private _ensureSparkRows(): void {
    if (this._sparkRows.length > 0) return;
    for (let i = 0; i < 8; i++) {
      const spark = MeshBuilder.CreateSphere("impact_spark", { diameter: 0.15 }, this.scene);
      spark.isVisible = false;
      const mat = new StandardMaterial("spark_mat", this.scene);
      mat.disableLighting = true;
      mat.alpha = 1;
      spark.material = mat;
      this._sparkRows.push({ mesh: spark, mat, scale: 1, active: false });
    }
  }

  /**
   * Spawns a brief "spark" or impact flare at a world position.
   * Used for perfect blocks and critical hits.
   */
  public showSpark(position: Vector3, color: string = "#FFD700"): void {
    this._ensureSparkRows();

    let row = this._sparkRows.find((r) => !r.active)
      ?? this._sparkRows[0]; // all busy — reuse the oldest slot
    row.active = true;
    row.scale = 1;
    row.mesh.position.copyFrom(position);
    row.mesh.scaling.setAll(1);
    row.mat.emissiveColor = Color3.FromHexString(color);
    row.mat.alpha = 1;
    row.mesh.isVisible = true;

    if (!this._sparkObs) {
      this._sparkObs = this.scene.onBeforeRenderObservable.add(() => {
        const dt = this.scene.getEngine().getDeltaTime();
        const step = dt / (1000 / 60); // preserve the original per-frame rate at 60 fps
        let anyActive = false;
        for (const r of this._sparkRows) {
          if (!r.active) continue;
          r.scale += 0.4 * step;
          r.mat.alpha -= 0.15 * step;
          r.mesh.scaling.setAll(r.scale);
          if (r.mat.alpha <= 0) {
            r.mat.alpha = 1; // reset for the next reuse
            r.mesh.isVisible = false;
            r.active = false;
          } else {
            anyActive = true;
          }
        }
        if (!anyActive && this._sparkObs) {
          this.scene.onBeforeRenderObservable.remove(this._sparkObs);
          this._sparkObs = null;
        }
      });
    }
  }

  /**
   * Briefly pause or slow time for impact.
   * @param durationMs Milliseconds to freeze/slow time.
   */
  public applyHitStop(durationMs: number = 80): void {
    this.onHitStopRequested?.(durationMs);
  }

  /** Flash a translucent color overlay to signal being hit or dealing damage. */
  public showHitFlash(color: string = "red"): void {
    this.hud.showFlash(color);
  }

  /** Special curative flash (green/white) for healing events. */
  public showHealFlash(): void {
    this.showHitFlash("rgba(120, 255, 150, 0.35)");
  }

  /**
   * Spawn a floating damage number at the given world position.
   * It drifts upward and fades out over ~1 second.
   */
  public showDamageNumber(worldPos: Vector3, damage: number, scene: Scene, color?: string): void {
    const camera = scene.activeCamera;
    if (!camera) return;
    const engine = scene.getEngine();
    const w = engine.getRenderWidth(), h = engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(w, h);
    const screenPos = Vector3.Project(worldPos, Matrix.Identity(), scene.getTransformMatrix(), viewport);
    if (screenPos.z < 0 || screenPos.z > 1) return;
    // Render pixels → CSS pixels of the page.
    const rect = engine.getRenderingCanvas?.()?.getBoundingClientRect();
    const x = rect ? rect.left + screenPos.x * (rect.width / w) : screenPos.x;
    const y = rect ? rect.top + screenPos.y * (rect.height / h) : screenPos.y;
    this.hud.showDamageNumber(x, y, `-${damage}`, color ?? "#FF6030");
  }

  // ── Debug / Performance Overlay ───────────────────────────────────────────


  /**
   * Toggle the performance/debug overlay (F3).
   * Returns the new visibility state.
   */
  public toggleDebugOverlay(): boolean {
    this.isDebugVisible = !this.isDebugVisible;
    this.hud.debug.hidden = !this.isDebugVisible;
    return this.isDebugVisible;
  }

  /**
   * Update the debug overlay with live performance/world metrics.
   * Call once per second when the overlay is visible.
   */
  public updateDebugOverlay(metrics: {
    fps: number;
    drawCalls: number;
    activeMeshes: number;
    totalVertices: number;
    playerPos: { x: number; y: number; z: number };
    carryWeight: number;
    maxCarryWeight: number;
    currentCell: string;
    gameTime: string;
    stealthLabel: string;
    lodCulled?: number;
    weather?: string;
  }): void {
    if (!this.isDebugVisible) return;
    const lines = [
      `FPS:        ${metrics.fps.toFixed(0)}`,
      `Draw calls: ${metrics.drawCalls}`,
      `Meshes:     ${metrics.activeMeshes}`,
      `Vertices:   ${metrics.totalVertices.toLocaleString()}`,
      `Pos: ${metrics.playerPos.x.toFixed(1)}, ${metrics.playerPos.y.toFixed(1)}, ${metrics.playerPos.z.toFixed(1)}`,
      `Weight:     ${metrics.carryWeight.toFixed(0)}/${metrics.maxCarryWeight.toFixed(0)}`,
      `Cell:       ${metrics.currentCell}`,
      `Time:       ${metrics.gameTime}`,
      `Stealth:    ${metrics.stealthLabel}`,
    ];
    if (metrics.lodCulled !== undefined) {
      lines.push(`LOD culled: ${metrics.lodCulled}`);
    }
    if (metrics.weather !== undefined) {
      lines.push(`Weather:    ${metrics.weather}`);
    }
    this.hud.setText(this.hud.debug, lines.join("\n"));
  }

  // ── Stealth HUD ───────────────────────────────────────────────────────────


  /** Update the stealth eye indicator. Pass null to hide it. */
  public updateStealthHUD(label: "Hidden" | "Caution" | "Detected" | null): void {
    if (label === this._lastStealthHudLabel) return;
    this._lastStealthHudLabel = label;
    this.hud.setStealth(label);
  }

  // ── Clock HUD ─────────────────────────────────────────────────────────────


  /** Update the in-game clock display (under the compass). */
  public updateClock(timeString: string): void {
    this.hud.setText(this.hud.clock, timeString);
  }

  // ── Combat state readout ──────────────────────────────────────────────────

  /**
   * Show a short transient combat-state line above the quick-slots
   * ("Combo ×2", "FINISHER READY", "Riposte ready!").  Pass null to hide.
   */
  public updateCombatState(text: string | null): void {
    this.hud.setCombatState(text);
  }

  // ── Attribute Panel ───────────────────────────────────────────────────────

  public toggleAttributePanel(visible: boolean): void {
    this.isAttributePanelOpen = visible;
    if (visible) {
      this._attributePanel.open({
        onSpend: (name) => this.onAttributeSpend?.(name),
        onClose: () => this._closedByPlayer("attributes", () => this.toggleAttributePanel(false)),
      });
    } else {
      this._attributePanel.close();
    }
    this._syncCrosshairVisibility();
  }

  /** Show the current attribute values and pending points. */
  public refreshAttributePanel(attributes: AttributeSystem): void {
    this._attributePanel.refresh(attributes);
  }


  // ── Wait Dialog ───────────────────────────────────────────────────────────



  public toggleWaitDialog(visible: boolean): void {
    this.isWaitDialogOpen = visible;
    if (visible) {
      this._waitDialog.open({
        onWait: (hours) => {
          this.onWaitConfirm?.(hours);
          this._closedByPlayer("wait", () => this.toggleWaitDialog(false));
        },
        onCancel: () => this._closedByPlayer("wait", () => this.toggleWaitDialog(false)),
      });
    } else {
      this._waitDialog.close();
    }
    this._syncCrosshairVisibility();
  }


  // ── Compass HUD ───────────────────────────────────────────────────────────


  /**
   * Update the compass strip from the camera's Y-axis rotation.
   *
   * @param yawRadians  Camera yaw in radians (camera.rotation.y in Babylon.js).
   *                    Positive values rotate clockwise (East).
   */
  public updateCompass(yawRadians: number): void {
    // Normalise yaw to [0, 360)
    const deg = ((yawRadians * (180 / Math.PI)) % 360 + 360) % 360;

    // Map degrees to compass segments (each segment = 45°, centred on its direction)
    const idx = Math.round(deg / 45) % 8;
    if (idx === this._lastCompassIndex) return;
    this._lastCompassIndex = idx;

    // Show three visible directions; the current facing direction is wrapped in
    // angle brackets to visually distinguish it from its neighbours.
    const prev = COMPASS_DIRECTIONS[(idx + 7) % 8];
    const curr = COMPASS_DIRECTIONS[idx];
    const next = COMPASS_DIRECTIONS[(idx + 1) % 8];

    this.hud.setText(this.hud.compass, `${prev}  ‹ ${curr} ›  ${next}`);
  }
}
