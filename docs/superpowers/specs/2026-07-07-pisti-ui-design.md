# Pişti: Mobile UI Design (Phase 2, Sub-Project 4)

**Status:** Approved
**Date:** 2026-07-07
**Scope:** The mobile screen(s) for playing a full hand of Pişti against an AI opponent — difficulty selection, the table itself, and end-of-hand results. This is the first Pişti sub-project touching `apps/mobile`; all engine-side work (rules, state model, `RuleEngine`, Easy/Medium/Hard AI, registration) is already complete and merged, per `docs/superpowers/specs/2026-07-07-pisti-rule-engine-design.md` and `docs/superpowers/specs/2026-07-07-pisti-ai-strategies-design.md`.

## Context

`getGame('pisti')` already returns a full `GameDescriptor<PistiState, PistiMove>` with `ruleEngine` and all three `aiStrategies`. `apps/mobile` currently has only a `HomeScreen` listing registered games (non-interactive) and a bare `RootNavigator` with a single `Home` route — no game has ever been played from the app. This sub-project builds the first vertical slice: tap a game on Home → play a full hand → see the result.

**Decisions made during brainstorming (not re-litigated here):**
- Full slice: difficulty picker → game table → results, not just the bare table.
- Cards are rendered as styled `View`/`Text` (rank + Unicode suit glyph), not SVG or image assets — no new native dependency needed for this sub-project.
- No animation library. Reanimated is deferred to its own follow-up once this screen works and can be profiled on-device (standing Phase 1 risk note).
- Save/resume via the existing `PersistenceAdapter` is deferred; exiting mid-hand discards it (with a confirm prompt). `stats:<gameId>` recording is deferred alongside it.
- Human is always `players[0]` (`'human'`) and goes first, per the rules doc's "player 0 goes first" convention; AI is `'ai'`. Fixed for v1 — alternating/random starting player is a possible fairness enhancement for a later multi-hand-match feature, not built now.

## 1. Navigation & Screens

`RootNavigator` gains one route: `Game: { gameId: string }`. `HomeScreen`'s `FlatList` items become pressable (`Pressable` wrapping the existing row), navigating to `Game` with the tapped game's `id`.

A new app-level registry, `apps/mobile/src/games/registry.ts`, maps `gameId → ScreenComponent`:

```ts
export const gameScreens: Record<string, React.ComponentType> = {
  pisti: PistiScreen,
};
```

The `Game` route resolves and renders the matching component (falling back to a simple "not implemented" message if a `gameId` has no entry — defensive, since `getGames()` could in principle list a game before its screen is registered).

`PistiScreen` (`apps/mobile/src/games/pisti/PistiScreen.tsx`) is a local three-phase state machine:

- **`setup`** — renders `PistiSetupView` (difficulty picker).
- **`playing`** — renders `GameScreenLayout` (shared chrome: title + exit button with a discard-confirm `Alert`) wrapping `PistiTable`.
- **`finished`** — same as `playing`, plus `GameResultModal` overlaid.

Starting a game calls `pistiGame.setup({ players: ['human', 'ai'] }, createRng(Date.now()))`, feeds the resulting `PistiState` into a freshly created `createGameSessionStore(pistiGame, initialState)`, and transitions to `playing`. "Play Again" (from the result modal) re-runs this exact sequence and returns to `playing`. "Back to Home" pops the navigation stack back to `Home`.

## 2. Component Breakdown

### Shared (`apps/mobile/src/components/`) — reusable by every future game

- **`PlayingCard.tsx`** — `{ card: Card } | { faceDown: true }`, plus an optional `size?: 'normal' | 'small'`. Renders rank + suit glyph (♠♥♦♣; red for ♥/♦, black for ♠/♣) in a bordered box when face-up, or a plain card-back box when face-down.
- **`GameScreenLayout.tsx`** — header bar (title + exit button), the exit-confirm `Alert` ("Discard this game?" / Cancel / Discard), and a content slot. Every future game's screen renders inside this.
- **`GameResultModal.tsx`** — generic over `ScoreBoard` + `PlayerId[]` (winners) + a `{ [playerId]: displayName }` map: shows each player's score, a "You win" / "You lose" / "Tie" headline, and `Play Again` / `Back to Home` buttons. Contains no Pişti-specific knowledge.

### Pişti-specific (`apps/mobile/src/games/pisti/`)

- **`PistiSetupView.tsx`** — three buttons (Easy/Medium/Hard), pre-selects `useSettingsStore.defaultDifficulty`. Calls `onStart(difficulty)`, which also calls `setDefaultDifficulty(difficulty)` so the choice persists for next time.
- **`PistiTable.tsx`** — the board: opponent row (face-down `PlayingCard`s, count only — hand visibility is a UI-layer concern per the rules/state design doc, since `PistiState` itself has no hidden information), center pile (top card face-up + a count badge), player's hand (tappable face-up cards, dimmed/disabled when it isn't `human`'s turn), and a status banner slot for capture/Pişti feedback.
- **`PistiScreen.tsx`** — wires the above together: owns `phase`, `difficulty`, the session store instance, and the `lastEvent` banner state.
- **`useAITurn.ts`** — a hook taking the session store, the chosen `AIStrategy<PistiState, PistiMove>`, and the human player id. Whenever the store's current player becomes `'ai'` and `gameOver(state)` is false, it schedules:
  ```ts
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      const move = aiStrategy.chooseMove(state, 'ai', pistiGame.getLegalMoves(state, 'ai'), rng);
      performMove(move);
    }, thinkingDelayMs);
  });
  ```
  Kept Pişti-scoped for now (not a shared hook) — worth lifting to `apps/mobile/src/hooks/` once Hearts, the next AI-opponent game in the build order, needs the identical pattern, per this project's existing convention of extracting shared code on its second real use rather than preemptively.

  Because turns strictly alternate in Pişti regardless of captures (`performMove` always flips `currentPlayerIndex`), one trigger per human move is sufficient — the hook never needs to chain multiple AI moves back to back.

## 3. State, Data Flow & Feedback

No new global store. `PistiScreen` holds local React state (`phase`, `difficulty`, `lastEvent`) plus the Zustand session store instance, created via `useState(() => createGameSessionStore(...))` and replaced wholesale on "Play Again". Data flows one direction: tap a card in `PistiTable` → `PistiScreen` calls `session.performMove({ type: 'play', cardId })` → store updates → `PistiTable` re-renders from the new state → `useAITurn`'s effect observes the new current player and, if it's now `'ai'`, schedules the AI's move the same way. `getLegalMoves` (not just `validateMove`) drives which of the human's cards are tappable, so illegal taps are prevented at the UI layer rather than silently rejected.

**Capture/Pişti feedback** (no animation, per the brainstorming decision): after each `performMove`, `PistiScreen` diffs the previous and new `PistiState` to detect a capture (the mover's `captured-<player>` zone grew). If so, it builds a banner string from the size of that growth and whether the pile had exactly 1 card before the move (the Pişti bonus condition already computed by the engine via `pistiBonusPoints`): `"You captured 4 cards!"`, `"Pişti! +10"`, `"Opponent captured the pile"`, `"Double Pişti! +20"`. This is stored as local `PistiScreen` state (`lastEvent`) with a ~2s auto-clear `setTimeout`, rendered inside `PistiTable`'s banner slot. No engine changes are needed — this is purely derived from before/after state snapshots the screen already has on hand.

## 4. Testing

RNTL smoke tests per the Phase 1 testing strategy, colocated with each component:

- **`PlayingCard`**: renders rank/suit text when face-up; renders a plain back with no rank/suit text when face-down.
- **`PistiSetupView`**: tapping a difficulty calls `onStart` with the right value and updates `useSettingsStore`.
- **`GameResultModal`**: renders correct scores and win/lose/tie headline across a few `ScoreBoard`/winner fixtures; both buttons fire their callbacks.
- **`PistiTable`**: only the current player's hand cards are pressable; tapping a legal card fires the expected `onPlayCard` callback; opponent cards render face-down and are never pressable.
- **`PistiScreen`**: end-to-end smoke test with a fixed RNG seed — select a difficulty, confirm the table renders, tap a legal card, confirm the store updates. A second test using Jest fake timers confirms the AI eventually calls `performMove` once it becomes its turn.

## Out of Scope (Deliberately Deferred)

- Reanimated / animated card transitions (capture slides, deal animation) — own follow-up once this screen is built and profiled on-device.
- Save/resume via the existing `PersistenceAdapter` — exiting mid-hand discards the game (with a confirm prompt).
- `stats:<gameId>` recording via `recordGameResult`.
- Multi-hand match play to a target score, dealer rotation / alternating starting player, the 4-player/2v2 team variant, and human-vs-human pass-and-play.
- Lifting `useAITurn` into a shared cross-game hook (revisit when Hearts is built).

## Next Step

Invoke `writing-plans` to turn this into a concrete implementation plan (file list, task breakdown, test-first order).
