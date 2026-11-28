/**
 * The frame: the gameplay step (simulation at the loop's time scale) and the HUD's sources.
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { type HudSources } from "../ui/hud-presenter";
import { weaponArchetypeOf } from "./weapon-archetype";
import { updateDynamicWorldEventsOnHourChange } from "./rewards";
import { recoverFallenNpc } from "./npcs";
import { isCombatInputBlocked } from "./play-focus";
import { Vector3 } from "@babylonjs/core/Maths/math.vector"; import { owedTimeOf } from "../core/owed-time";

/** XP awarded to the Sneak skill for each second of active sneaking. */
const SNEAK_XP_PER_SECOND = 2;
/** NPCs below this height fell through the world (e.g. spawned before their chunk). */
const NPC_FALL_RECOVERY_Y = -30;

export function updateGameplayStep(g: Game, deltaTime: number): void {
  g.player.update(deltaTime);
  g.audioSystem.updateFootsteps(deltaTime, g.player.camera.position, { mounted: g.mounts?.horses.isMounted, crouching: g.stealthSystem.isCrouching, airborne: !g.player.camera.applyGravity || g.swimSystem.isSubmerged });
  g.world.update(g.player.camera.position);

  g.timeSystem.update(deltaTime);
  updateDynamicWorldEventsOnHourChange(g);

  // LOD tiers first: the schedules and NPC visuals read them.
  g._npcTiers.update(g.player.camera.position, g.scheduleSystem.npcs);
  g.scheduleSystem.update(deltaTime);
  // Kernel features (indoors, raids, …) run their fixed-step systems here,
  // right after the schedules they react to.
  g.kernel.phases.run("sim", deltaTime);
  g.combatSystem.update(deltaTime);
  // Slow Time squeezes the NPC AI clock (movement, telegraphs, strikes).
  g.combatSystem.updateNPCAI(deltaTime * g.shouts.hostileTimeScale());

  for (const npc of g.scheduleSystem.npcs) {
    if (npc.mesh.position.y < NPC_FALL_RECOVERY_Y && !npc.isDead) recoverFallenNpc(g, npc);
  }
  g._npcVisuals.update(deltaTime, g.player.camera.position, g.scheduleSystem.npcs);
  g.interactionSystem.update();

  const weatherScale = g.weatherSystem?.state === "clear" ? 1.0 : (g.weatherSystem?.fogDensity ? 0.7 : 1.0);
  const compositeLight = g.timeSystem.ambientIntensity * weatherScale;
  g.stealthSystem.shadowFactor = compositeLight;
  // Detection (and its occlusion raycasts) pauses while any modal UI is
  // open — the player can't act, so detection shouldn't build or expire.
  if (!isCombatInputBlocked(g)) {
    g.stealthSystem.update(deltaTime, compositeLight);
    if (g.stealthSystem.isCrouching && g.stealthSystem.sneakingPast > 0) { // past someone, not alone in a field
      g.skillProgressionSystem.gainXP(
        "sneak", deltaTime * SNEAK_XP_PER_SECOND * g.classSystem.xpMultiplierFor("sneak"),
      );
    }
  }

  g.projectileSystem.update(deltaTime);
  g.spellSystem.update(deltaTime);

  g._lastLodCulled = g.lodSystem.update(g.player.camera.position);
  g.navigationSystem.update(deltaTime);
  // Autosave only fires when real state changes mark the save dirty — no per-tick markDirty.
  g.saveSystem.tickAutosave(deltaTime);
  const cx = Math.floor(g.player.camera.position.x / g.world.chunkSize);
  const cz = Math.floor(g.player.camera.position.z / g.world.chunkSize);
  if (cx !== g._lastNavChunkX || cz !== g._lastNavChunkZ) {
    g._lastNavChunkX = cx;
    g._lastNavChunkZ = cz;
    g.navigationSystem.requestRebuild();

    // Dynamic region transition check
    const currentRegion = g.world.getRegionAt(cx, cz);
    const regId = currentRegion ? currentRegion.id : null;
    if (regId !== g._lastRegionId) {
      g._lastRegionId = regId;
      if (currentRegion) {
        g.ui.showNotification(
          `📍 Entered ${currentRegion.name} (Danger ${currentRegion.dangerLevel}/10)`,
          3500,
        );
      }
    }
  }

  // ── Throttled systems (don't run every frame) ──────────────────────────
  g._systemTickCounter++;
  const tick = g._systemTickCounter;

  // weatherSystem: 10 Hz (every 6th frame at 60fps).  The clock is blended
  // into its light application so day/night darken the scene (sun dies at
  // night, ambient keeps a readable floor, fog follows).
  g.weatherSystem.daylightScale = g.timeSystem.ambientIntensity;
  // Each throttled system is given all the time since its last call (one
  // step's was a sixth, half, a third of it: effects, breath, weather ran slow).
  const owed = owedTimeOf(g).pass(deltaTime, "weather", "effects", "swim");
  if (tick % 6 === 0) g.weatherSystem.update(owed.take("weather"));
  if (tick % 2 === 0) g.activeEffectsSystem.update(owed.take("effects"), g.player); // 30 Hz
  if (tick % 3 === 0) g.swimSystem.update(owed.take("swim"), g.player); // 20 Hz

  // crimeSystem: every step — its guard-challenge cooldown decays by the
  // passed delta, so starving it to a 1 Hz call made the 15 s cooldown
  // take ~15 real minutes. It early-returns while no bounty is active.
  g.crimeSystem.update(deltaTime);

  // merchantRestockSystem: ~1 Hz (every 60 frames)
  if (tick % 60 === 0) {
    const gameTime = g.timeSystem.elapsedGameTime;
    g.respawnSystem.update(gameTime);
    g.merchantRestockSystem.update(gameTime, g.barterSystem);
  }

  if (tick >= 3600) g._systemTickCounter = 0;
}

export function hudSources(g: Game): HudSources {
  // eslint-disable-next-line @typescript-eslint/no-g-alias -- getters below
  const game = g;
  return g._hudSourcesCache ??= {
    get engine() { return game.engine; },
    get scene() { return game.scene; },
    get ui() { return game.ui; },
    get player() { return game.player; },
    get time() { return game.timeSystem; },
    get stealth() { return game.stealthSystem; },
    get combat() { return game.combatSystem; },
    get effects() { return game.activeEffectsSystem; },
    get effectsHud() { return game.activeEffectHUD; },
    get quickSlots() { return game.quickSlotSystem; },
    get quickSlotsHud() { return game.quickSlotHUD; },
    characterLevel: () => g.playerLevelSystem.characterLevel,
    inventoryOpen: () => g.inventorySystem.isOpen,
    talking: () => g.dialogueSystem.isInDialogue,
    // Any registered panel, plus the two that Escape can't close.
    overlayOpen: () => g._modals.anyOpen() || g.levelUpUI.isVisible || g.guardEncounterUI.isVisible,
    cellName: () => g.cellManager.currentCell?.name ?? "exterior",
    weatherLabel: () => g.weatherSystem.label,
    lodCulled: () => g._lastLodCulled,
  };
}

/** Map the equipped main-hand item to a combat weapon archetype (default: sword). */
export function syncWeaponArchetype(g: Game): void {
  const weapon = g.equipmentSystem.getEquipped().get("mainHand");
  const archetype = weaponArchetypeOf(weapon);
  g.combatSystem.setWeaponArchetype(archetype);
  g._viewModel?.setWeapon(archetype);
}

export function runFrame(g: Game): void {
  if (g.isPaused) return;

  const frameDelta = g.engine.getDeltaTime() / 1000;

  const scaleLevel = g._adaptiveRes?.update(frameDelta, g.engine.getFps());
  if (scaleLevel) g.engine.setHardwareScalingLevel(scaleLevel);

  // Poll gamepad state every frame
  g._gamepadInput?.update(frameDelta);

  // Apply gamepad left stick to camera movement (smooth analog)
  const pad = g._gamepadInput;
  if (pad?.isConnected && !isCombatInputBlocked(g)) {
    const lx = pad.leftStickX;
    const ly = pad.leftStickY;
    if (Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15) {
      const speed = g.player.camera.speed * frameDelta * 60;
      const forward = g.player.getForwardDirection(1);
      const right = Vector3.Cross(forward, Vector3.Up()).normalize();
      const moveVec = forward.scale(ly * speed).add(right.scale(lx * speed));
      g.player.camera.position.addInPlace(moveVec);
    }
  }

  g._gameplayLoop.tick(frameDelta, (deltaTime) => {
      updateGameplayStep(g, deltaTime);
  });

  // After the gameplay step: WeatherSystem writes raw light/fog values on
  // its ticks, and the atmosphere composes the final ones on top.
  g._env.update(frameDelta);

  // Conversation framing (turn to the speaker, zoom in / back out), and
  // ending it if the speaker is gone or the player was moved away.
  g.dialogueSystem.update(frameDelta);
  g._camera.update(frameDelta);

  if (g._viewModel) {
    g._viewModel.setVisible(
      g.player.health > 0 && !g.dialogueSystem.isInDialogue && !g.mapEditorActive,
    );
    g._viewModel.update(frameDelta, {
      blocking: g.combatSystem.isBlocking,
      sprinting: g.stealthSystem.movementMode === "running",
    });
  }

  // Features' HUD pieces (companion, follower, shout chips), then the bars and readouts.
  g.kernel.phases.run("ui", frameDelta);
  g._hud.update();
}
