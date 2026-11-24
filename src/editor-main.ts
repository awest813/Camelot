/**
 * The editor app (editor.html): the game with the editor suite plugged in.
 * The map editor, the content creators, the bundle tools and the asset
 * browser work on the live world, so a play-test is the real game: leave
 * the map editor (Esc / F2) and play.  Shift+Ctrl+Alt+I opens Babylon's
 * inspector, loaded on first use.
 *
 * Engine overhaul, Phase 9.
 */
import { App } from "./app";
import { EditorSuite } from "./features/editor/editor-suite";

const app = new App({ editors: (game, hooks) => new EditorSuite(game, hooks) });
document.title = "Camelot Editor";

let inspector: Promise<unknown> | null = null;
window.addEventListener("keydown", (ev) => {
  if (ev.repeat || !(ev.shiftKey && ev.ctrlKey && ev.altKey && ev.code === "KeyI")) return;
  const scene = app.scene;
  if (!scene) return;
  inspector ??= Promise.all([import("@babylonjs/core/Debug/debugLayer"), import("@babylonjs/inspector")]);
  void inspector.then(() => {
    if (scene.debugLayer.isVisible()) void scene.debugLayer.hide();
    else void scene.debugLayer.show();
  });
});
