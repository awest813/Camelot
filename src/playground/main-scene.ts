import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Game } from "../game";
import type { EditorFactory } from "../game/editor-plugin";

export default class MainScene {
  public readonly game: Game;

  constructor(private scene: Scene, private canvas: HTMLCanvasElement, private engine: Engine | WebGPUEngine, editors?: EditorFactory) {
    const game = this.game = new Game(this.scene, this.canvas, this.engine, editors);
    // Dev-only handle for in-browser debugging and the visual-shots e2e spec.
    if (import.meta.env.DEV) {
      (window as unknown as { __camelotGame?: Game }).__camelotGame = game;
    }
  }
}
