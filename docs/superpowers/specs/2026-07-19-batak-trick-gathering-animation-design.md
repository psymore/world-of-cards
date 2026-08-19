# Batak trick-gathering animation — design

## Context

Batak's trick-completion flow today: when the 4th card of a trick is played, `BatakScreen`
holds it in `pendingPlay` (so it visually flies in to its trick-cross slot via the existing
`TravelCard`), waits `TRICK_COMPLETION_PAUSE_MS` (1100ms) so the full trick is readable, then
calls `performMove`. `batakGame.performMove` resolves a completed trick atomically — it computes
the winner and sweeps all 4 cards to `won-<winner>` within one call — so today the UI just shows
the 4 cards vanish in the same instant the state updates. There is no gather/sweep motion.

This spec adds one: once the hold pause ends, the 4 cards flip face-down and travel toward the
trick-winning player's seat before the move actually commits, closing the "known gap" flagged in
CLAUDE.md's Batak card-travel-animation entry and giving trick completion a proper visual
resolution.

**Scope: Batak only.** Pişti's fishing-pile capture is a structurally different mechanic (a
variable-sized, already-stacked pile vs. Batak's fixed 4 cards laid out at distinct positions) and
is explicitly deferred to its own future discussion — see "Deferred: Pişti" below.

## Data flow

### Winner must be known before commit

`performMove` doesn't expose an intermediate "trick just completed, here's the winner" moment —
only before/after state. To animate cards toward the winner, `BatakScreen` needs the winner
*before* calling `performMove`.

It gets this via the exact same pure function the engine itself uses:
`trickWinnerIndex(trick: Card[], trumpSuit: Suit): number`
(`packages/engine/src/games/batak/rules.ts`), today used internally by the Medium AI
(`ai/medium.ts`) but not re-exported from the public `@world-of-cards/engine/games/batak` subpath.

Change: add `export { trickWinnerIndex } from './rules';` to
`packages/engine/src/games/batak/index.ts`.

`BatakScreen` then assembles the same ordered arrays the engine would when the 4th card is played:

```
const priorEntries = state.currentTrick; // 3 entries: {playerId, cardId}
const priorCards = priorEntries.map(e =>
  state.table.zones['trick'].cards.find(c => c.id === e.cardId)!
);
const fullTrickCards = [...priorCards, card]; // card = the 4th card being played
const fullTrickPlayerIds = [...priorEntries.map(e => e.playerId), playerId];
const winnerPos = trickWinnerIndex(fullTrickCards, state.trumpSuit!);
const winnerId = fullTrickPlayerIds[winnerPos];
```

This calls the identical function the engine uses internally — no reimplementation, no risk of
drift between "what the UI predicts" and "what the engine actually resolves."

### New sequencing in `BatakScreen.commitMove`

Today, the trick-completing branch (`state.currentTrick.length === 3`) does:
fly-in (via `pendingPlay`) → hold (1100ms) → `performMove` (commit).

It becomes three phases:

1. **Fly-in** (unchanged) — 4th card travels to its trick slot via the existing
   `pendingPlay`/`TravelCard` mechanism.
2. **Hold** (unchanged, 1100ms total) — all 4 cards sit resting so the trick is readable.
3. **Gather** (new) — instead of calling `performMove` when the hold timer fires, snapshot the
   full trick into new local state:

   ```
   interface GatheringTrick {
     entries: { playerId: string; card: Card }[]; // all 4, play order
     winnerId: string;
   }
   ```

   Set `gatheringTrick`, clear `pendingPlay`. This snapshot drives the new flip+travel-out
   animation (`GATHER_DURATION_MS`, ~500ms — first-pass value, tune live). Only once that duration
   elapses does `performMove(move)` actually get called and `gatheringTrick` cleared — so the
   winner's "N tricks" badge count visibly ticks up right as the cards arrive, not before.

Non-trick-completing plays (1st–3rd card) are unaffected — they keep their existing
`PLAY_TRAVEL_DELAY_MS` fly-in-then-commit behavior.

## Animation / visual design

### New component: `GatherCard`

`apps/mobile/src/table/GatherCard.tsx` — a sibling to `TravelCard`, not a modification of it.
`TravelCard`'s contract is "fly *in* to wherever the caller renders it" (`originOffset` → `0,0`);
this is the reverse (fly *out* from render position toward a destination) plus a flip `TravelCard`
has no notion of. Different enough in shape and purpose to stay a separate component rather than
overloading `TravelCard`'s props (which Pişti's own reveal animation also depends on, unaffected
by this change).

Props:

```
interface GatherCardProps {
  card: Card;
  destinationOffset: { x: number; y: number };
  onComplete?: () => void; // not required if BatakScreen drives timing via its own timeout
}
```

- **Travel**: destination reuses the existing fixed direction-offset vectors
  (`REVEAL_ORIGIN_OFFSETS` in `apps/mobile/src/table/seating.ts` — ±165/±195px per side),
  resolved via the existing `resolveRevealOrigin(winnerId, humanPlayerId, seats)` helper. No new
  layout measurement — consistent with every other travel animation in this codebase.
- **Flip**: standard two-layer RN flip on one shared progress value — a face-up layer
  (`rotateY` interpolated 0°→90°, opacity 1→0) stacked over a face-down layer (`rotateY`
  interpolated 90°→180°, opacity 0→1), using `PlayingCard`'s existing `faceDown` prop for the
  back face. No new card-back art needed.
- **Fade-out**: opacity eases toward 0 over roughly the animation's last third, so each card
  visually dissolves as it approaches the winner's side rather than appearing to stop abruptly —
  there's no literal pile graphic to land on (Batak's turn-indicator-simplification pass already
  removed opponent card stacks entirely).
- All 4 `GatherCard` instances share one animation shape/duration, each independently
  native-driven (`useNativeDriver: true`) — architecturally the same cost class as the existing
  play-travel animation, just 4 concurrent instances for one discrete event, not a continuous
  cost.
- Respects `useReducedMotion()` the same way `TravelCard`/`EntranceCard` already do: reduced-motion
  users jump straight to the end state (faced-down, faded out) with no animated flight.

### Rendering integration

`TrickCenter` (`BatakTable.tsx`) gains an optional `gatheringTrick` prop. When set, it renders one
`GatherCard` per snapshot entry — bypassing the normal `pendingPlay`/`state.currentTrick`
slot logic entirely for that window, since engine state hasn't advanced yet and would otherwise
still only show 3 committed cards. Each card's origin position is its existing
`TRICK_SLOT_OFFSETS[position for that playerId]` (unchanged — it's already resting there);
`destinationOffset` is `revealOriginOffset(resolveRevealOrigin(winnerId, humanPlayerId, seats))`.

`BatakTable`'s props gain `gatheringTrick?: GatheringTrick | null`, threaded down from
`BatakScreen` alongside the existing `pendingPlay`.

## Explicitly out of scope

- **Pişti's pile-gather** — deferred, see below.
- **Measured real seat positions** — fixed direction offsets only, matching every other travel
  animation already in this codebase (the deferred "human hand real position" gap is a separate,
  already-tracked thread and not touched here).
- **Sequential flip-then-travel** — rejected in favor of simultaneous flip+travel (cheaper, one
  animation phase, reads as a natural "scoop" motion).
- New automated tests — decorative motion UI, per the standing 2026-07-07 testing policy.
- Proactive screenshot/visual verification — per the 2026-07-17 direction, verification happens
  live in the user's own running Expo session, not via unsolicited Playwright screenshots.

## Deferred: Pişti pile-gather

Raised during brainstorming as a possible extension, deliberately not built here. Cost tradeoff
recorded for whenever this is picked up: Pişti's capture pile is variable-sized (2 up to a dozen+
cards) and already renders as one stacked visual unit, unlike Batak's trick (4 cards at fixed,
distinct positions). Individually animating every card in a large pile would mean N simultaneous
flight paths crossing each other — still cheap on the native thread, but visually messier and more
moving parts than warranted. **Recommendation for that future spec: bundle the whole pile as one
moving unit** rather than animating each card individually — cheaper and a more natural fit for
Pişti's existing stacked-pile rendering.
