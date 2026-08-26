# Pis Yedili — Overview

**Owner:** whoever last did substantial work on Pis Yedili. **Load:** when touching Pis Yedili-specific code.

Pis Yedili ("dirty seven") is a Turkish card game in the Mau-Mau / Crazy Eights family: on your turn you
must match the top discard's suit or rank (or play a Jack, which is always legal). Jacks are wild — playing
one lets you declare the suit that becomes active for the next player, and also skips the next player's
turn (advances the turn by 2 instead of 1, so in a 2-player game a Jack means you immediately play again).
7s stack a draw-2 penalty onto the next player (who can defend by playing another 7, chaining the penalty
onward, or must draw the accumulated total and forfeit their turn). If you have no legal play you draw from
stock; if the stock is also empty you pass. First player to empty their hand wins.

Engine (rules, AI strategies, `GameDescriptor` registration) lives in
`packages/engine/src/games/pis-yedili/` (`rules.ts`, `types.ts`, `index.ts`). Mobile UI lives in
`apps/mobile/src/games/pis-yedili/` (`PisYedeliSetupView.tsx`, `PisYedeliScreen.tsx`,
`PisYedeliTable.tsx`, `PisYedeliSuitPickerModal.tsx`). `getGame('pis-yedili')` returns a full
`GameDescriptor`, registered via `apps/mobile/src/games/registry.ts` same as every other game.

Design/plan: `docs/superpowers/specs/2026-08-26-pis-yedili-mobile-ui-design.md` /
`docs/superpowers/plans/2026-08-26-pis-yedili-mobile-ui.md`.

## Status

Playable end-to-end: Home → Pis Yedili → pick a player count/difficulty → play a full hand against AI →
see the result → play again or return home. This mirrors the "simple & functional" scope the mobile UI
plan deliberately targeted — the animation/timer polish pass floated in the original feature request was
explicitly deferred and has not been built (no card-travel animation, no per-turn timer; moves resolve
instantly).

## Boundaries: deliberately out of scope so far

Animation/timer polish (see above), save/resume via `PersistenceAdapter`, `stats:<gameId>` recording, and
human-vs-human pass-and-play have not been picked up.
