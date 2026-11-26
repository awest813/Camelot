/**
 * The pause menu (Esc): resume, save and load, export and import a save,
 * settings, credits, quit.  A Preact panel on the DOM layer (engine
 * overhaul, Phase 8; it was Babylon GUI in the UI manager, which still opens
 * and closes it).  Escape inside the menu resumes, as the key that opened it.
 *
 * Loading and quitting ask first, saying when the game was last saved, since
 * anything played after that is lost.
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { ModalDialog } from "./preact/modal-dialog";
import { savedAgo } from "./title-screen";
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
  /** When the game was last saved (ms since the epoch), or null with no save. */
  savedAt?(): number | null;
}

/** What leaving asks before it throws away play since the last save. */
type Confirm = "load" | "quit";

function sinceSave(savedAt: number | null): string {
  if (savedAt === null) return "This tale has not been saved.";
  return savedAt > 0 ? `Last saved ${savedAgo(savedAt)}.` : "A save is kept.";
}

export function PauseMenu({ actions }: { actions: PauseActions }) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(() => actions.savedAt?.() ?? null);
  const nav = useRef<HTMLElement>(null);
  const firstConfirm = useRef<HTMLButtonElement>(null);
  const quitLabel = actions.quitLabel ?? "Quit to Menu";
  const knowsSaves = actions.savedAt !== undefined;

  // Keep focus inside what is shown when the view swaps.
  useLayoutEffect(() => {
    if (confirm) firstConfirm.current?.focus();
    else if (nav.current?.contains(document.activeElement) === false) nav.current.querySelector<HTMLButtonElement>("button")?.focus();
  }, [confirm]);

  const ask = (what: Confirm, run: () => void) => () => (knowsSaves ? setConfirm(what) : run());
  const items: Array<[string, () => void]> = [
    ["Resume", actions.resume],
    ["Save Game", () => { actions.save(); setSavedAt(actions.savedAt?.() ?? null); }],
    ["Load Game", ask("load", actions.load)],
    ["Export Save", actions.exportSave],
    ["Import Save…", actions.importSave],
    ["Settings", actions.settings],
    ["Credits", actions.credits],
    [quitLabel, ask("quit", actions.quit)],
  ];
  const close = () => (confirm ? setConfirm(null) : actions.resume());
  return (
    <ModalDialog id="pause-title" title="Camelot" closeLabel="Resume" className="craft-panel pause-menu" panelClassName="pause-menu__panel" onClose={close}>
      <p class="pause-menu__subtitle">The tale waits for you. (Esc to resume)</p>
      {knowsSaves && <p class="pause-menu__saved">{sinceSave(savedAt)}</p>}
      {confirm ? (
        <div class="pause-menu__confirm" role="group" aria-labelledby="pause-confirm-q">
          <p id="pause-confirm-q" class="pause-menu__confirm-q">
            {confirm === "load" ? "Return to your last save?" : `${quitLabel}?`}
          </p>
          <p class="pause-menu__confirm-note">
            {savedAt === null ? "Nothing of this tale has been saved." : `Anything done since the last save${savedAt > 0 ? ` (${savedAgo(savedAt)})` : ""} will be lost.`}
          </p>
          <div class="pause-menu__confirm-actions">
            {confirm === "quit" && (
              <button ref={firstConfirm} type="button" class="craft-panel__btn pause-menu__confirm-btn pause-menu__confirm-btn--primary"
                onClick={() => { actions.save(); actions.quit(); }}>Save and quit</button>
            )}
            <button ref={confirm === "load" ? firstConfirm : undefined} type="button" class="craft-panel__btn pause-menu__confirm-btn"
              disabled={confirm === "load" && savedAt === null}
              onClick={() => { setConfirm(null); (confirm === "load" ? actions.load : actions.quit)(); }}>
              {confirm === "load" ? "Load" : "Quit without saving"}
            </button>
            <button type="button" class="craft-panel__btn pause-menu__confirm-btn" onClick={() => setConfirm(null)}>Back</button>
          </div>
        </div>
      ) : (
        <nav ref={nav} class="pause-menu__items" aria-label="Pause menu">
          {items.map(([label, run]) => (
            <button key={label} type="button" class="craft-panel__btn pause-menu__item" onClick={run}
              disabled={label === "Load Game" && knowsSaves && savedAt === null}>{label}</button>
          ))}
        </nav>
      )}
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
