## 2026-03-02 - Unified UI Closing with Escape
**Learning:** In Babylon.js games with multiple UI systems managing pointer lock and camera controls (Inventory, Quests, Skill Tree, Editor), relying solely on individual toggle keys (I, J, K) creates trapped states. Users instinctively press Escape to close overlays, which jarringly triggers the pause menu instead.
**Action:** Always intercept the Escape key handler globally to check for active UI overlay states. Prioritize calling their respective  methods and restoring pointer lock/camera controls *before* falling back to the default pause menu behavior.
## 2026-03-02 - Unified UI Closing with Escape
**Learning:** In Babylon.js games with multiple UI systems managing pointer lock and camera controls (Inventory, Quests, Skill Tree, Editor), relying solely on individual toggle keys (I, J, K) creates trapped states. Users instinctively press Escape to close overlays, which jarringly triggers the pause menu instead.
**Action:** Always intercept the Escape key handler globally to check for active UI overlay states. Prioritize calling their respective toggle methods and restoring pointer lock/camera controls *before* falling back to the default pause menu behavior.

## 2026-03-02 - Accessible Disabled States
**Learning:** Hiding disabled buttons from focus (`tabIndex = -1`) breaks screen reader discoverability. In complex UIs like Skill Trees, users need to know a skill exists, what it does, and *why* it's disabled (e.g. "Need Points" or "Mastered"). If it isn't focusable, a keyboard/screen reader user only perceives the skills they can afford.
**Action:** Always make disabled UI controls focusable (`isFocusInvisible = false`, `tabIndex = 0`) and provide an `accessibilityTag` describing its disabled reason. Add a subtle visual focus indicator so keyboard users aren't confused by hidden focus jumps.
## 2026-03-06 - [Distinct Keyboard Focus for Babylon GUI]
**Learning:** Babylon.js GUI elements handle keyboard focus via `onFocusObservable` and `onBlurObservable`. Since they do not have standard CSS `:focus-visible` outlines, distinct focus indicators (like increased border `thickness`) must be manually applied to differentiate keyboard focus from mouse hover (`onPointerEnterObservable`), which is critical for accessibility.
**Action:** When creating Babylon.js GUI interactive elements (Buttons, Rectangles), assign explicit visual style changes (e.g., border thickness or color) inside `onFocusObservable` and reset them in `onBlurObservable`, distinct from pointer hover states.

## 2026-03-21 - [Dynamic Accessible Disabled States in Alchemy UI]
**Learning:** In Babylon.js GUI, dynamically changing the state of a button (like the "Craft Potion" button) requires manually updating its `isEnabled` property, visual styles (background, text color), and `accessibilityTag` to reflect the new state. A static disabled state is not enough; the UI must communicate *why* it's currently disabled (e.g., "Need at least 2 ingredients to craft") and update immediately when the condition is met.
**Action:** When a button's interactive state depends on user input (like selecting ingredients), update its `isEnabled`, visual styling, and `accessibilityTag.description` synchronously with the state change to ensure screen readers and sighted users always have accurate feedback.
