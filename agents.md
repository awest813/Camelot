# Agent guide: character creation and player onboarding

This document is for AI coding agents and contributors who need to change how new players enter the game.

## Character creation

- **UI**: `src/ui/character-creation-ui.ts` — `CharacterCreationUI.open()` returns a `CharacterCreationResult` (`name`, `raceId`, `birthsignId`, `classId`, `skipGameplayTips`).
- **Flow**: Welcome (copy + optional “skip gameplay tips”) → Name → Race → Birthsign → Class → resolve.
- **Styling**: `src/css/main.css` — `.character-create*` and `.onboarding-tip*`.
- **Game integration**: `Game._runCharacterCreation()` in `src/game.ts` applies choices via `raceSystem.chooseRace`, `birthsignSystem.chooseBirthsign`, `classSystem.chooseClass`, sets `player.name`, then persists skip preference and may start onboarding.

## Systems touched by choices

- **Race**: `src/systems/race-system.ts` — heritage, attribute bonuses, racial powers, starting skill bonuses.
- **Birthsign**: `src/systems/birthsign-system.ts` — guardian grouping, permanent modifiers, daily powers.
- **Class**: `src/systems/class-system.ts` — specialization, favored attributes, major skills, XP multipliers.

## Player onboarding (post-creation tips)

- **Preference**: `src/onboarding-preferences.ts` — `camelot_skip_onboarding_tips` in `localStorage` (`1` = do not auto-start tips). Updated from the welcome-step checkbox and when the player opts out.
- **Engine**: `TutorialSystem` in `src/systems/tutorial-system.ts` — linear steps with `onStepBegin` / `advance()` / `onTutorialComplete`.
- **Wiring** (`src/game.ts`):
  - `_wireOnboardingTutorialUi()` attaches banner rendering and completion messaging.
  - `_startOnboardingTutorialIfNeeded()` registers steps and calls `start()` after character creation (or default creation on failure).
  - **Space** advances the active tip when not paused and no blocking overlay (inventory, quest log, dialogue, map editor).
  - **Auto-advance**: opening inventory (`I`) on the inventory step, **E** interaction (loot or talk) on the interact step, opening quest log (`J`) on the quests step.
- **Hooks**: `InventorySystem.onOpen`, `QuestSystem.onOpen`, `dialogueSystem.onTalkStart`, `interactionSystem.onLootPickup` (see `game.ts` for the `currentStep.id` checks).

## Failure path

If `CharacterCreationUI.open()` rejects, `Game` logs, calls `_applyDefaultCharacterCreation()` (Nord / Warrior birthsign / Warrior class), restores input, and still runs `_startOnboardingTutorialIfNeeded()` unless tips are skipped in storage.

## Tests

- `npm test` — full suite.
- `npm run build` — TypeScript + Vite build.

When extending onboarding, prefer new `TutorialSystem` steps and keep banner text short; document new hotkeys in both the step `message` and `agents.md` if they are non-obvious.
