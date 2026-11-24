/**
 * The quest log (J): active quests first, then failed, then completed,
 * each with its objectives and reward.  A Preact panel on the DOM layer
 * (engine overhaul, Phase 8; it was Babylon GUI in the UI manager, which
 * still opens, updates and closes it).
 */
import type { Quest } from "../systems/quest-system";
import { ModalDialog } from "./preact/modal-dialog";
import { PanelHost } from "./preact/panel-host";

function QuestEntry({ quest }: { quest: Quest }) {
  const state = quest.isCompleted ? "done" : quest.isFailed ? "failed" : "active";
  const mark = quest.isCompleted ? "✓" : quest.isFailed ? "✕" : "◆";
  return (
    <li class={`quest-log__quest quest-log__quest--${state}`}>
      <h3 class="quest-log__name"><span aria-hidden="true">{mark} </span>{quest.name}
        {state !== "active" && <span class="visually-hidden"> ({state === "done" ? "completed" : "failed"})</span>}
      </h3>
      <ul class="quest-log__objectives">
        {quest.objectives.map((o) => (
          <li key={o.id} class={o.completed ? "is-done" : ""}>
            <span aria-hidden="true">{o.completed ? "✓" : "○"} </span>{o.description} ({o.current}/{o.required})
          </li>
        ))}
      </ul>
      {quest.reward && <p class="quest-log__reward">Reward: {quest.reward}</p>}
    </li>
  );
}

export function QuestLog({ quests, onClose }: { quests: readonly Quest[]; onClose(): void }) {
  const active = quests.filter((q) => q.isActive && !q.isCompleted && !q.isFailed);
  const failed = quests.filter((q) => q.isFailed);
  const done = quests.filter((q) => q.isCompleted && !q.isFailed);
  const ordered = [...active, ...failed, ...done];
  return (
    <ModalDialog id="quest-log-title" title="Quest Log" className="craft-panel quest-log" panelClassName="quest-log__panel" onClose={onClose}>
      {ordered.length === 0
        ? <p class="craft-panel__empty">No quests yet.</p>
        : <ul class="quest-log__list">{ordered.map((q) => <QuestEntry key={q.id} quest={q} />)}</ul>}
    </ModalDialog>
  );
}

/** Opened, updated and closed by the UI manager. */
export class QuestLogView {
  private readonly _host = new PanelHost();
  private _quests: readonly Quest[] = [];
  private _onClose: (() => void) | null = null;

  public open(onClose: () => void): void {
    this._onClose = onClose;
    this._render();
  }

  /** Show these quests (now, if open; else the next time it opens). */
  public update(quests: readonly Quest[]): void {
    this._quests = quests;
    if (this._onClose) this._render();
  }

  public close(): void {
    this._onClose = null;
    this._host.hide();
  }

  private _render(): void {
    const onClose = this._onClose;
    if (onClose) this._host.show(<QuestLog quests={this._quests} onClose={onClose} />);
  }
}
