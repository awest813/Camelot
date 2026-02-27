import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { AdvancedDynamicTexture, Button, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui/2D";
import { NPC } from "../entities/npc";
import { Player } from "../entities/player";

export class DialogueSystem {
  public scene: Scene;
  public player: Player;
  public npcs: NPC[];
  public canvas: HTMLCanvasElement;

  private _ui: AdvancedDynamicTexture;
  private _dialoguePanel: Rectangle;
  private _textBlock: TextBlock;
  private _choicesPanel: StackPanel;
  private _cinematicCamera: ArcRotateCamera;
  private _originalCamera: Camera | null = null;
  private _isInDialogue: boolean = false;

  /** Fired with the NPC's mesh name when a conversation begins. */
  public onTalkStart: ((npcName: string) => void) | null = null;

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
    this._dialoguePanel.width = "800px";
    this._dialoguePanel.height = "300px";
    this._dialoguePanel.cornerRadius = 10;
    this._dialoguePanel.color = "white";
    this._dialoguePanel.thickness = 2;
    this._dialoguePanel.background = "rgba(0, 0, 0, 0.8)";
    this._dialoguePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._dialoguePanel.top = "-50px";
    this._dialoguePanel.isVisible = false;
    this._ui.addControl(this._dialoguePanel);

    // NPC Text
    this._textBlock = new TextBlock();
    this._textBlock.text = "Hello there!";
    this._textBlock.color = "white";
    this._textBlock.fontSize = 24;
    this._textBlock.textWrapping = true;
    this._textBlock.height = "100px";
    this._textBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._textBlock.paddingTop = "20px";
    this._dialoguePanel.addControl(this._textBlock);

    // Choices Panel
    this._choicesPanel = new StackPanel();
    this._choicesPanel.height = "150px";
    this._choicesPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._choicesPanel.paddingBottom = "20px";
    this._dialoguePanel.addControl(this._choicesPanel);
  }

  private _initCamera(): void {
    this._cinematicCamera = new ArcRotateCamera("cinematicCam", 0, 0, 5, Vector3.Zero(), this.scene);
  }

  public startDialogue(npc: NPC): void {
    if (this._isInDialogue) return;
    this._isInDialogue = true;
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
    const direction = this.player.camera.position.subtract(npc.mesh.position).normalize();
    const camPos = npc.mesh.position.add(direction.scale(1.5)).add(new Vector3(0, 0.5, 0));

    this._cinematicCamera.position = camPos;
    this._cinematicCamera.minZ = 0.1;

    this.scene.activeCamera = this._cinematicCamera;

    // Detach player controls
    this.player.camera.detachControl();

    // Show UI
    this._dialoguePanel.isVisible = true;
    this._textBlock.text = `NPC: Hello, traveler.`;

    // Add choices
    this._addChoice("Hello.", () => this._endDialogue());
    this._addChoice("Goodbye.", () => this._endDialogue());
  }

  private _addChoice(text: string, callback: () => void): void {
    const button = Button.CreateSimpleButton("btn", text);
    button.width = "700px";
    button.height = "40px";
    button.color = "white";
    button.background = "gray";
    button.paddingBottom = "10px";
    button.onPointerUpObservable.add(callback);
    this._choicesPanel.addControl(button);
  }

  private _endDialogue(): void {
    this._isInDialogue = false;

    // Hide UI
    this._dialoguePanel.isVisible = false;
    this._choicesPanel.clearControls();

    // Restore Camera
    this.scene.activeCamera = this._originalCamera;

    // Restore controls
    this.player.camera.attachControl(this.canvas, true);
  }
}
