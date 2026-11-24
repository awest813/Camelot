/**
 * Picking the renderer, and falling back from WebGPU to WebGL2 on machines
 * where WebGPU doesn't hold up.
 *
 * Engine overhaul, Phase 7.
 */

/**
 * Which renderer to start: `?renderer=webgl|webgpu` in the URL wins, then a
 * WebGL2 fallback remembered on this machine, then the build's VITE_RENDERER
 * (VITE_USE_WEBGPU=true means WebGPU), else DEFAULT_RENDERER.  WebGPU falls
 * back to WebGL2 when the browser has no adapter or can't start it.  Every
 * custom shader has GLSL and WGSL versions (see rendering/shader-language).
 */
export function pickRenderer(
  search: string = typeof location === "undefined" ? "" : location.search,
  configured: string | undefined = import.meta.env.VITE_RENDERER ?? (import.meta.env.VITE_USE_WEBGPU === "true" ? "webgpu" : undefined),
  remembered: string | null = readRememberedRenderer(),
): "webgpu" | "webgl" {
  const asked = new URLSearchParams(search).get("renderer") ?? remembered ?? configured;
  if (asked === "webgpu" || asked === "webgl") return asked;
  return DEFAULT_RENDERER;
}

/**
 * WebGPU, where the browser has an adapter (else WebGL2).  Every custom
 * shader has WGSL, validated by naga in tests/e2e/wgsl-shaders.spec.ts.
 */
export const DEFAULT_RENDERER: "webgpu" | "webgl" = "webgpu";

/** Set when WebGPU failed on this machine: the game starts on WebGL2 from then on. */
export const RENDERER_FALLBACK_KEY = "camelot_renderer_fallback";
/** A device lost this soon after starting means WebGPU doesn't work here. */
const EARLY_LOSS_MS = 20_000;

function readRememberedRenderer(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(RENDERER_FALLBACK_KEY);
  } catch {
    return null;
  }
}

/**
 * If the WebGPU device is lost right after starting (a driver that offers
 * WebGPU but can't keep it up), remember to use WebGL2 on this machine and
 * reload.  A loss later on is left to Babylon, which restores the device.
 * An explicit `?renderer=webgpu` is never overridden.
 */
export function guardEarlyDeviceLoss(engine: { onContextLostObservable: { addOnce(cb: () => void): unknown } }): void {
  if (new URLSearchParams(location.search).get("renderer") === "webgpu") return;
  const started = performance.now();
  engine.onContextLostObservable.addOnce(() => {
    if (performance.now() - started > EARLY_LOSS_MS) return;
    console.warn("[Engine] the WebGPU device was lost while starting; switching to WebGL2 on this machine.");
    try { localStorage.setItem(RENDERER_FALLBACK_KEY, "webgl"); } catch { /* storage off: just reload */ }
    location.reload();
  });
}
