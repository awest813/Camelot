/**
 * Where fires are handed to the fire effects (particles-fx.ts FireFx), present
 * from the start: the particle code loads after the world is set up (out of
 * the start-up bundle), so fires lit before it arrives (the start area's
 * campfire, a torch in the first chunks) wait here and are handed over once
 * it does. A fire whose flame is gone by then (its chunk unloaded) is dropped.
 */
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { PointLight } from "@babylonjs/core/Lights/pointLight";

export interface FireInfo {
  flame: Mesh;
  light: PointLight;
  kind: "torch" | "campfire";
  nightOnly?: boolean;
}

/** What lights a fire's flicker, sparks and smoke. */
export interface FireSink {
  attach(info: FireInfo): void;
}

export class FireFxPort implements FireSink {
  private _sink: FireSink | null = null;
  private readonly _waiting: FireInfo[] = [];

  public attach(info: FireInfo): void {
    if (this._sink) this._sink.attach(info);
    else this._waiting.push(info);
  }

  /** The fire effects have arrived: they take the waiting fires and every one after. */
  public connect(sink: FireSink): void {
    this._sink = sink;
    for (const info of this._waiting.splice(0)) {
      if (!info.flame.isDisposed()) sink.attach(info);
    }
  }

  /** Fires waiting for the effects (for tests). */
  public get waiting(): number {
    return this._waiting.length;
  }
}
