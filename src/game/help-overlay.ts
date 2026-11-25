/**
 * The F1 help overlay (play or map-editor controls).
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { buildHelpOverlayLines } from "../ui/editor-help-overlay";

export function toggleHelpOverlay(g: Game): void {
  if (!g._helpOverlayEl) {
    const panel = document.createElement("div");
    panel.className = "game-help-overlay";
    panel.style.display = "none";
    document.body.appendChild(panel);
    g._helpOverlayEl = panel;
  }

  g._helpOverlayVisible = !g._helpOverlayVisible;
  if (!g._helpOverlayEl) return;

  if (g._helpOverlayVisible) {
    g._helpOverlayEl.innerHTML = buildHelpOverlayLines(g.mapEditorActive).join("<br>");
    g._helpOverlayEl.style.display = "block";
  } else {
    g._helpOverlayEl.style.display = "none";
  }
}

export function refreshHelpOverlayIfVisible(g: Game): void {
  if (!g._helpOverlayVisible || !g._helpOverlayEl) return;
  g._helpOverlayEl.textContent = buildHelpOverlayLines(g.mapEditorActive).join("\n");
}
