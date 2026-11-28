/**
 * Model loading with nothing loaded up front: the glTF 2.0 loader registers
 * as an async factory (its code is fetched the first time a model loads),
 * and its extensions as lazy factories too, each fetched only when a model
 * lists it (meshopt, WebP, …).
 *
 * `import "@babylonjs/loaders/glTF"` used to register the glTF 1.0 loader
 * and every 2.0 extension at start-up, and with them Babylon's FlowGraph
 * (KHR_interactivity), the old audio engine (MSFT_audio_emitter), OpenPBR
 * and more: about 600 KB of unminified code before the first frame.
 *
 * Import this module (for its side effect) wherever models are loaded.
 */
import { RegisterSceneLoaderPlugin } from "@babylonjs/core/Loading/sceneLoader";
import { GLTFFileLoaderMetadata } from "@babylonjs/loaders/glTF/glTFFileLoader.metadata";
import { registerBuiltInGLTFExtensions } from "@babylonjs/loaders/glTF/2.0/Extensions/dynamic";

let registered = false;

/** Register the lazy glTF loader once (idempotent). */
export function registerLazyGltfLoader(): void {
  if (registered) return;
  registered = true;
  RegisterSceneLoaderPlugin({
    ...GLTFFileLoaderMetadata,
    createPlugin: async (options: Record<string, unknown>) => {
      const { GLTFFileLoader } = await import("@babylonjs/loaders/glTF/2.0/glTFLoader");
      return new GLTFFileLoader(options[GLTFFileLoaderMetadata.name] as never);
    },
  } as never);
  registerBuiltInGLTFExtensions();
}

registerLazyGltfLoader();
