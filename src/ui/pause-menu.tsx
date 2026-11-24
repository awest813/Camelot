/**
 * The pause menu (Esc): resume, save and load, export and import a save,
 * settings, credits, quit.  A Preact panel on the DOM layer (engine
 * overhaul, Phase 8; it was Babylon GUI in the UI manager, which still opens
 * and closes it).  Escape inside the menu resumes, as the key that opened it.
 */
import { ModalDialog } from "./preact/modal-dialog";
import { PanelHost } from "./preact/panel-host";

export interface PauseActions {
  resume(): void;
  save(): void;
  load(): void;
  exportSave(): void;
  importSave(): void;
  settings(): void;
  credits(): void;
  quit(): void;
  /** "Quit to Desktop" in the desktop build; "Quit to Menu" in the browser. */
  quitLabel?: string;
}

export function PauseMenu({ actions }: { actions: PauseActions }) {
  const items: Array<[string, () => void]> = [
    ["Resume", actions.resume],
    ["Save Game", actions.save],
    ["Load Game", actions.load],
    ["Export Save", actions.exportSave],
    ["Import Save…", actions.importSave],
    ["Settings", actions.settings],
    ["Credits", actions.credits],
    [actions.quitLabel ?? "Quit to Menu", actions.quit],
  ];
  return (
    <ModalDialog id="pause-title" title="Camelot" closeLabel="Resume" className="craft-panel pause-menu" panelClassName="pause-menu__panel" onClose={actions.resume}>
      <p class="pause-menu__subtitle">—  Paused  [Esc]  —</p>
      <nav class="pause-menu__items" aria-label="Pause menu">
        {items.map(([label, run]) => (
          <button key={label} type="button" class="craft-panel__btn pause-menu__item" onClick={run}>{label}</button>
        ))}
      </nav>
    </ModalDialog>
  );
}

/** Opened and closed by the UI manager with the game's actions. */
export class PauseMenuView {
  private readonly _host = new PanelHost();

  public open(actions: PauseActions): void {
    this._host.show(<PauseMenu actions={actions} />);
  }

  public close(): void {
    this._host.hide();
  }
}
