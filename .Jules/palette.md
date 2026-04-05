## 2025-04-05 - Wait UI Bounds Tooltip Accessibility
**Learning:** When disabling interactive elements (like increment/decrement buttons) in HTML UI overlays, using the native `disabled` attribute suppresses pointer events in many modern browsers, preventing `title` tooltips from appearing.
**Action:** Use `aria-disabled="true"` coupled with visual styling changes (e.g., opacity, cursor: not-allowed) and manual action blocking in the event handler instead of native `disabled` to ensure tooltips remain accessible to both mouse hover and screen readers.
