import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Parchment notices for village notice boards.  Each one is painted once
 * per scene on a small canvas: a heading, lines of ink and sometimes a wax seal.
 * "wanted" notices have a rough sketched head instead of the first lines.
 *
 * The notices are ~30 cm quads seen from a step away, so the writing is
 * deliberately illegible.
 */
export type NoticeStyle = "notice" | "wanted";

const W = 128;
const H = 154;

/** Small deterministic PRNG so every scene paints identical notices. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paint(ctx: CanvasRenderingContext2D, style: NoticeStyle, seed: number): void {
  const r = rng(seed);
  // Parchment with darker, torn-looking edges.
  ctx.fillStyle = "#d9c79c";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const a = 0.04 + r() * 0.08;
    ctx.fillStyle = `rgba(90,60,25,${a})`;
    ctx.fillRect(r() * W, r() * H, 1 + r() * 4, 1 + r() * 4);
  }
  const edge = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.85);
  edge.addColorStop(0, "rgba(80,50,20,0)");
  edge.addColorStop(1, "rgba(80,50,20,0.55)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#2a1c10";
  ctx.lineCap = "round";
  // Heading: a thick, slightly wavy bar of "capitals".
  ctx.lineWidth = 5;
  ctx.beginPath();
  const hw = 46 + r() * 22;
  ctx.moveTo(W / 2 - hw / 2, 20);
  ctx.lineTo(W / 2 + hw / 2, 20 + (r() - 0.5) * 2);
  ctx.stroke();

  let y = 36;
  if (style === "wanted") {
    // A crude charcoal sketch of a face.
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, 62, 17, 21, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 22, 98);
    ctx.quadraticCurveTo(W / 2, 80, W / 2 + 22, 98);
    ctx.stroke();
    ctx.fillStyle = "#2a1c10";
    ctx.fillRect(W / 2 - 8, 57, 4, 2);
    ctx.fillRect(W / 2 + 4, 57, 4, 2);
    ctx.fillRect(W / 2 - 5, 72, 10, 1.5);
    y = 106;
  }
  // Lines of hand-written ink.
  ctx.lineWidth = 1.6;
  const lines = style === "wanted" ? 3 : 8;
  for (let i = 0; i < lines; i++, y += 11) {
    let x = 16 + r() * 4;
    const end = i === lines - 1 ? 40 + r() * 40 : W - 16 - r() * 10;
    while (x < end) {
      const len = 4 + r() * 12;
      ctx.beginPath();
      ctx.moveTo(x, y + (r() - 0.5));
      ctx.lineTo(Math.min(x + len, end), y + (r() - 0.5));
      ctx.stroke();
      x += len + 3 + r() * 3;
    }
  }
  // Wax seal on most notices.
  if (style === "wanted" || r() < 0.6) {
    ctx.fillStyle = "#7a1a14";
    ctx.beginPath();
    ctx.arc(W - 26, H - 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,200,180,0.25)";
    ctx.beginPath();
    ctx.arc(W - 28, H - 22, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Materials for the notices, built once per scene and shared by every board.
 * Returns a few variants so a board doesn't show the same sheet five times.
 */
export function createNoticeMaterials(scene: Scene): StandardMaterial[] {
  const variants: Array<[NoticeStyle, number]> = [["notice", 11], ["wanted", 23], ["notice", 37]];
  return variants.map(([style, seed], i) => {
    const tex = new DynamicTexture(`notice_tex_${i}`, { width: W, height: H }, scene, true);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    paint(ctx, style, seed);
    tex.update();
    tex.hasAlpha = false;
    const m = new StandardMaterial(`notice_parchment_${i}`, scene);
    m.diffuseTexture = tex;
    m.emissiveColor = new Color3(0.16, 0.14, 0.11); // readable in shade
    m.specularColor = new Color3(0.02, 0.02, 0.02);
    m.backFaceCulling = false;
    m.freeze();
    return m;
  });
}
