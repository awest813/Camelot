/**
 * Which language the game's own shaders are written in for this engine:
 * WGSL on WebGPU, GLSL on WebGL.  Every custom shader keeps both versions,
 * so WebGPU never has to convert GLSL (which would fetch Babylon's
 * converters from its CDN).
 *
 * Engine overhaul, Phase 7.
 */
import type { Scene } from "@babylonjs/core/scene";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

export function shaderLanguageFor(scene: Scene): ShaderLanguage {
  return scene.getEngine().isWebGPU ? ShaderLanguage.WGSL : ShaderLanguage.GLSL;
}

/** Register a shader pair under `name` in both languages (once). */
export function registerShaders(
  name: string,
  glsl: { vertex: string; fragment: string },
  wgsl: { vertex: string; fragment: string },
): void {
  ShaderStore.ShadersStore[`${name}VertexShader`] ??= glsl.vertex;
  ShaderStore.ShadersStore[`${name}FragmentShader`] ??= glsl.fragment;
  ShaderStore.ShadersStoreWGSL[`${name}VertexShader`] ??= wgsl.vertex;
  ShaderStore.ShadersStoreWGSL[`${name}FragmentShader`] ??= wgsl.fragment;
}
