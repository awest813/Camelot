/**
 * Web Worker: synthesizes surfaces off the main thread.
 * Request:  { id, kind, size, seed }
 * Response: { id, albedo, normal, hasAlpha }  (buffers transferred)
 */
import { synthesizeSurface, heightToNormalMap, type SurfaceKind } from "./texture-synth";

interface SynthRequest { id: number; kind: SurfaceKind; size: number; seed: number }

self.onmessage = (ev: MessageEvent<SynthRequest>) => {
  const { id, kind, size, seed } = ev.data;
  const surf = synthesizeSurface(kind, size, seed);
  const normal = heightToNormalMap(surf.height, size, surf.bumpStrength);
  (self as unknown as Worker).postMessage(
    { id, albedo: surf.albedo, normal, hasAlpha: surf.hasAlpha },
    [surf.albedo.buffer, normal.buffer],
  );
};
