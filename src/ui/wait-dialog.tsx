/**
 * The Wait dialog (T): choose 1–24 hours and wait, or cancel.  A Preact
 * panel on the DOM layer (engine overhaul, Phase 8; it was Babylon GUI in
 * the UI manager, which still opens and closes it).
 */
import { ModalDialog } from "./preact/modal-dialog";
import { PanelHost } from "./preact/panel-host";

export const WAIT_MIN_HOURS = 1;
export const WAIT_MAX_HOURS = 24;
const clamp = (h: number) => Math.max(WAIT_MIN_HOURS, Math.min(WAIT_MAX_HOURS, Math.round(h)));

export interface WaitDialogProps {
  hours: number;
  onHours(hours: number): void;
  onWait(): void;
  onCancel(): void;
}

export function WaitDialog(p: WaitDialogProps) {
  return (
    <ModalDialog id="wait-title" title="Wait" className="craft-panel wait-dialog" panelClassName="wait-dialog__panel" onClose={p.onCancel}>
      <p class="craft-panel__subtitle">How many hours do you wish to wait?</p>
      <div class="wait-dialog__selector"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); p.onHours(clamp(p.hours - 1)); }
          if (e.key === "ArrowRight") { e.preventDefault(); p.onHours(clamp(p.hours + 1)); }
        }}>
        <button type="button" class="craft-panel__btn" aria-label="Decrease wait time" disabled={p.hours <= WAIT_MIN_HOURS} onClick={() => p.onHours(clamp(p.hours - 1))}>◀</button>
        <input type="range" class="wait-dialog__range" min={WAIT_MIN_HOURS} max={WAIT_MAX_HOURS} step={1} value={p.hours}
          aria-label="Hours to wait" onInput={(e) => p.onHours(clamp(Number((e.target as HTMLInputElement).value)))} />
        <button type="button" class="craft-panel__btn" aria-label="Increase wait time" disabled={p.hours >= WAIT_MAX_HOURS} onClick={() => p.onHours(clamp(p.hours + 1))}>▶</button>
        <output class="wait-dialog__hours" aria-live="polite">{p.hours} h</output>
      </div>
      <div class="craft-panel__footer">
        <button type="button" class="craft-panel__btn craft-panel__btn--primary" onClick={p.onWait}>Wait</button>
        <button type="button" class="craft-panel__btn" onClick={p.onCancel}>Cancel</button>
      </div>
    </ModalDialog>
  );
}

/** Opened and closed by the UI manager; the hours chosen are remembered between opens. */
export class WaitDialogPanel {
  public hours = 8;
  private readonly _host = new PanelHost();
  private _handlers: { onWait(hours: number): void; onCancel(): void } | null = null;

  public open(handlers: { onWait(hours: number): void; onCancel(): void }): void {
    this._handlers = handlers;
    this._render();
  }

  public close(): void {
    this._handlers = null;
    this._host.hide();
  }

  private _render(): void {
    const h = this._handlers;
    if (!h) return;
    this._host.show(
      <WaitDialog
        hours={this.hours}
        onHours={(hours) => { this.hours = hours; this._render(); }}
        onWait={() => h.onWait(this.hours)}
        onCancel={() => h.onCancel()}
      />,
    );
  }
}
