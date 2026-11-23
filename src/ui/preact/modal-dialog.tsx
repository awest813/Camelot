/**
 * A modal dialog for Preact panels: the dimmed backdrop, a header with the
 * title and a ✕, focus kept inside while open, and the three ways out
 * (✕, a click on the backdrop, Escape) all calling `onClose`.
 *
 * The first Preact component (engine overhaul, Phase 2). New panels build
 * on this instead of hand-made DOM.
 */
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { manageDialogFocus } from "../dialog-focus";

export interface ModalDialogProps {
  /** Id for the title, so the dialog is labelled by it. */
  id: string;
  title: string;
  /** Extra class names on the backdrop and the panel. */
  className?: string;
  panelClassName?: string;
  closeLabel?: string;
  onClose: () => void;
  children?: ComponentChildren;
}

export function ModalDialog(p: ModalDialogProps) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const focus = manageDialogFocus(root.current);
    return () => focus.release();
  }, []);
  return (
    <div
      ref={root}
      class={`graphics-settings ${p.className ?? ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={p.id}
      style={{ display: "flex" }}
      onClick={(e) => { if (e.target === e.currentTarget) p.onClose(); }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        p.onClose();
      }}
    >
      <div class={`graphics-settings__panel ${p.panelClassName ?? ""}`.trim()}>
        <div class="graphics-settings__header">
          <h2 id={p.id} class="graphics-settings__title">{p.title}</h2>
          <button type="button" class="graphics-settings__close" aria-label={p.closeLabel ?? `Close ${p.title.toLowerCase()}`} onClick={p.onClose}>
            ✕
          </button>
        </div>
        {p.children}
      </div>
    </div>
  );
}
