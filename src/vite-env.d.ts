/// <reference types="vite/client" />

declare module '*.gltf' {
  const gltf: any
  export default gltf
}
declare module '*.glsl' {
  const glsl: any
  export default glsl
}

declare module '@babylonjs'

declare module 'earcut'
declare module 'recast-detour'

declare class CustomErr extends Error {
  constructor(message: string)
}

interface ImportMetaEnv {
  readonly VITE_USE_WEBGPU: string;
  /** "webgpu" or "webgl": the renderer to start with (`?renderer=` in the URL wins). */
  readonly VITE_RENDERER?: string;
  readonly VITE_RENDER_SCALE?: string;
  readonly VITE_ENABLE_REMOTE_PROPS?: string;
  readonly VITE_ENABLE_SHADOWS?: string;
  readonly VITE_ENABLE_NAVMESH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
