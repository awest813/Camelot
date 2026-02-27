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
  private _originalCamera: Camera | null = null; // To store original camera
  private _isInDialogue: boolean = false;

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

    // Skyrim color palette
    const SKYRIM_GOLD = "#D4AF37";
    const SKYRIM_BROWN = "#8B7355";
    const SKYRIM_DARK = "rgba(20, 15, 10, 0.95)";
    const SKYRIM_DARK_INTERIOR = "rgba(30, 25, 20, 0.8)";

    // Main Panel (Bottom)
    this._dialoguePanel = new Rectangle();
    this._dialoguePanel.width = "900px";
    this._dialoguePanel.height = "320px";
    this._dialoguePanel.cornerRadius = 0;
    this._dialoguePanel.color = SKYRIM_BROWN;
    this._dialoguePanel.thickness = 3;
    this._dialoguePanel.background = SKYRIM_DARK;
    this._dialoguePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._dialoguePanel.top = "-30px";
    this._dialoguePanel.isVisible = false;
    this._ui.addControl(this._dialoguePanel);

    // Title bar with decorative elements
    const titleBar = new Rectangle();
    titleBar.width = "100%";
    titleBar.height = "40px";
    titleBar.background = SKYRIM_DARK_INTERIOR;
    titleBar.color = SKYRIM_GOLD;
    titleBar.thickness = 1;
    titleBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._dialoguePanel.addControl(titleBar);

    const titleText = new TextBlock();
    titleText.text = "◆ DIALOGUE ◆";
    titleText.color = SKYRIM_GOLD;
    titleText.fontSize = 18;
    titleText.fontStyle = "bold";
    titleText.shadowBlur = 2;
    titleText.shadowColor = "black";
    titleBar.addControl(titleText);

    // NPC Text
    this._textBlock = new TextBlock();
    this._textBlock.text = "Hello there!";
    this._textBlock.color = SKYRIM_GOLD;
    this._textBlock.fontSize = 20;
    this._textBlock.fontStyle = "italic";
    this._textBlock.textWrapping = true;
    this._textBlock.height = "100px";
    this._textBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._textBlock.paddingTop = "50px";
    this._textBlock.paddingLeft = "20px";
    this._textBlock.paddingRight = "20px";
    this._dialoguePanel.addControl(this._textBlock);

    // Choices Panel
    this._choicesPanel = new StackPanel();
    this._choicesPanel.height = "150px";
    this._choicesPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._choicesPanel.paddingBottom = "20px";
    this._choicesPanel.paddingLeft = "20px";
    this._choicesPanel.paddingRight = "20px";
    this._dialoguePanel.addControl(this._choicesPanel);
  }

  private _initCamera(): void {
    this._cinematicCamera = new ArcRotateCamera("cinematicCam", 0, 0, 5, Vector3.Zero(), this.scene);
  }

  public startDialogue(npc: NPC): void {
    if (this._isInDialogue) return;
    this._isInDialogue = true;

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
    // Skyrim color palette
    const SKYRIM_GOLD = "#D4AF37";
    const SKYRIM_BROWN = "#8B7355";
    const SKYRIM_DARK_INTERIOR = "rgba(30, 25, 20, 0.8)";
    const SKYRIM_LIGHT_BROWN = "rgba(100, 80, 60, 0.8)";

    const button = Button.CreateSimpleButton("btn", text);
    button.width = "100%";
    button.height = "40px";
    button.color = SKYRIM_BROWN;
    button.thickness = 2;
    button.background = SKYRIM_DARK_INTERIOR;
    button.cornerRadius = 0;
    button.paddingBottom = "5px";
    button.paddingTop = "5px";
    button.hoverCursor = "pointer";
    button.fontSize = 16;
    button.fontStyle = "bold";

    // Style text
    const textBlock = button.children[0] as TextBlock;
    if (textBlock) {
      textBlock.color = SKYRIM_GOLD;
      textBlock.fontSize = 16;
    }

    // Hover effects
    button.onPointerEnterObservable.add(() => {
      button.background = SKYRIM_LIGHT_BROWN;
      button.color = SKYRIM_GOLD;
    });
    button.onPointerOutObservable.add(() => {
      button.background = SKYRIM_DARK_INTERIOR;
      button.color = SKYRIM_BROWN;
    });

    button.onPointerUpObservable.add(callback);
    this._choicesPanel.addControl(button);
  }

  private _endDialogue(): void {
    this._isInDialogue = false;

    // Hide UI
    this._dialoguePanel.isVisible = false;
    this._choicesPanel.clearControls();

    // Restore Camera (fallback to player camera if original was null)
    this.scene.activeCamera = this._originalCamera || this.player.camera;

    // Restore controls
    this.player.camera.attachControl(this.canvas, true);
  }
}
