import { Fragment, render } from "preact";
import { GAME_VERSION } from "../platform/constants";
import { ModalDialog } from "./preact/modal-dialog";

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
      "bitECS — Mozilla Public License 2.0",
      "Preact — MIT License",
      "meshoptimizer glTF decoder (Arseny Kapoulkine) — MIT License",
    ],
  },
  {
    heading: "Art",
    lines: [
      "Characters, props and nature by Quaternius (quaternius.com) — CC0: Fantasy Props MegaKit, Medieval Village MegaKit, Stylized Nature MegaKit, Modular Character Outfits – Fantasy, Universal Base Characters, Universal Animation Library, Characters – Fantasy Races, Bestiary – Dungeon Monsters.",
      "KayKit Character Packs: Adventurers & Skeletons — CC0, Kay Lousberg (kaylousberg.com). Credit appreciated.",
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

/** The credits as a Preact panel. */
export function CreditsDialog(p: { onClose: () => void }) {
  return (
    <ModalDialog id="credits-title" title="Credits" className="credits-dialog" panelClassName="credits-dialog__panel" onClose={p.onClose}>
      {CREDITS_SECTIONS.map((section) => (
        <Fragment key={section.heading}>
          <h3 class="credits-dialog__heading">{section.heading}</h3>
          {section.lines.map((line) => <p key={line} class="credits-dialog__line">{line}</p>)}
        </Fragment>
      ))}
    </ModalDialog>
  );
}

/**
 * Pause-menu credits and license notice: a Preact dialog, so it can scroll
 * a long attribution list without growing the Babylon pause card.  The
 * show / hide / onClose API is unchanged.
 */
export class CreditsUI {
  public isVisible = false;
  public onClose: (() => void) | null = null;
  private _host: HTMLDivElement | null = null;

  public show(): void {
    if (typeof document === "undefined") return;
    if (!this._host) {
      this._host = document.createElement("div");
      document.body.appendChild(this._host);
    }
    this.isVisible = true;
    render(<CreditsDialog onClose={() => { this.hide(); this.onClose?.(); }} />, this._host);
  }

  public hide(): void {
    this.isVisible = false;
    if (this._host) render(null, this._host);
  }

  public destroy(): void {
    this.hide();
    this._host?.remove();
    this._host = null;
  }
}
