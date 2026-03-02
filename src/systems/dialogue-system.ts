import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui/2D";
import { NPC } from "../entities/npc";
import { Player } from "../entities/player";
import { DialogueSession } from "../framework/dialogue/dialogue-engine";
import { DialogueNodeView } from "../framework/dialogue/dialogue-types";

// Design tokens — mirrored from UIManager to keep dialogue styling consistent.
const D = {
  PANEL_BG:     "rgba(6, 4, 2, 0.95)",
  PANEL_BORDER: "#6B4F12",
  TITLE:        "#D4A017",
  TEXT:         "#EEE0C0",
  DIM:          "#998877",
  BTN_BG:       "rgba(28, 20, 6, 0.95)",
  BTN_HOVER:    "rgba(80, 56, 10, 0.98)",
};

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
  private _cinematicCamera: ArcRotateCamera;
  private _originalCamera: Camera | null = null;
  private _isInDialogue: boolean = false;
  private _choiceCount: number = 0;
  private _activeSession: DialogueSession | null = null;

  // Scratch vectors for performance optimization
  private _direction: Vector3 = new Vector3();
  private _camPos: Vector3 = new Vector3();

  /** Fired with the NPC's mesh name when a conversation begins. */
  public onTalkStart: ((npcName: string) => void) | null = null;
  /** Optional session factory. If provided, dialogue UI is driven by framework data. */
  public dialogueSessionProvider: ((npc: NPC) => DialogueSession | null) | null = null;

  public get isInDialogue(): boolean {
    return this._isInDialogue;
  }

  constructor(scene: Scene, player: Player, npcs: NPC[], canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.player = player;
    this.npcs = npcs;
    this.canvas = canvas;
    this._initUI();
    this._initCamera();
  }

  private _initUI(): void {
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI("DialogueUI");

    // Main Panel (Bottom)
    this._dialoguePanel = new Rectangle();
    this._dialoguePanel.width = "820px";
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
    this._textBlock.height = "80px";
    this._textBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._textBlock.paddingTop = "62px";
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
    this._choicesPanel.paddingLeft = "20px";
    this._choicesPanel.paddingRight = "20px";
    this._dialoguePanel.addControl(this._choicesPanel);
  }

  private _initCamera(): void {
    this._cinematicCamera = new ArcRotateCamera("cinematicCam", 0, 0, 5, Vector3.Zero(), this.scene);
  }

  // Refactored duplicate raycast logic: using shared method player.raycastForward
  public checkLineOfSight(): any {
      return this.player.raycastForward(3);
  }

  public startDialogue(npc: NPC): void {
    if (this._isInDialogue) return;
    this._isInDialogue = true;
    this._activeSession = null;
    if (this.onTalkStart) this.onTalkStart(npc.mesh.name);

    // Switch Camera
    this._originalCamera = this.scene.activeCamera;

    // Position cinematic camera
    // Look at NPC face
    // Position slightly offset from player view? Or fixed "talking head" view?
    // Fallout 3 style: Zoom in on face.

    const npcHeadPos = npc.mesh.position.clone().add(new Vector3(0, 0.5, 0)); // Approx head height
    this._cinematicCamera.setTarget(npcHeadPos);

    // Position camera in front of NPC
    // Calculate direction from NPC to Player
    this.player.camera.position.subtractToRef(npc.mesh.position, this._direction);
    this._direction.normalize();

    // Scale direction and add to npc position
    this._direction.scaleToRef(1.5, this._camPos);
    this._camPos.addInPlace(npc.mesh.position);
    this._camPos.addInPlaceFromFloats(0, 0.5, 0);

    this._cinematicCamera.position.copyFrom(this._camPos);
    this._cinematicCamera.minZ = 0.1;

    this.scene.activeCamera = this._cinematicCamera;

    // Detach player controls
    this.player.camera.detachControl();

    // Show UI
    this._choiceCount = 0;
    this._dialoguePanel.isVisible = true;

    const session = this.dialogueSessionProvider ? this.dialogueSessionProvider(npc) : null;
    const node = session?.getCurrentNode() ?? null;
    if (session && node) {
      this._activeSession = session;
      this._renderNode(node);
      return;
    }

    // Fallback legacy dialogue when no framework session is available.
    this._nameLabel.text = `✦  ${npc.mesh.name}`;
    this._textBlock.text = `"Hello, traveler. What brings you here?"`;
    this._addChoice("Hello.", () => this._endDialogue());
    this._addChoice("Goodbye.", () => this._endDialogue());
  }

  private _renderNode(node: DialogueNodeView): void {
    this._nameLabel.text = `✦  ${node.speaker}`;
    this._textBlock.text = `"${node.text}"`;
    this._choicesPanel.clearControls();
    this._choiceCount = 0;

    if (node.choices.length === 0) {
      this._addChoice("Goodbye.", () => this._endDialogue());
      return;
    }

    for (const choice of node.choices) {
      const label = choice.isAvailable ? choice.text : `${choice.text} (locked)`;
      this._addChoice(label, () => this._handleFrameworkChoice(choice.id), choice.isAvailable);
    }
  }

  private _handleFrameworkChoice(choiceId: string): void {
    if (!this._activeSession) {
      this._endDialogue();
      return;
    }

    const result = this._activeSession.choose(choiceId);
    if (!result.success && result.currentNode) {
      this._renderNode(result.currentNode);
      return;
    }
    if (result.isComplete || !result.currentNode) {
      this._endDialogue();
      return;
    }
    this._renderNode(result.currentNode);
  }

  private _addChoice(text: string, callback: () => void, enabled: boolean = true): void {
    const button = Button.CreateSimpleButton(`btn_choice_${this._choiceCount++}`, text);
    button.width = "100%";
    button.height = "44px";
    button.color = enabled ? D.TEXT : D.DIM;
    button.background = enabled ? D.BTN_BG : "rgba(20, 16, 10, 0.9)";
    button.cornerRadius = 6;
    button.thickness = 1;
    button.fontSize = 15;
    button.paddingBottom = "8px";
    button.hoverCursor = enabled ? "pointer" : "default";
    button.isEnabled = enabled;

    button.isFocusInvisible = false;
    button.tabIndex = 0;
    button.accessibilityTag = { description: text };

    const setHover = () => {
      button.background = D.BTN_HOVER;
      button.color = D.TITLE;
    };
    const setNormal = () => {
      button.background = D.BTN_BG;
      button.color = D.TEXT;
    };

    if (enabled) {
      button.onPointerEnterObservable.add(setHover);
      button.onPointerOutObservable.add(setNormal);
      button.onFocusObservable.add(setHover);
      button.onBlurObservable.add(setNormal);
    }

    button.onKeyboardEventProcessedObservable.add((evt) => {
      if (!enabled) return;
      if (evt.type === "keyup" && (evt.key === "Enter" || evt.key === " ")) {
        callback();
      }
    });

    if (enabled) button.onPointerUpObservable.add(callback);
    this._choicesPanel.addControl(button);
  }

  private _endDialogue(): void {
    this._isInDialogue = false;
    this._activeSession = null;

    // Hide UI
    this._dialoguePanel.isVisible = false;
    this._choicesPanel.clearControls();

    // Restore Camera
    this.scene.activeCamera = this._originalCamera;

    // Restore controls and pointer lock so mouse-look works immediately
    this.canvas.requestPointerLock();
    this.player.camera.attachControl(this.canvas, true);
  }
}
