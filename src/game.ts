import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { GameEventBus } from "./systems/event-bus";
import { Kernel } from "./core/kernel";
import type { EditorFactory } from "./game/editor-plugin";
import { installGameFeatures } from "./game/game-services";
import { runFrame } from "./game/game-loop";
import { togglePause } from "./game/play-focus";
import { wireEarlyReactions } from "./game/reactions";
import { setupScene } from "./game/setup-scene";
import { setupCoreSystems } from "./game/setup-core";
import { setupGameplaySystems } from "./game/setup-gameplay";
import { setupWorldSystems } from "./game/setup-world";
import { setupProgressionAndStart } from "./game/setup-progression";
import { wireGameplay } from "./game/setup-wiring";
import { GameState } from "./game/game-state";

/**
 * The composition root.  Members named with a leading underscore are the
 * root's own parts, shared with its setup modules in src/game/ (they are
 * not for features, which reach the game through services).
 */
export class Game extends GameState {
  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine, public readonly _editorFactory?: EditorFactory) {
    super();
    this.scene = scene;
    this.canvas = canvas;
    this.engine = engine;

    this.init();
  }

  init(): void {
    // The event bus first: systems report on it as they are made.
    this.eventBus = new GameEventBus();
    this.kernel = new Kernel({ events: this.eventBus });
    wireEarlyReactions(this);
    // Then the game, in order (each step is a module in src/game/).
    setupScene(this);
    setupCoreSystems(this);
    setupGameplaySystems(this);
    setupWorldSystems(this);
    setupProgressionAndStart(this);
    wireGameplay(this);
  }

  /** One frame: input, simulation at the loop's time scale, the HUD (see game/game-loop.ts). */
  update(): void {
    runFrame(this);
  }

  /** Pause or resume (the pause menu, Escape). */
  togglePause(): void {
    togglePause(this);
  }

  /** Wire the features to the game (src/game/game-services.ts). */
  public _installFeatures(): void {
    installGameFeatures(this);
  }
}
