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
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}