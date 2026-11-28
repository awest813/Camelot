import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

/**
 * A placed prop that never moves again: its world matrices are computed once
 * and frozen, so the frame's mesh selection stops re-checking each of them
 * (a village has well over a thousand).  Skinned meshes are left alone (their
 * bones move them).  Call after the prop is positioned; anything that moves
 * it later must `unfreezeWorldMatrix()` first.
 */
export function freezeStatic(root: AbstractMesh): void {
  for (const m of [root, ...root.getChildMeshes(false)]) {
    if (m.skeleton) continue;
    m.computeWorldMatrix(true);
    m.freezeWorldMatrix();
  }
}
