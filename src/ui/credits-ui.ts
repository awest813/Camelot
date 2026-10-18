import { GAME_VERSION } from "../platform/constants";
import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";

export interface CreditsSection {
  heading: string;
  lines: readonly string[];
}

/** Third-party notices required to ship the desktop build. */
export const CREDITS_SECTIONS: readonly CreditsSection[] = [
  {
    heading: "Camelot",
    lines: [
      `Version ${GAME_VERSION}`,
      "An Arthurian role-playing game.",
      "Andrei Stepanov — Babylon Press",
    ],
  },
  {
    heading: "Engine",
    lines: [
      "Babylon.js — Apache License 2.0",
      "Havok Physics via @babylonjs/havok",
      "Recast Navigation (recast-detour)",
    ],
  },
  {
    heading: "Art",
    lines: [
      "KayKit Character Pack: Adventurers — CC0, Kay Lousberg (kaylousberg.com). Credit appreciated.",
      "Quaternius stylized filler meshes — CC0 / public domain.",
      "Terrain, foliage, and surfaces are generated in-engine.",
      "Optional Babylon.js sample meshes — CC BY 4.0, Babylon.js. Used only when remote props are explicitly enabled; the Steam build leaves them off.",
    ],
  },
  {
    heading: "Type",
    lines: [
      "Cinzel and Inter — SIL Open Font License 1.1.",
    ],
  },
];

/**
 * Pause-menu credits and license notice. HTML dialog so it can scroll a
 * long attribution list without growing the Babylon pause card.
 */
export class CreditsUI {
  public isVisible = false;
  public onClose: (() => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _focus: DialogFocusSession | null = null;

  public show(): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (!this._root) return;
    this._root.style.display = "flex";
    this.isVisible = true;
    if (!this._focus) this._focus = manageDialogFocus(this._root);
  }

  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
    this._focus?.release();
    this._focus = null;
  }

  public destroy(): void {
    this.hide();
    this._root?.remove();
    this._root = null;
  }

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "graphics-settings credits-dialog";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "credits-title");
    root.style.display = "none";

    const panel = document.createElement("div");
    panel.className = "graphics-settings__panel credits-dialog__panel";

    const header = document.createElement("div");
    header.className = "graphics-settings__header";

    const title = document.createElement("h2");
    title.id = "credits-title";
    title.className = "graphics-settings__title";
    title.textContent = "Credits";
    header.appendChild(title);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "graphics-settings__close";
    close.setAttribute("aria-label", "Close credits");
    close.textContent = "✕";
    close.addEventListener("click", () => {
      this.hide();
      this.onClose?.();
    });
    header.appendChild(close);
    panel.appendChild(header);

    for (const section of CREDITS_SECTIONS) {
      const heading = document.createElement("h3");
      heading.className = "credits-dialog__heading";
      heading.textContent = section.heading;
      panel.appendChild(heading);
      for (const line of section.lines) {
        const paragraph = document.createElement("p");
        paragraph.className = "credits-dialog__line";
        paragraph.textContent = line;
        panel.appendChild(paragraph);
      }
    }

    root.appendChild(panel);
    root.addEventListener("click", (event) => {
      if (event.target === root) {
        this.hide();
        this.onClose?.();
      }
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.hide();
        this.onClose?.();
      }
    });

    document.body.appendChild(root);
    this._root = root;
  }
}
