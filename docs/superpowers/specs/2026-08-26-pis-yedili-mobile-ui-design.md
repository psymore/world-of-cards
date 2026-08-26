# Pis Yedili Mobile UI — Design

**Status:** approved for planning. **Owner:** whoever picks up the implementation plan.

## Purpose

Pis Yedili's engine (rules, Easy/Medium/Hard AI, `registerGame`) is complete in
`packages/engine/src/games/pis-yedili/`, but nothing in `apps/mobile` imports from that
subpath yet, so the game is unregistered at runtime and invisible on the home screen (which
lists games via `getGames()`). This adds a playable mobile screen for it, following the
existing Pişti/Batak pipeline stage ("mobile UI" — see `docs/status/roadmap.md`'s build
order).

## Scope

A simple, functional table — not the animation-rich Pişti/Batak experience. Explicitly out
of scope for this pass: card-travel reveal animation, deal-sequence flourish, capture/bonus
banners, dev-tuning modal. These can be added in a later polish pass if wanted, the same way
Pişti/Batak's own animation layers were added well after their first playable versions.

Free-for-all only, 2–4 players — the engine has no team/partnership concept for this game,
so there's no four-player-mode toggle like Pişti's.

## Architecture

New module `apps/mobile/src/games/pis-yedili/`, reusing every game-agnostic piece already
proven by Pişti/Batak rather than forking them:

- `createGameSessionStore` (state/session lifecycle)
- `useAITurn` (AI move scheduling)
- `GameScreenLayout`, `GameResultModal` (screen chrome, end-of-game modal)
- `assignSeats` / `OpponentSeatGroup` / `PlayerBadge` (seating + nameplates)
- `PlayingCard` (card rendering)
- `DifficultyStars`, `IconButton`, `TableFelt` (setup screen)

`HandFrame` was considered for the hand area too but dropped: it needs per-game `bottomOffset`
tuning against each hand's own geometry (see Batak's use of it), which is out of scope for this
feature's simple & functional pass.

New files:

| File | Responsibility |
|---|---|
| `PisYedeliSetupView.tsx` | Player count (2–4) + difficulty picker. Same shape as `PistiSetupView`, minus the team-mode toggle. |
| `PisYedeliScreen.tsx` | Session lifecycle (setup → active game), mirrors `PistiScreen.tsx`'s `ActiveGame` split but without the reveal-delay/travel-animation machinery — moves commit directly via `performMove`. |
| `PisYedeliTable.tsx` | Renders opponent seats, the stock pile, the discard pile (top card face-up), and the human's hand. Receives the current legal move set as a `legalMoves` prop (computed by `PisYedeliScreen.tsx`'s `ActiveGame`, matching Batak's screen-computes/table-receives-as-prop split) to know which hand cards are tappable and whether Draw/Pass are available. |
| `PisYedeliSuitPickerModal.tsx` | 4-suit-glyph picker shown when the human taps a Jack, before the move (with `declaredSuit`) commits. |

`apps/mobile/src/games/registry.ts` gains `'pis-yedili': PisYedeliScreen` — this both makes
the screen reachable via `RootNavigator`'s `Game` route and (by importing
`@world-of-cards/engine/games/pis-yedili`, directly or transitively) triggers that module's
top-level `registerGame(pisYedeliDescriptor)` call, so it appears in `getGames()` and thus on
the home screen with no `HomeScreen`/`gameDisplay.ts` changes — `GameCategory` already has a
`'draw-and-discard'` label/accent (`gameDisplay.ts` already covers it).

## Data flow / interaction model

Single-tap-to-play — no select-then-confirm step, unlike Batak's hand:

1. Each render, `PisYedeliScreen`'s `ActiveGame` calls `ruleEngine.getLegalMoves(state,
   humanPlayerId)` and passes the result down to `PisYedeliTable` as a `legalMoves` prop.
2. A hand card renders interactive (normal opacity, tappable) if some legal move's `cardId`
   matches it; otherwise dimmed/non-interactive, same visual convention Batak already uses
   for illegal cards.
3. Tapping a legal non-Jack card calls `performMove({ type: 'play', cardId })` directly.
4. Tapping a legal Jack opens `PisYedeliSuitPickerModal` (a `CenteredDecisionModal`, not a
   native `Modal` — native `Modal` was tried first but steals header-button taps the same way
   it did for Batak's trump-suit picker before that was fixed); picking a suit calls
   `performMove({ type: 'play', cardId, declaredSuit })`. There's no cancel/dismiss path,
   matching Batak's trump-suit picker precedent — once a Jack is tapped, a suit must be
   chosen.
5. Tapping the stock pile, when `draw` is in the legal set, calls
   `performMove({ type: 'draw' })`.
6. A "Pass" button renders only when `pass` is in the legal set (i.e. stuck under a pending
   7-penalty with no 7 in hand and nothing left to draw) and calls
   `performMove({ type: 'pass' })`.
7. AI turns go through `useAITurn` exactly as Pişti/Batak do — `aiStrategy.chooseMove` picks
   from the same `getLegalMoves` list, `onMove` calls `performMove` directly (no reveal
   delay, since there's no travel animation to sequence around).

State updates apply immediately on every move — no intermediate "revealing" UI state, which
is what makes skipping the travel-animation machinery safe: Pişti/Batak's `REVEAL_DELAY_MS`
dance exists solely to give that animation time to play before the state (and thus the
rendered hand/pile) changes out from under it.

## Error handling

None beyond what `getLegalMoves`/`validateMove` already guarantee: the table only ever
offers moves the engine considers legal, so there's no user-facing invalid-move path to
handle. `PisYedeliScreen` follows `PistiScreen`'s existing pattern of rendering nothing
(`gameScreens[gameId]` returns `undefined`) if `gameId` doesn't resolve — unchanged, no new
handling needed there.

## Testing

Per this repo's UI testing policy (`docs/governance/engineering-principles.md` §4), no new
tests are written proactively for the mobile UI components themselves. The existing engine
tests (`packages/engine/src/games/pis-yedili/*.test.ts`) already cover rules/AI/simulation
and are unaffected by this change. Manual verification: run the app, start a Pis Yedili
game at each player count, confirm legal-move dimming, Jack suit-declare, forced-draw-on-7
stacking, and a full game reaching `GameResultModal`.
