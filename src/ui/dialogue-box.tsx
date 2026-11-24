/**
 * The conversation box: the speaker, their line, and the numbered choices
 * (locked ones shown with the reason).  A Preact panel on the DOM layer
 * (engine overhaul, Phase 8; it was Babylon GUI in the dialogue system,
 * which still owns the conversation, the keys and the highlight).
 *
 * Not modal: the world stays visible above it, and the dialogue system's
 * own key handler (capture phase) answers the keyboard.
 */
import { PanelHost } from "./preact/panel-host";

export interface DialogueBoxChoice {
  text: string;
  enabled: boolean;
  reason?: string;
}

export interface DialogueBoxProps {
  speaker: string;
  text: string;
  choices: ReadonlyArray<DialogueBoxChoice>;
  selected: number;
  onHover(index: number): void;
  onPick(index: number): void;
}

/** "[1]  Ale." — numbers only for the first nine (the digit keys). */
export function choiceLabel(c: DialogueBoxChoice, index: number): string {
  const num = index < 9 ? `[${index + 1}]  ` : "";
  return c.enabled ? `${num}${c.text}` : `${num}${c.text}  —  ${c.reason ?? "unavailable"}`;
}

export function DialogueBox(p: DialogueBoxProps) {
  return (
    <section class="dialogue-box" role="dialog" aria-label={`Conversation with ${p.speaker}`}>
      <h2 class="dialogue-box__speaker">✦  {p.speaker}</h2>
      <p class="dialogue-box__text" aria-live="polite">"{p.text}"</p>
      <ol class="dialogue-box__choices">
        {p.choices.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              class="dialogue-box__choice"
              aria-current={i === p.selected ? "true" : undefined}
              disabled={!c.enabled}
              onMouseEnter={() => c.enabled && p.onHover(i)}
              onFocus={() => c.enabled && p.onHover(i)}
              onClick={() => p.onPick(i)}
            >
              {choiceLabel(c, i)}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Shown and hidden by the dialogue system. */
export class DialogueBoxPanel {
  private readonly _host = new PanelHost();
  public isOpen = false;

  public show(props: DialogueBoxProps): void {
    this.isOpen = true;
    this._host.show(<DialogueBox {...props} />);
  }

  public hide(): void {
    this.isOpen = false;
    this._host.hide();
  }
}
