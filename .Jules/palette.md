## 2025-04-05 - Wait UI Bounds Tooltip Accessibility
**Learning:** When disabling interactive elements (like increment/decrement buttons) in HTML UI overlays, using the native `disabled` attribute suppresses pointer events in many modern browsers, preventing `title` tooltips from appearing.
**Action:** Use `aria-disabled="true"` coupled with visual styling changes (e.g., opacity, cursor: not-allowed) and manual action blocking in the event handler instead of native `disabled` to ensure tooltips remain accessible to both mouse hover and screen readers.

## 2025-04-08 - Accessible Custom Toggles with aria-expanded
**Learning:** Missing `aria-expanded` attributes on custom HTML UI toggles (e.g. accordion triggers that expand/collapse content sections) creates an accessibility failure, as screen readers cannot interpret the open/closed state. The toggle state must be explicitly managed within its click listener. Additionally, linking the toggle element to the controlled content using `aria-controls` is essential.
**Action:** Always verify custom disclosure or accordion components use `aria-expanded` and `aria-controls`. Set an initial state and dynamically update `aria-expanded` via `setAttribute` whenever the layout toggles between visible or hidden states.

## 2025-04-10 - Button type Accessibility
**Learning:** Buttons created dynamically with `document.createElement("button")` default to `type="submit"` which can cause unwanted form submissions.
**Action:** Always set `type="button"` on dynamically created buttons that are not intended to submit forms.
## 2024-05-18 - Tooltips vs aria-disabled on UI buttons
**Learning:** When using \`aria-disabled\` for UI elements like buttons, it is important not to strip the \`title\` property when removing the disabled state, otherwise the button loses its tooltip text in the default active state.
**Action:** When re-enabling HTML buttons that were previously marked as \`aria-disabled="true"\`, restore their descriptive \`title\` via \`setAttribute("title", "...")\` instead of completely removing the attribute with \`removeAttribute("title")\`.
