/**
 * Validate WGSL offline with naga (wgpu's shader compiler, as WebAssembly):
 * full parsing and validation (types, uniformity, layout), no GPU needed.
 * Test-only.  Engine overhaul, Phase 7.
 */
import { parseWgsl, validate, type NagaHandle } from "naga-wasm";

/** The validation error for `source`, or null when it is valid WGSL. */
export function wgslError(source: string): string | null {
  let module: NagaHandle | undefined;
  let info: NagaHandle | undefined;
  try {
    module = parseWgsl(source);
    info = validate(module);
    return null;
  } catch (e) {
    return String((e as Error)?.message ?? e);
  } finally {
    info?.free();
    module?.free();
  }
}
