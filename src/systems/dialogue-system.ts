import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC, AIState } from "../entities/npc";
import { Player } from "../entities/player";
import { DialogueSession } from "../framework/dialogue/dialogue-engine";
import { DialogueNodeView } from "../framework/dialogue/dialogue-types";
import { DialogueBoxPanel } from "../ui/dialogue-box";
import { DialogueCamera } from "./dialogue-camera";
import type { GameEventBus } from "./event-bus";

/** Speaker's face, relative to the NPC capsule centre (1 m above its feet). */
const NPC_FACE_OFFSET_Y = 0.62;
/** A conversation ends if the player ends up farther than this (m) from the speaker. */
const MAX_TALK_DISTANCE = 7;

export interface DialogueChoiceOption {
  text: string;
  callback: () => void;
  enabled: boolean;
  /** Why a locked choice is unavailable (shown next to it). */
  reason?: string;
}

/** "Innkeeper_10234" → "Innkeeper". */
export function displayNameOf(meshName: string): string {
  return meshName.replace(/_\d+$/, "");
}

export class DialogueSystem {
  /** Where this reports what happened (the game's event bus). */
  public events: GameEventBus | null = null;

  public scene: Scene;
  public player: Player;
  public npcs: NPC[];
  public canvas: HTMLCanvasElement;

  private readonly _box = new DialogueBoxPanel();
  private _speaker = "";
  private _text = "";
  /**
   * Framing: the player's own camera turns to the speaker and
   * zooms in.  The game calls `camera.update(dt)` every frame.
   */
  public readonly camera = new DialogueCamera();
  private _isInDialogue: boolean = false;
  /** Highlighted choice (keyboard / hover); -1 = none. */
  private _selected = -1;
  /** Bumped on every render so stale button callbacks can't fire twice. */
  private _renderToken = 0;
  private _activeSession: DialogueSession | null = null;
  private _activeNpc: NPC | null = null;
  private _choices: DialogueChoiceOption[] = [];
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;

  // Scratch vectors for performance optimization
  private readonly _face: Vector3 = new Vector3();

  /**
   * Who has the player's input (the game's PlayFocus).  When set, a
   * conversation holds it instead of locking the pointer itself.
   */
  public focus: { take(holder: "dialogue"): void; give(holder: "dialogue"): void } | null = null;
  /** False when a camera director runs the framing as one of its shots. */
  public driveCamera = true;
  /** Optional session factory. If provided, dialogue UI is driven by framework data. */
  public dialogueSessionProvider: ((npc: NPC) => DialogueSession | null) | null = null;

  public get isInDialogue(): boolean {
    return this._isInDialogue;
  }

  public get choices(): ReadonlyArray<DialogueChoiceOption> {
    return this._choices;
  }

  constructor(scene: Scene, player: Player, npcs: NPC[], canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.player = player;
    this.npcs = npcs;
    this.canvas = canvas;
  }

  public startDialogue(npc: NPC): void {
    if (this._isInDialogue) return;
    this._isInDialogue = true;
    this._activeNpc = npc;
    npc.isInDialogue = true;
    this._activeSession = null;
    this.events?.emit("dialogue:started", { npcName: npc.key });

    // Frame the speaker with the player's own camera (no cut, so the post
    // pipeline and fog stay as they are): turn to the face and zoom in.
    this.camera.begin(this.player.camera, () => {
      if (npc.mesh.isDisposed?.()) return null;
      const p = npc.mesh.position;
      return this._face.set(p.x, p.y + NPC_FACE_OFFSET_Y, p.z);
    });

    // Detach player controls and free the cursor so choices can be clicked.
    if (this.focus) {
      this.focus.take("dialogue");
    } else {
      this.player.camera.detachControl();
      try {
        if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
      } catch (_) {
        // headless — ignore
      }
    }

    this._choices = [];

    const session = this.dialogueSessionProvider ? this.dialogueSessionProvider(npc) : null;
    const node = session?.getCurrentNode() ?? null;
    if (session && node) {
      this._activeSession = session;
      this._renderNode(node);
      return;
    }

    if (session && !node) {
      if (import.meta.env.DEV) {
        console.warn(
          "[DialogueSystem] Framework session returned no current node; ending dialogue.",
          { npc: npc.key },
        );
      }
      this.endDialogue();
      return;
    }

    // Fallback dialogue with generic rumors when no framework session exists.
    const name = displayNameOf(npc.key);
    const farewell = (text: string) => ({ text, callback: () => this.endDialogue(), enabled: true });
    const rumours = () => this._render(name, "Aye, there's talk of strange lights near the old ruins to the north. Folk say it's best not to linger after dark.", [
      { text: "Sounds dangerous.", enabled: true, callback: () => this._render(name, "That it is. But fortune favors the bold, they say. Safe travels.", [farewell("Farewell.")]) },
      farewell("I'll keep that in mind. Goodbye."),
    ]);
    this._render(name, "Greetings, traveler. What can I do for you?", [
      farewell("Just passing through."),
      { text: "Any rumors worth hearing?", enabled: true, callback: rumours },
      farewell("Goodbye."),
    ]);
  }

  private _renderNode(node: DialogueNodeView): void {
    const options: DialogueChoiceOption[] = node.choices.length === 0
      ? [{ text: "Goodbye.", callback: () => this.endDialogue(), enabled: true }]
      : node.choices.map((choice) => ({
        text: choice.text,
        enabled: choice.isAvailable,
        reason: choice.isAvailable ? undefined : choice.blockedBy,
        callback: () => this._handleFrameworkChoice(choice.id),
      }));
    this._render(node.speaker, node.text, options);
  }

  /**
   * Show a line and its choices.  Every choice is numbered by position
   * (locked ones too, so numbers never shift).
   */
  private _render(speaker: string, text: string, options: DialogueChoiceOption[]): void {
    ++this._renderToken;
    this._speaker = speaker;
    this._text = text;
    this._choices = options;
    this._setSelected(options.findIndex((o) => o.enabled));
    this._installKeyHandler();
  }

  /** Draw the box from the current line, choices and highlight. */
  private _draw(): void {
    if (!this._isInDialogue) return;
    const token = this._renderToken;
    this._box.show({
      speaker: this._speaker,
      text: this._text,
      choices: this._choices,
      selected: this._selected,
      onHover: (i) => { if (i !== this._selected) this._setSelected(i); },
      onPick: (i) => this._activate(i, token),
    });
  }

  private _handleFrameworkChoice(choiceId: string): void {
    if (!this._activeSession) {
      this.endDialogue();
      return;
    }

    const result = this._activeSession.choose(choiceId);
    if (!result.success && result.currentNode) {
      this._renderNode(result.currentNode);
      return;
    }
    if (result.isComplete || !result.currentNode) {
      this.endDialogue();
      return;
    }
    this._renderNode(result.currentNode);
  }

  /** Run a choice once, and only if it belongs to the current render. */
  private _activate(index: number, token = this._renderToken): void {
    if (token !== this._renderToken || !this._isInDialogue) return;
    const choice = this._choices[index];
    if (!choice?.enabled) return;
    this._renderToken++; // a second click / key repeat can't fire it again
    choice.callback();
  }

  private _setSelected(index: number): void {
    this._selected = index;
    this._draw();
  }

  /** Move the highlight to the next enabled choice in `dir` (wrapping). */
  private _moveSelection(dir: 1 | -1): void {
    const n = this._choices.length;
    if (n === 0) return;
    let i = this._selected;
    for (let step = 0; step < n; step++) {
      i = (i + dir + n) % n;
      if (this._choices[i].enabled) {
        this._setSelected(i);
        return;
      }
    }
  }

  private _installKeyHandler(): void {
    this._removeKeyHandler();
    this._keyHandler = (e: KeyboardEvent) => {
      if (!this._isInDialogue) return;
      const swallow = () => { e.preventDefault(); e.stopPropagation(); };
      switch (e.key) {
        case "Escape":
          swallow();
          this.endDialogue();
          return;
        case "ArrowDown": case "s": case "S":
          swallow();
          this._moveSelection(1);
          return;
        case "ArrowUp": case "w": case "W":
          swallow();
          this._moveSelection(-1);
          return;
        case "Enter": case " ": case "e": case "E":
          swallow();
          if (!e.repeat && this._selected >= 0) this._activate(this._selected);
          return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 0 && n <= 9) {
        // Digits belong to the conversation (never the quick-slot bar).
        swallow();
        if (e.repeat || n === 0) return;
        const choice = this._choices[n - 1];
        if (choice && choice.enabled) {
          this._renderToken++;
          choice.callback();
        }
      }
    };
    window.addEventListener("keydown", this._keyHandler, true);
  }

  private _removeKeyHandler(): void {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler, true);
      this._keyHandler = null;
    }
  }

  /**
   * Per frame: drive the camera, and end the conversation if the speaker is
   * gone (dead, unloaded, hidden, hostile) or the player was moved away.
   */
  public update(dt: number): void {
    // With a camera director the framing is one of its shots (see game.ts).
    if (this.driveCamera) this.camera.update(dt);
    const npc = this._activeNpc;
    if (!this._isInDialogue || !npc) return;
    const mesh = npc.mesh as { isDisposed?: () => boolean; isEnabled?: () => boolean; position: { x: number; z: number } };
    // Actually fighting or fleeing — not merely suspicious (ALERT/INVESTIGATE
    // also set the legacy isAggressive flag).
    const fighting = npc.aiState === AIState.CHASE || npc.aiState === AIState.ATTACK || npc.aiState === AIState.FLEE;
    const gone = mesh.isDisposed?.() || npc.isDead || fighting || mesh.isEnabled?.() === false;
    const p = this.player.camera.position;
    const far = Math.hypot(p.x - mesh.position.x, p.z - mesh.position.z) > MAX_TALK_DISTANCE;
    if (gone || far) this.endDialogue();
  }

  public endDialogue(): void {
    if (!this._isInDialogue) return;
    this._isInDialogue = false;
    this._removeKeyHandler();
    if (this._activeNpc) {
      this._activeNpc.isInDialogue = false;
      this._activeNpc = null;
    }
    this._activeSession = null;
    this._choices = [];
    this._selected = -1;
    this._renderToken++;
    this._box.hide();

    // Ease the zoom back out (the player is left facing the speaker).
    this.camera.end();

    // Restore controls and pointer lock so mouse-look works immediately.
    // Wrapped in try/catch so tests running in a headless Node environment
    // don't fail when canvas.requestPointerLock() is not available.
    if (this.focus) {
      this.focus.give("dialogue");
    } else {
      try {
        this.canvas.requestPointerLock();
        this.player.camera.attachControl(this.canvas, true);
      } catch (_) {
        // headless / test environment — ignore
      }
    }

    this.events?.emit("dialogue:closed", {});
  }
}
