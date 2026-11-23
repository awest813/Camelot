import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui/2D";
import { NPC, AIState } from "../entities/npc";
import { Player } from "../entities/player";
import { DialogueSession } from "../framework/dialogue/dialogue-engine";
import { DialogueNodeView } from "../framework/dialogue/dialogue-types";
import { SHARED_UI_PANEL as D } from "../ui/ui-manager";
import { keepGuiAtCssResolution } from "../ui/gui-resolution";
import { DialogueCamera } from "./dialogue-camera";

/** Speaker's face, relative to the NPC capsule centre (1 m above its feet). */
const NPC_FACE_OFFSET_Y = 0.62;
/** A conversation ends if the player ends up farther than this (m) from the speaker. */
const MAX_TALK_DISTANCE = 7;

// Panel layout (px).
const PANEL_WIDTH = 820;
const HEADER_HEIGHT = 58;
const CHOICE_HEIGHT = 42;
const LINE_HEIGHT = 24;
/** Rough characters per line of the italic speech text at 17px in the panel. */
const CHARS_PER_LINE = 86;

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

/** Estimated wrapped line count for the speech text. */
export function estimateLines(text: string, charsPerLine = CHARS_PER_LINE): number {
  let lines = 0;
  for (const para of text.split("\n")) lines += Math.max(1, Math.ceil(para.length / charsPerLine));
  return lines;
}

export class DialogueSystem {
  public scene: Scene;
  public player: Player;
  public npcs: NPC[];
  public canvas: HTMLCanvasElement;

  private _ui: AdvancedDynamicTexture;
  private _dialoguePanel: Rectangle;
  private _nameLabel: TextBlock;
  private _textBlock: TextBlock;
  private _choicesPanel: StackPanel;
  /**
   * Bethesda-style framing: the player's own camera turns to the speaker and
   * zooms in.  The game calls `camera.update(dt)` every frame.
   */
  public readonly camera = new DialogueCamera();
  private _isInDialogue: boolean = false;
  private _choiceCount: number = 0;
  private _buttons: Button[] = [];
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

  /** Fired with the NPC's mesh name when a conversation begins. */
  public onTalkStart: ((npcName: string) => void) | null = null;
  /** Fired after dialogue UI and cinematic camera are torn down (pointer lock restored). */
  public onDialogueClosed: (() => void) | null = null;
  /**
   * Who has the player's input (the game's PlayFocus).  When set, a
   * conversation holds it instead of locking the pointer itself.
   */
  public focus: { take(holder: "dialogue"): void; give(holder: "dialogue"): void } | null = null;
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
    this._initUI();
  }

  private _initUI(): void {
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI("DialogueUI");
    keepGuiAtCssResolution(this._ui, this.scene?.getEngine?.());

    // Main Panel (Bottom)
    this._dialoguePanel = new Rectangle();
    this._dialoguePanel.width = `${PANEL_WIDTH}px`;
    this._dialoguePanel.height = "290px";
    this._dialoguePanel.cornerRadius = 8;
    this._dialoguePanel.color = D.PANEL_BORDER;
    this._dialoguePanel.thickness = 2;
    this._dialoguePanel.background = D.PANEL_BG;
    this._dialoguePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._dialoguePanel.top = "-18px";
    this._dialoguePanel.isVisible = false;
    this._ui.addControl(this._dialoguePanel);

    // NPC name header
    this._nameLabel = new TextBlock();
    this._nameLabel.text = "";
    this._nameLabel.color = D.TITLE;
    this._nameLabel.fontSize = 16;
    this._nameLabel.fontWeight = "bold";
    this._nameLabel.height = "50px";
    this._nameLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._nameLabel.paddingTop = "12px";
    this._nameLabel.paddingLeft = "20px";
    this._nameLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._nameLabel.shadowColor = "rgba(0,0,0,0.9)";
    this._nameLabel.shadowBlur = 4;
    this._dialoguePanel.addControl(this._nameLabel);

    // Separator below header area
    const sep = new Rectangle();
    sep.width = "96%";
    sep.height = "1px";
    sep.background = D.PANEL_BORDER;
    sep.thickness = 0;
    sep.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    sep.top = "54px";
    this._dialoguePanel.addControl(sep);

    // NPC dialogue text
    this._textBlock = new TextBlock();
    this._textBlock.text = "";
    this._textBlock.color = D.TEXT;
    this._textBlock.fontSize = 17;
    this._textBlock.fontStyle = "italic";
    this._textBlock.textWrapping = true;
    this._textBlock.height = `${LINE_HEIGHT * 2}px`;
    this._textBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._textBlock.top = `${HEADER_HEIGHT + 4}px`;
    this._textBlock.paddingLeft = "20px";
    this._textBlock.paddingRight = "20px";
    this._textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._textBlock.shadowColor = "rgba(0,0,0,0.8)";
    this._textBlock.shadowBlur = 3;
    this._dialoguePanel.addControl(this._textBlock);

    // Choices Panel
    this._choicesPanel = new StackPanel();
    this._choicesPanel.height = "130px";
    this._choicesPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._choicesPanel.paddingBottom = "16px";
    // An explicit width (rather than side padding) keeps 100%-wide buttons
    // inside the panel; with padding their right edge was clipped.
    this._choicesPanel.width = `${PANEL_WIDTH - 40}px`;
    this._choicesPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this._dialoguePanel.addControl(this._choicesPanel);
  }

  public startDialogue(npc: NPC): void {
    if (this._isInDialogue) return;
    this._isInDialogue = true;
    this._activeNpc = npc;
    npc.isInDialogue = true;
    this._activeSession = null;
    if (this.onTalkStart) this.onTalkStart(npc.mesh.name);

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

    // Show UI
    this._choiceCount = 0;
    this._choices = [];
    this._dialoguePanel.isVisible = true;

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
          { npc: npc.mesh.name },
        );
      }
      this.endDialogue();
      return;
    }

    // Fallback dialogue with generic rumors when no framework session exists.
    const name = displayNameOf(npc.mesh.name);
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
   * (locked ones too, so numbers never shift); the panel grows to fit the
   * text and the choice list.
   */
  private _render(speaker: string, text: string, options: DialogueChoiceOption[]): void {
    const token = ++this._renderToken;
    this._nameLabel.text = `✦  ${speaker}`;
    this._textBlock.text = `"${text}"`;
    this._choicesPanel.clearControls();
    this._choiceCount = 0;
    this._buttons = [];
    this._choices = options;
    options.forEach((opt, i) => this._addChoice(opt, i, token));

    // Fit the panel to the content.
    const textHeight = estimateLines(this._textBlock.text) * LINE_HEIGHT + 8;
    const listHeight = options.length * CHOICE_HEIGHT;
    this._textBlock.height = `${textHeight}px`;
    this._choicesPanel.height = `${listHeight + 12}px`;
    this._dialoguePanel.height = `${HEADER_HEIGHT + textHeight + listHeight + 30}px`;

    this._setSelected(options.findIndex((o) => o.enabled));
    this._installKeyHandler();
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
    this._buttons.forEach((b, i) => {
      if (!this._choices[i]?.enabled) return;
      const on = i === index;
      b.background = on ? D.BTN_HOVER : D.BTN_BG;
      b.color = on ? D.TITLE : D.TEXT;
      b.thickness = on ? 2 : 1;
    });
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

  private _addChoice(opt: DialogueChoiceOption, index: number, token: number): void {
    const enabled = opt.enabled;
    const num = index < 9 ? `[${index + 1}]  ` : "";
    const label = enabled ? `${num}${opt.text}` : `${num}${opt.text}  —  ${opt.reason ?? "unavailable"}`;

    const button = Button.CreateSimpleButton(`btn_choice_${this._choiceCount++}`, label);
    button.width = "100%";
    button.height = `${CHOICE_HEIGHT}px`;
    button.color = enabled ? D.TEXT : D.DIM;
    button.background = enabled ? D.BTN_BG : "rgba(20, 16, 10, 0.9)";
    button.cornerRadius = 6;
    button.thickness = 1;
    button.fontSize = 15;
    button.paddingBottom = "6px";
    button.hoverCursor = enabled ? "pointer" : "default";
    button.isEnabled = enabled;
    // Disabled GUI buttons paint disabledColor (#9a9a9a) instead of background.
    button.disabledColor = "rgba(20, 16, 10, 0.9)";
    button.disabledColorItem = D.DIM;

    // Left-align text like a standard RPG choice list
    if (button.textBlock) {
      button.textBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      button.textBlock.paddingLeft = "16px";
    }

    button.isFocusInvisible = false;
    button.tabIndex = 0;
    button.accessibilityTag = { description: label };

    if (enabled) {
      // Mouse and keyboard share one highlight.
      button.onPointerEnterObservable.add(() => this._setSelected(index));
      button.onFocusObservable.add(() => this._setSelected(index));
      button.onPointerUpObservable.add(() => this._activate(index, token));
    }
    this._buttons.push(button);
    this._choicesPanel.addControl(button);
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
    this.camera.update(dt);
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
    this._buttons = [];
    this._selected = -1;
    this._renderToken++;

    // Hide UI
    this._dialoguePanel.isVisible = false;
    this._choicesPanel.clearControls();

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

    if (this.onDialogueClosed) this.onDialogueClosed();
  }
}
