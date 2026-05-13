import type { BabylonInputAdapter, InputAction } from "../adapters/babylon/babylon-input-adapter";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";

const AXIS_DEADZONE = 0.15;
const TRIGGER_DEADZONE = 0.1;
const STICK_REPEAT_DELAY = 0.35;
const STICK_REPEAT_RATE = 0.12;

const RIGHT_STICK_SENSITIVITY = 3.0;
const CAMERA_PITCH_MIN = -1.2;
const CAMERA_PITCH_MAX = 1.2;

interface StickRepeatState {
  lastDirection: string | null;
  repeatTimer: number;
  hasTriggered: boolean;
}

export class GamepadInputSystem {
  private _adapter: BabylonInputAdapter;
  private _activeGamepadIndex: number | null = null;
  private _camera: UniversalCamera | null = null;

  private _dpadState: StickRepeatState = { lastDirection: null, repeatTimer: 0, hasTriggered: false };

  public leftStickX: number = 0;
  public leftStickY: number = 0;
  public rightStickX: number = 0;
  public rightStickY: number = 0;
  public leftTrigger: number = 0;
  public rightTrigger: number = 0;

  private _lastFrameButtons: Set<number> = new Set();

  constructor(adapter: BabylonInputAdapter) {
    this._adapter = adapter;
  }

  public setCamera(camera: UniversalCamera): void {
    this._camera = camera;
  }

  public connect(): void {
    window.addEventListener("gamepadconnected", (e: GamepadEvent) => {
      if (this._activeGamepadIndex === null) {
        this._activeGamepadIndex = e.gamepad.index;
      }
    });

    window.addEventListener("gamepaddisconnected", (e: GamepadEvent) => {
      if (this._activeGamepadIndex === e.gamepad.index) {
        this._activeGamepadIndex = null;
      }
    });
  }

  public update(dt: number): void {
    if (this._activeGamepadIndex === null) return;

    const gamepads = navigator.getGamepads();
    const pad = gamepads[this._activeGamepadIndex];
    if (!pad) {
      this._activeGamepadIndex = null;
      return;
    }

    this._readAxes(pad);
    this._applyCameraLook(dt);
    this._processButtons(pad, dt);
  }

  private _readAxes(pad: Gamepad): void {
    this.leftStickX = Math.abs(pad.axes[0]) > AXIS_DEADZONE ? pad.axes[0] : 0;
    this.leftStickY = Math.abs(pad.axes[1]) > AXIS_DEADZONE ? -pad.axes[1] : 0;
    this.rightStickX = Math.abs(pad.axes[2]) > AXIS_DEADZONE ? pad.axes[2] : 0;
    this.rightStickY = Math.abs(pad.axes[3]) > AXIS_DEADZONE ? -pad.axes[3] : 0;
    this.leftTrigger = pad.buttons[6]?.value ?? 0;
    this.rightTrigger = pad.buttons[7]?.value ?? 0;
  }

  private _applyCameraLook(dt: number): void {
    if (!this._camera) return;
    if (Math.abs(this.rightStickX) < AXIS_DEADZONE && Math.abs(this.rightStickY) < AXIS_DEADZONE) return;

    const cam = this._camera;
    cam.rotation.y += this.rightStickX * RIGHT_STICK_SENSITIVITY * dt;
    cam.rotation.x = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX,
      cam.rotation.x + this.rightStickY * RIGHT_STICK_SENSITIVITY * dt));
  }

  public resetCameraPitch(): void {
    if (this._camera) this._camera.rotation.x = 0;
  }

  private _processButtons(pad: Gamepad, _dt: number): void {
    const nowPressed = new Set<number>();
    for (let i = 0; i < pad.buttons.length; i++) {
      if (pad.buttons[i].pressed) nowPressed.add(i);
    }

    const aDown = nowPressed.has(0), aWas = this._lastFrameButtons.has(0);
    const bDown = nowPressed.has(1), bWas = this._lastFrameButtons.has(1);
    const xDown = nowPressed.has(2), xWas = this._lastFrameButtons.has(2);
    const yDown = nowPressed.has(3), yWas = this._lastFrameButtons.has(3);
    const lbDown = nowPressed.has(4), lbWas = this._lastFrameButtons.has(4);
    const rbDown = nowPressed.has(5), rbWas = this._lastFrameButtons.has(5);
    const backDown = nowPressed.has(8), backWas = this._lastFrameButtons.has(8);
    const startDown = nowPressed.has(9), startWas = this._lastFrameButtons.has(9);
    const lsDown = nowPressed.has(10), lsWas = this._lastFrameButtons.has(10);
    const rsDown = nowPressed.has(11), rsWas = this._lastFrameButtons.has(11);

    // Triggers as buttons (digital threshold)
    const ltPressed = this.leftTrigger > TRIGGER_DEADZONE;
    const rtPressed = this.rightTrigger > TRIGGER_DEADZONE;
    const ltWas = this._lastFrameButtons.has(100);
    const rtWas = this._lastFrameButtons.has(101);

    // A — Interact (context-sensitive: if nothing nearby, handler triggers jump)
    if (aDown && !aWas) this._adapter.simulateAction("interact");
    // B — Pause / Back
    if (bDown && !bWas) this._adapter.simulateAction("pause");
    // X — Cast Spell / Shout
    if (xDown && !xWas) this._adapter.simulateAction("castSpell");
    // Y — Ready Weapon
    if (yDown && !yWas) this._adapter.simulateAction("readyWeapon");
    // LB — Block
    if (lbDown && !lbWas) this._adapter.simulateAction("block");
    if (!lbDown && lbWas) this._adapter.simulateAction("blockRelease");
    // RB — Melee Attack
    if (rbDown && !rbWas) this._adapter.simulateAction("meleeAttack");
    // LT — Bow Draw / Zoom
    if (ltPressed && !ltWas) this._adapter.simulateAction("drawBow");
    if (!ltPressed && ltWas) this._adapter.simulateAction("releaseBow");
    // RT — Power Attack / Cast
    if (rtPressed && !rtWas) this._adapter.simulateAction("powerAttack");
    // Back — Quest Journal
    if (backDown && !backWas) this._adapter.simulateAction("toggleQuestLog");
    // Start — System Menu
    if (startDown && !startWas) this._adapter.simulateAction("favoritesMenu");
    // LS click — Sprint toggle
    if (lsDown && !lsWas) this._adapter.simulateAction("sprint");
    if (!lsDown && lsWas) this._adapter.simulateAction("sprintRelease");
    // RS click — Toggle POV
    if (rsDown && !rsWas) this._adapter.simulateAction("togglePOV");

    this._lastFrameButtons = new Set(nowPressed);
    if (ltPressed) this._lastFrameButtons.add(100);
    if (rtPressed) this._lastFrameButtons.add(101);

    this._processDpad(pad, _dt);
  }

  private _processDpad(pad: Gamepad, dt: number): void {
    const up = pad.buttons[12]?.pressed ?? false;
    const down = pad.buttons[13]?.pressed ?? false;
    const left = pad.buttons[14]?.pressed ?? false;
    const right = pad.buttons[15]?.pressed ?? false;

    let direction: string | null = null;
    if (up) direction = "up";
    else if (down) direction = "down";
    else if (left) direction = "left";
    else if (right) direction = "right";

    if (!direction) {
      this._dpadState.lastDirection = null;
      this._dpadState.repeatTimer = 0;
      this._dpadState.hasTriggered = false;
      return;
    }

    if (direction !== this._dpadState.lastDirection) {
      this._dpadState.lastDirection = direction;
      this._dpadState.repeatTimer = 0;
      this._dpadState.hasTriggered = false;
    }

    this._dpadState.repeatTimer += dt;
    const delay = this._dpadState.hasTriggered ? STICK_REPEAT_RATE : STICK_REPEAT_DELAY;

    if (this._dpadState.repeatTimer >= delay) {
      this._dpadState.repeatTimer = 0;
      this._dpadState.hasTriggered = true;

      switch (direction) {
        case "up":    this._adapter.simulateAction("favoritesMenu"); break;
        case "down":  this._adapter.simulateAction("toggleCrouch"); break;
        case "left":  this._adapter.simulateAction("toggleInventory"); break;
        case "right": this._adapter.simulateAction("toggleQuestLog"); break;
      }
    }
  }

  public get isConnected(): boolean {
    return this._activeGamepadIndex !== null;
  }

  public get activeGamepadIndex(): number | null {
    return this._activeGamepadIndex;
  }
}
