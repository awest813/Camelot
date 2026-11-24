/**
 * The two naga-wasm functions the WGSL validator uses.  (The package ships
 * types through `exports` only, which this project's module resolution
 * doesn't read.)
 */
declare module "naga-wasm" {
  export interface NagaHandle { free(): void }
  export function parseWgsl(source: string): NagaHandle;
  export function validate(module: NagaHandle): NagaHandle;
}
