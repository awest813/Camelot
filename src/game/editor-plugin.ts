/**
 * What the game knows of the editors: this interface and nothing else.
 * The game app runs without them; the editor app (editor.html →
 * editor-main.ts) builds the same game and plugs the editor suite in through
 * {@link EditorFactory}, so play-testing is the real game.  Keeping editor
 * code out of the game bundle is checked after each build
 * (tools/check-bundle.mjs).
 *
 * Engine overhaul, Phase 9.
 */
import type { Game } from "../game";

/** Game input hand-off and notifications the editors need. */
export interface EditorHooks {
  /** Give input to a panel (release the pointer, stop the camera). */
  suspendGameplay(): void;
  /** Give input back to play. */
  restoreGameplay(): void;
  /** The map editor holds input while it is on. */
  editorMode(on: boolean): void;
  /** The map editor turned on or off (e.g. refresh the help overlay). */
  modeChanged(): void;
}

/** A panel the game's modal registry can close (Escape, pausing). */
export interface EditorWindow {
  readonly id: string;
  isOpen(): boolean;
  close(): void;
}

export interface EditorPlugin {
  /** True while the map editor holds the world. */
  readonly mapEditorActive: boolean;
  /** Keys play didn't take (map editor chords, the tool shortcuts). */
  handleKey(ev: KeyboardEvent): void;
  toggleMapEditor(): void;
  exitMapEditor(opts?: { quiet?: boolean }): void;
  /** G in the map editor: the next gizmo mode, by name. */
  cycleGizmo(): string;
  /** The tool windows, for the modal registry. */
  windows(): EditorWindow[];
  /** The player is in the world (after character creation): restore a saved workspace draft. */
  started(): void;
}

export type EditorFactory = (game: Game, hooks: EditorHooks) => EditorPlugin;
