/**
 * DialogueCamera — Conversation framing.
 *
 * When a conversation starts, the player's own camera (no camera cut, so the
 * post-processing pipeline, fog and view model rules all stay the same)
 * smoothly turns to the speaker's face and narrows its field of view until
 * head and shoulders fill the frame.  When it ends, the field of view eases
 * back to normal and the player is left facing the speaker.
 *
 * Pure maths over a minimal camera shape (fov, rotation, position), so it
 * runs headless in tests.
 */

export interface DialogueCameraView {
  fov: number;
  /** x = pitch (positive looks down), y = yaw (0 looks along +Z). */
  rotation: { x: number; y: number };
  position: { x: number; y: number; z: number };
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Vertical extent (m) framed at the speaker: head, shoulders and chest. */
export const DIALOGUE_FRAME_HEIGHT = 1.35;
/**
 * Aim this far (as a fraction of the framed height) below the face, so the
 * face sits in the upper part of the frame, clear of the dialogue panel.
 */
export const DIALOGUE_FACE_LIFT = 0.16;
/** Never zoom tighter than this (rad), however far away the speaker is. */
export const DIALOGUE_MIN_FOV = 0.32;
/** Exponential easing rate (1/s): ~90% of the way in a quarter second. */
export const DIALOGUE_EASE_RATE = 9;
/** Pitch limits while framing (rad). */
const MAX_PITCH = 1.0;

/** Field of view that frames {@link DIALOGUE_FRAME_HEIGHT} at `distance`, capped at `baseFov`. */
export function dialogueFov(distance: number, baseFov: number): number {
  const fov = 2 * Math.atan(DIALOGUE_FRAME_HEIGHT / 2 / Math.max(0.3, distance));
  return Math.max(DIALOGUE_MIN_FOV, Math.min(baseFov, fov));
}

/** Yaw / pitch that look from `from` at `to` (Babylon free-camera convention). */
export function lookAngles(from: Point3, to: Point3): { yaw: number; pitch: number; distance: number } {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const flat = Math.hypot(dx, dz);
  return {
    yaw: Math.atan2(dx, dz),
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, -Math.atan2(dy, flat))),
    distance: Math.hypot(flat, dy),
  };
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class DialogueCamera {
  private _view: DialogueCameraView | null = null;
  private _focus: (() => Point3 | null) | null = null;
  private _baseFov = 0;
  /** "in": framing the speaker; "out": easing the zoom back; "idle". */
  private _phase: "idle" | "in" | "out" = "idle";

  public get phase(): "idle" | "in" | "out" {
    return this._phase;
  }

  /** The field of view the camera returns to after the conversation. */
  public get baseFov(): number {
    return this._baseFov;
  }

  /**
   * Start framing.  `focus` is polled every frame (the speaker may shift);
   * returning null holds the current framing.
   */
  public begin(view: DialogueCameraView, focus: () => Point3 | null): void {
    // Re-entering mid ease-out keeps the original base FOV.
    if (this._phase === "idle" || this._view !== view) this._baseFov = view.fov;
    this._view = view;
    this._focus = focus;
    this._phase = "in";
  }

  /** Release: ease the zoom back out; rotation is left facing the speaker. */
  public end(): void {
    if (this._phase === "in") this._phase = "out";
    this._focus = null;
  }

  /** Snap back immediately (e.g. the game is torn down or the player dies). */
  public reset(): void {
    if (this._view && this._phase !== "idle") this._view.fov = this._baseFov;
    this._phase = "idle";
    this._focus = null;
  }

  public update(dt: number): void {
    const view = this._view;
    if (!view || this._phase === "idle" || dt <= 0) return;
    const k = 1 - Math.exp(-DIALOGUE_EASE_RATE * dt);

    if (this._phase === "out") {
      view.fov += (this._baseFov - view.fov) * k;
      if (Math.abs(view.fov - this._baseFov) < 0.002) {
        view.fov = this._baseFov;
        this._phase = "idle";
      }
      return;
    }

    const target = this._focus?.();
    if (!target) return;
    const aim = { x: target.x, y: target.y - DIALOGUE_FRAME_HEIGHT * DIALOGUE_FACE_LIFT, z: target.z };
    const { yaw, pitch, distance } = lookAngles(view.position, aim);
    view.rotation.y += wrapAngle(yaw - view.rotation.y) * k;
    view.rotation.x += (pitch - view.rotation.x) * k;
    view.fov += (dialogueFov(distance, this._baseFov) - view.fov) * k;
  }
}
