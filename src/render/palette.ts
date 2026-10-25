import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";

export const INK = new Color3(0.09, 0.06, 0.12);

export const PAL = {
  grass: new Color3(0.46, 0.82, 0.28),
  grassDeep: new Color3(0.3, 0.62, 0.22),
  grassLite: new Color3(0.66, 0.9, 0.36),
  lane: new Color3(0.46, 0.28, 0.13),
  laneEdge: new Color3(0.28, 0.16, 0.08),
  river: new Color3(0.28, 0.78, 0.9),
  riverDeep: new Color3(0.16, 0.5, 0.78),
  trunk: new Color3(0.58, 0.38, 0.22),
  leaf: new Color3(0.36, 0.78, 0.28),
  leafLite: new Color3(0.62, 0.92, 0.34),
  rock: new Color3(0.66, 0.7, 0.82),
  stone: new Color3(0.4, 0.36, 0.42),
  camelot: new Color3(0.98, 0.78, 0.26),
  camelotDeep: new Color3(0.22, 0.58, 0.96),
  mordred: new Color3(0.93, 0.28, 0.4),
  mordredDeep: new Color3(0.5, 0.22, 0.74),
  hpAlly: new Color3(0.18, 0.55, 0.14),
  hpEnemy: new Color3(0.72, 0.14, 0.18),
  mana: new Color3(0.12, 0.32, 0.75),
  gold: new Color3(1, 0.86, 0.35),
  sky: new Color3(0.53, 0.78, 0.96),
};

export function candy(scene: Scene, name: string, color: Color3, glow = 0.12, alpha = 1): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = color;
  mat.specularColor = new Color3(0.06, 0.06, 0.07);
  mat.emissiveColor = color.scale(glow);
  mat.ambientColor = new Color3(1, 1, 1);
  if (alpha < 1) {
    mat.alpha = alpha;
    mat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
  }
  return mat;
}

export function teamColor(team: "camelot" | "mordred", deep = false): Color3 {
  if (team === "camelot") return deep ? PAL.camelotDeep : PAL.camelot;
  return deep ? PAL.mordredDeep : PAL.mordred;
}

export const SKY = new Color4(0.53, 0.78, 0.96, 1);
