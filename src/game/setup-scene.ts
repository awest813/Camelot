/**
 * Start-up, the scene: resolution, picking, the player, HUD, world, environment, NPC visuals, villages and navigation.
 *
 * Part of the composition root: a stretch of the game's start-up, moved out
 * of game.ts.
 */
import type { Game } from "../game";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { createTerrainMaterial } from "../rendering/terrain-material";
import { WeaponViewModel } from "../rendering/viewmodel";
import { AdaptiveResolution } from "../rendering/adaptive-resolution";
import { NpcVisuals } from "../rendering/npc-visuals";
import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";
import { WorldManager } from "../world/world-manager";
import { ScheduleSystem } from "../systems/schedule-system";
import { NavigationSystem } from "../systems/navigation-system";
import { WorldEnvironment } from "../rendering/world-environment";

export function setupScene(g: Game): void {
  // Apply the tier's hardware scaling level before the first render.
  g.engine.setHardwareScalingLevel(g.graphics.performance.hardwareScalingLevel);
  g._adaptiveRes = new AdaptiveResolution({
    baseLevel: g.graphics.performance.hardwareScalingLevel,
    targetFps: g.graphics.performance.targetFps,
  });
  // `camelot_adaptive_res=0` pins the resolution (benchmarks, screenshot tests).
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("camelot_adaptive_res") === "0") {
      g._adaptiveRes.enabled = false;
    }
  } catch { /* storage unavailable */ }
  // All picking is explicit (raycasts, editor clicks); skip Babylon's
  // automatic pick on every pointer move.
  g.scene.skipPointerMovePicking = true;
  g._env = new WorldEnvironment({
    scene: g.scene,
    graphics: g.graphics,
    dayFraction: () => g.timeSystem?.normalizedTime ?? null,
    weather: () => g.weatherSystem ?? null,
    playerPosition: () => g.player?.camera.position ?? null,
  });
  g._env.initLights();
  g.player = new Player(g.scene, g.canvas);
  // Post-processing and skybox require the camera, so initialise after Player.
  g._env.initSky(g.player.camera);
  g._npcVisuals = new NpcVisuals({
    scene: g.scene,
    shadows: g.shadowGenerator,
    modelBase: `${import.meta.env.BASE_URL ?? "/"}model/kaykit/`,
    animation: () => g.animationSystem,
  });
  g._npcVisuals.init();
  g._viewModel = new WeaponViewModel(
    g.scene, g.player.camera, `${import.meta.env.BASE_URL ?? "/"}model/kaykit/weapons/`,
  );
  g.ui = new UIManager(g.scene);
  g.world = new WorldManager(g.scene, g.shadowGenerator, null, g.graphics.texture);
  g.world.terrainMaterial = createTerrainMaterial(g.scene, g.world.textureManager);
  // Village settlements keep their footprint clear of trees, rocks and ruins.
  // (Called once chunks stream in, after the villages feature is installed.)
  g.world.clearingAt = (cx, cz) => g.villages.clearingAt(cx, cz);
  g._env.initFoliage(g.world);
  g.navigationSystem = new NavigationSystem(g.scene);
  g.scheduleSystem = new ScheduleSystem();
  // Villagers walking to work, home or a wander spot follow navmesh routes.
  g.scheduleSystem.nav = g.navigationSystem;
  g.scheduleSystem.walkable = (x, z) => g._chunks.isWalkable(x, z);
}
