/**
 * The camera stack: the player's own view, unless a shot is running (a
 * conversation's framing, the death fall, later cinematics).  Shots are
 * ranked; the highest active one drives the camera each frame and the rest
 * wait, so a fall mid-conversation wins and the framing picks up after.
 *
 * Engine overhaul, Phase 2.
 */
export interface CameraShot {
  readonly id: string;
  /** Whether the shot wants the camera (including easing back out). */
  readonly active: boolean;
  update(dt: number): void;
}

export class CameraDirector {
  private readonly _shots: CameraShot[] = [];

  /** Add a shot; later ones outrank earlier ones. */
  public add(shot: CameraShot): void {
    this._shots.push(shot);
  }

  /** The id of the shot driving the camera, or "gameplay". */
  public get current(): string {
    return this._top()?.id ?? "gameplay";
  }

  public update(dt: number): void {
    this._top()?.update(dt);
  }

  private _top(): CameraShot | undefined {
    for (let i = this._shots.length - 1; i >= 0; i--) if (this._shots[i].active) return this._shots[i];
    return undefined;
  }
}

/** The view a shot moves (the player's camera). */
export interface ShotView {
  rotation: { x: number; z: number };
}

/** How far the view tips (pitch down) and rolls while the player is down. */
export const DEATH_PITCH = 0.55;
export const DEATH_ROLL = 0.42;
/** Exponential ease rates: a slow sag, a quicker recovery. */
const FALL_RATE = 2.2;
const RISE_RATE = 4;

/** The death fall: the view sags toward the ground and tips; waking eases it back. */
export class DeathCamera implements CameraShot {
  public readonly id = "death";
  private _phase: "idle" | "down" | "up" = "idle";
  private _basePitch = 0;
  private _down = 0;

  constructor(private readonly _view: () => ShotView | null) {}

  public get active(): boolean {
    return this._phase !== "idle";
  }

  /** The player fell. */
  public fall(): void {
    const v = this._view();
    if (!v) return;
    if (this._phase === "idle") this._basePitch = v.rotation.x;
    this._phase = "down";
  }

  /** The player woke: ease back upright. */
  public rise(): void {
    if (this._phase === "down") this._phase = "up";
  }

  public update(dt: number): void {
    const v = this._view();
    if (!v || this._phase === "idle" || dt <= 0) return;
    const target = this._phase === "down" ? 1 : 0;
    const k = 1 - Math.exp(-(this._phase === "down" ? FALL_RATE : RISE_RATE) * dt);
    this._down += (target - this._down) * k;
    if (this._phase === "up" && this._down < 0.002) {
      this._down = 0;
      this._phase = "idle";
    }
    v.rotation.x = this._basePitch + (Math.min(1.2, this._basePitch + DEATH_PITCH) - this._basePitch) * this._down;
    v.rotation.z = DEATH_ROLL * this._down;
  }
}
