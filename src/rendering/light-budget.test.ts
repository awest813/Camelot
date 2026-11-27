import { describe, expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { pinLightLimit, LIGHTS_PER_MATERIAL } from "./light-budget";

describe("light budget", () => {
  it("every lit material shades the budget from the start, whatever a loader asks", () => {
    pinLightLimit();
    const scene = new Scene(new NullEngine());
    const std = new StandardMaterial("std", scene);
    const pbr = new PBRMaterial("pbr", scene);
    for (const m of [std, pbr]) {
      expect(m.maxSimultaneousLights).toBe(LIGHTS_PER_MATERIAL);
      expect((m as unknown as { _maxSimultaneousLights: number })._maxSimultaneousLights, "what the shader code reads").toBe(LIGHTS_PER_MATERIAL);
    }
    // What the glTF loader does after each load: nothing changes, nothing is marked dirty.
    // (Babylon's property setters call the prototype's method.)
    const spy = vi.spyOn(StandardMaterial.prototype as unknown as { _markAllSubMeshesAsLightsDirty: () => void }, "_markAllSubMeshesAsLightsDirty");
    std.maxSimultaneousLights = Math.max(std.maxSimultaneousLights, 23);
    pbr.maxSimultaneousLights = 23;
    expect(std.maxSimultaneousLights).toBe(LIGHTS_PER_MATERIAL);
    expect(pbr.maxSimultaneousLights).toBe(LIGHTS_PER_MATERIAL);
    expect(spy).not.toHaveBeenCalled();
    // (And without the pin it would have been: the setter marks lights dirty on a change.)
    std.disableLighting = !std.disableLighting;
    expect(spy, "the spy sees a lights change").toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
