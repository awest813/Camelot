/**
 * The title screen, in the tome style: the name in gilt over a lozenge
 * rule, a line of verse, and the menu as engraved lines.  Continue shows
 * whose tale it is and when it was saved.  Arrow keys move between the
 * lines; Enter chooses.
 */
import { useLayoutEffect, useRef } from "preact/hooks";
import { manageDialogFocus } from "./dialog-focus";
import { PanelHost } from "./preact/panel-host";

export interface TitleScreenProps {
  saved: { name: string; level: number; savedAt: number } | null;
  onContinue(): void;
  onNewGame(): void;
  onSettings(): void;
  onCredits(): void;
  /** Desktop builds only. */
  onQuit: (() => void) | null;
}

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago". */
export function savedAgo(savedAt: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - savedAt) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function TitleScreen(p: TitleScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    const focus = manageDialogFocus(root.current);
    root.current.querySelector<HTMLButtonElement>(".title-screen__item")?.focus();
    return () => focus.release();
  }, []);
  const items: Array<{ label: string; detail?: string; run: () => void; quiet?: boolean }> = [];
  if (p.saved) {
    items.push({
      label: "Continue",
      detail: `${p.saved.name} · Level ${p.saved.level}${p.saved.savedAt ? ` · saved ${savedAgo(p.saved.savedAt)}` : ""}`,
      run: p.onContinue,
    });
  }
  items.push({ label: "New Game", run: p.onNewGame });
  items.push({ label: "Settings", run: p.onSettings, quiet: true });
  items.push({ label: "Credits", run: p.onCredits, quiet: true });
  if (p.onQuit) items.push({ label: "Quit", run: p.onQuit, quiet: true });

  const move = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>(".title-screen__item") ?? []);
    if (buttons.length === 0) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (at + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    e.preventDefault();
  };

  return (
    <div ref={root} class="title-screen" role="dialog" aria-modal="true" aria-labelledby="title-screen-name" onKeyDown={move}>
      <div class="title-screen__plate">
        <p class="title-screen__kicker">A tale of the Round Table</p>
        <h1 id="title-screen-name" class="title-screen__name">Camelot</h1>
        <div class="title-screen__rule" aria-hidden="true">◆</div>
        <p class="title-screen__verse">The sword is drawn, the road is long,<br />and every hall remembers a song.</p>
        <nav class="title-screen__menu" aria-label="Main menu">
          {items.map((it) => (
            <button key={it.label} type="button" class={`title-screen__item${it.quiet ? " is-quiet" : ""}`} onClick={it.run}>
              <span class="title-screen__label">{it.label}</span>
              {it.detail && <span class="title-screen__detail">{it.detail}</span>}
            </button>
          ))}
        </nav>
      </div>
      <p class="title-screen__foot">↑ ↓ to choose · Enter to begin</p>
    </div>
  );
}

export class TitleScreenView {
  private readonly _host = new PanelHost();
  private _open = false;

  public get isOpen(): boolean {
    return this._open;
  }

  public open(props: TitleScreenProps): void {
    this._open = true;
    // The cover hides the HUD behind it (it would show through the fade-in).
    if (typeof document !== "undefined") document.body.classList.add("is-title");
    this._host.show(<TitleScreen {...props} />);
  }

  public close(): void {
    if (!this._open) return;
    this._open = false;
    if (typeof document !== "undefined") document.body.classList.remove("is-title");
    this._host.hide();
  }
}
