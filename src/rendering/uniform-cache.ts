import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * One persistent Color3 / Vector3 per uniform name.
 *
 * `ShaderMaterial.setColor3` / `setVector3` keep a *reference* to the value
 * passed in, not a copy, so filling several uniforms from one scratch object
 * leaves them all equal to whichever was set last.  Use
 * `mat.setColor3(name, cache.color(name, r, g, b))` instead.
 */
export class UniformCache {
  private readonly _colors = new Map<string, Color3>();
  private readonly _vectors = new Map<string, Vector3>();

  public color(name: string, r: number, g: number, b: number): Color3 {
    let c = this._colors.get(name);
    if (!c) this._colors.set(name, (c = new Color3()));
    return c.set(r, g, b);
  }

  public vec3(name: string, x: number, y: number, z: number): Vector3 {
    let v = this._vectors.get(name);
    if (!v) this._vectors.set(name, (v = new Vector3()));
    return v.set(x, y, z);
  }
}
