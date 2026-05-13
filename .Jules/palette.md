## 2025-04-05 - Wait UI Bounds Tooltip Accessibility
**Learning:** When disabling interactive elements (like increment/decrement buttons) in HTML UI overlays, using the native `disabled` attribute suppresses pointer events in many modern browsers, preventing `title` tooltips from appearing.
**Action:** Use `aria-disabled="true"` coupled with visual styling changes (e.g., opacity, cursor: not-allowed) and manual action blocking in the event handler instead of native `disabled` to ensure tooltips remain accessible to both mouse hover and screen readers.

## 2025-04-08 - Accessible Custom Toggles with aria-expanded
**Learning:** Missing `aria-expanded` attributes on custom HTML UI toggles (e.g. accordion triggers that expand/collapse content sections) creates an accessibility failure, as screen readers cannot interpret the open/closed state. The toggle state must be explicitly managed within its click listener. Additionally, linking the toggle element to the controlled content using `aria-controls` is essential.
**Action:** Always verify custom disclosure or accordion components use `aria-expanded` and `aria-controls`. Set an initial state and dynamically update `aria-expanded` via `setAttribute` whenever the layout toggles between visible or hidden states.

## 2025-04-10 - Button type Accessibility
**Learning:** Buttons created dynamically with `document.createElement("button")` default to `type="submit"` which can cause unwanted form submissions.
**Action:** Always set `type="button"` on dynamically created buttons that are not intended to submit forms.
## 2026-05-05 - Button type Accessibility
**Learning:** Buttons created dynamically with `document.createElement("button")` default to `type="submit"` which can cause unwanted form submissions. This is a common pattern in HTML-based UI overlays.
**Action:** Always set `type="button"` on dynamically created buttons that are not intended to submit forms. Use `btn.type = "button";`.
## 2026-05-11 - Title Attribute Restoration for Disabled States
**Learning:** When HTML elements like buttons are temporarily disabled and visually styled to indicate this (e.g. using `aria-disabled`), their default `title` attribute is often overridden to explain why they are disabled (e.g. "Maximum hours reached"). A common mistake when re-enabling the button is to use `removeAttribute('title')`, which strips the tooltip completely for the active state.
**Action:** When re-enabling an interactive element, explicitly restore its original descriptive `title` attribute via `setAttribute('title', '...')` instead of removing it, ensuring the element remains accessible and informative on hover.

## 2025-04-10 - Wait UI Modal Accessibility and Focus
**Learning:** Custom HTML DOM modal overlays must immediately receive programmatic focus when opened to ensure screen readers announce the dialog context and keyboard interactions are correctly scoped. Furthermore, linking the modal's visible title to the dialog container using `aria-labelledby` provides better semantic context than a static `aria-label`.
**Action:** When implementing modal overlays (e.g., `WaitUI`), add `tabindex="-1"` and an `aria-labelledby` attribute to the root dialog element, assign the corresponding `id` to its title heading, and immediately call `root.focus()` during the `show()` method.
