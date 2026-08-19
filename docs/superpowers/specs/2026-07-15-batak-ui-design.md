# Batak (4-Player Individual): Mobile UI Design

**Status:** Approved
**Date:** 2026-07-15
**Scope:** The mobile screen(s) for playing a full hand of Batak against 3 AI opponents — difficulty selection, bidding, trump selection, trick play, and end-of-hand results. This is the fourth Batak sub-project, following rules/state design, the rule engine, and AI strategies (all merged to `master`). `getGame('batak')` already returns a full `GameDescriptor<BatakState, BatakMove>` with `ruleEngine` and all three `aiStrategies`.

## Context

Batak is fixed at exactly 4 players for this sub-project (`batakDescriptor.minPlayers === maxPlayers === 4`), individual scoring only — no partner mode, no 3-player variant (both deferred to their own future sub-projects, per `CLAUDE.md`'s roadmap note). A hand has three sequential phases (`BatakState.phase`): `bidding` (players bid a trick count or pass, in turn order, until one bidder remains or all four pass), `trump-selection` (the bid winner alone picks a suit), and `playing` (13 tricks, mandatory suit-following/raise, trump-broken-to-lead). `getLegalMoves` already returns the correct move shape for whichever phase is current, so no phase-detection logic needs to be invented at the UI layer beyond reading `state.phase`.

**Why this diverges from Pişti's UI design in one structural way:** Pişti has a single shared capture pile — every play is "add one card to the pile, maybe capture it," and per-seat trick layout was explicitly deferred in Pişti's UI because retrofitting it onto an already-built shared-pile mechanic was judged too costly for that pass. Batak has no existing mechanic to retrofit: a "trick" *is* the 4 cards each seat played this round, which is naturally a per-seat layout from the start, not an add-on. This design builds it as the real first design, confirmed with the user rather than assumed.

**Decisions made during brainstorming (not re-litigated here):**
- Per-seat trick layout from the start (not deferred, unlike Pişti's original pile-only pass).
- Bidding and trump-selection are integrated directly onto the same table view as trick play — no separate screen/modal for the auction.
- No animated card-travel motion this pass (matches Pişti's own first UI pass — Reanimated/travel polish is a later follow-up), **except** a brief non-animated pause (~1.1s) holding the trick-completing 4th card visible before it sweeps to the winner's pile — necessary because the rule engine resolves a completed trick atomically (the 4th `performMove` call computes the winner *and* sweeps in one state transition, with no intermediate "4 cards visible" state), so without this pause the completed trick would never be visibly readable.
- The generic seat-assignment geometry (3 opponents at left/top/right, human at bottom; fan/stack math) is extracted out of Pişti's `pistiSeating.ts` into a new shared, game-agnostic module — this is the second real use of that exact layout (Pişti's own 4-player free-for-all mode already needs it), matching the project's established convention of extracting shared code on its second real use rather than preemptively.
- No new tests for the Batak UI components/screens, per the standing testing policy (set 2026-07-07: default to not writing new tests for mobile UI, ask before adding one) — this is the first mobile UI sub-project since that policy took effect. The seating extraction re-runs Pişti's existing tests to confirm no regression, but writes none new.

## 1. Navigation, Registration & Setup

- `packages/engine/package.json`'s `exports` map gains `"./games/batak": "./src/games/batak/index.ts"` — the same one-time subpath addition Pişti's UI sub-project made for itself.
- `apps/mobile/src/games/registry.ts` gains `batak: BatakScreen`. `HomeScreen` already lists any registered game automatically (`getGames()`-driven `FlatList`) — no changes needed there.
- New `apps/mobile/src/games/batak/` directory: `BatakScreen.tsx`, `BatakSetupView.tsx`, `BatakTable.tsx`.
- **`BatakSetupView.tsx`** is a difficulty picker only (Easy/Medium/Hard, pre-selecting `useSettingsStore.defaultDifficulty`, calling `setDefaultDifficulty` on selection) — no player-count or mode picker, since this sub-project is fixed at 4 players / individual scoring. Header with a back-to-Home link, matching `PistiSetupView`'s established layout/theming (navy/gold tokens).
- **`BatakScreen.tsx`** starts a game with `players: ['human', 'ai-1', 'ai-2', 'ai-3']`, calling `batakDescriptor.ruleEngine.setup({ players }, createRng(Date.now()))`, fed into `createGameSessionStore(batakDescriptor.ruleEngine, initialState)` — a direct, unmodified reuse of the existing generic store factory (no Batak-specific changes needed there).
- **AI turns are a direct, unmodified reuse of `useAITurn`** — it already only depends on `getLegalMoves`/`chooseMove`/`gameOver` being phase-agnostic, which they are; it drives bidding, trump-selection, and card-play turns for all 3 AI seats (`aiPlayerIds: ['ai-1', 'ai-2', 'ai-3']`) with zero code changes.

## 2. Shared Seating Extraction

New `apps/mobile/src/table/seating.ts` — pure, zero-RN-dependency (mirrors `pistiSeating.ts`'s own convention, independently testable, no rendering code):

```ts
export type SeatPosition = 'top' | 'left' | 'right';
export interface Seat { position: SeatPosition; playerId: string; }
export function assignSeats(opponentPlayerIds: string[]): Seat[];
export function fanRotationDeg(index: number, count: number): number;
export function fanCurveY(index: number, count: number): number;
export const OPPONENT_CARD_OVERLAP: number;
export const SIDE_CARD_STYLES: ({ marginTop: number } | undefined)[];
```

Contents moved verbatim from `apps/mobile/src/games/pisti/pistiSeating.ts` (no behavior change — a pure extraction). `pistiSeating.ts` keeps only what's genuinely Pişti-specific (`RevealOrigin`, `REVEAL_ORIGIN_OFFSETS`, `resolveRevealOrigin`, `PARTNER_SEAT_INDEX`) and imports the shared pieces from the new module. Pişti's existing test suite (`pistiSeating` is exercised indirectly via `PistiTable.test.tsx`) is re-run after the move to confirm no regression — no new tests are written for the extraction itself.

## 3. `BatakTable.tsx`

Renders one continuous table across all three phases, reusing `TableFelt`/`TableWoodCorners`/`PlayerAvatar`/`SuitIcon` from `@world-of-cards/ui` exactly as-is (no changes to that package).

**Seat badges (all phases):** name + a phase-appropriate status —
- `bidding`: current bid amount, `"Pass"`, or `"—"` (hasn't acted yet), read from `state.bids[playerId]`.
- `trump-selection` / `playing`: tricks-won count (`state.tricksWon[playerId]`), the same badge shape as Pişti's captured-count, just a different source field.

Active-turn glow (`badgeActive`, existing `glowShadow` style) reused unmodified — `state.players[state.currentPlayerIndex] === playerId` still determines it identically to Pişti.

**Center area — phase-dependent:**
- **`bidding`:** shows the current highest bid and who holds it (`state.highestBid`, and the player whose `bids[p] === state.highestBid`). When it's the human's turn, their hand row is replaced by a wrapped/scrollable row of bid buttons — one per legal amount from `getLegalMoves(state, 'human')` (`{type:'bid', amount}` moves rendered as `"Bid 5"`, `"Bid 6"`, … up to 13, plus a `{type:'pass'}` move rendered as `"Pass"`). AI turns show no extra UI beyond the badge state — `useAITurn` resolves them.
- **`trump-selection`:** if the human is `state.bidWinner`, 4 suit buttons (`SuitIcon` for ♠♥♦♣) replace their hand row; tapping one calls `onSelectTrump(suit)` → `performMove({type:'selectTrump', suit})`. If an AI is the bid winner, a plain "Opponent is choosing trump…" text state — `useAITurn` resolves it automatically, no interactive UI needed.
- **`playing`:** 4 trick slots positioned at bottom (human)/left/top/right (from `assignSeats`), each showing the card that seat played in the current trick (from `state.currentTrick`, cross-referenced with `state.table.zones['trick'].cards` for the actual `Card` object — same lockstep pattern the rule engine itself relies on), empty otherwise. A persistent small readout above the trick area — `"Trump: ♠"` (`state.trumpSuit`) and `"Contract: 7 (AI 2)"` (`state.contract` / `state.bidWinner`) — stays visible for the whole `playing` phase, since both remain relevant throughout.

**Human hand (playing phase):** same `SelectableCard`/`useCardSelection` tap-to-select-then-tap-to-play interaction as Pişti's hand row, unmodified — `onPlayCard(cardId)` prop, disabled/dimmed exactly like Pişti's `isHumanInteractive` pattern when it isn't the human's turn or their play is mid-pause (see below).

**Opponent hands (playing phase):** face-down count only, same fan (top seat) / vertical stack (side seats) rendering as Pişti's 4-player mode, now sourced from the shared `seating.ts` module instead of duplicated geometry.

## 4. Trick Completion Pause

`BatakScreen` holds the trick-completing (4th) move locally before committing it — structurally similar to Pişti's `revealedMove`/`revealThenCommit`, but without any `Animated.Value`/travel-motion fields, since no animation is in scope this pass:

```ts
interface PendingTrickCompletion {
  move: BatakMove; // the {type:'play', cardId} move that completes the trick
  playerId: PlayerId;
  card: Card;
}
```

On any `{type:'play'}` move: if `state.currentTrick.length === 3` (this play will be the 4th), render the card immediately in its seat's trick slot via local state, then `setTimeout(() => performMove(move), 1100)` before actually committing — matching the reasoning in the Context section above (the engine has no intermediate "trick complete, not yet swept" state, so the UI must stage it). Every other move (bid, pass, selectTrump, and the first 3 plays of a trick) commits via `performMove` directly with no staging, since engine state already reflects them visibly with nothing to bridge. While a trick-completing move is pending, the human's hand (if they're not the one who just played) and re-tapping are disabled the same way Pişti's `isHumanInteractive` guards against a double-play during its own reveal window.

## 5. Results & Testing

- **`GameResultModal`** reused completely unmodified — `batakDescriptor.ruleEngine.calculateScore`/`determineWinner` already produce the exact `ScoreBoard`/`PlayerId[]` shapes it expects; no `teams` prop is passed (not applicable, no partner mode this pass). Shown when `batakDescriptor.ruleEngine.gameOver(state)` (i.e. `phase === 'finished'`, all 13 tricks resolved).
- **"Play Again"** re-runs the exact same `setup` → `createGameSessionStore` sequence as starting fresh — a single hand is "a game" for this scope (multi-hand match play is explicitly deferred, see Out of Scope).
- **Player names:** a fixed constant, `{ human: 'You', 'ai-1': 'AI 1', 'ai-2': 'AI 2', 'ai-3': 'AI 3' }` — Batak's setup is always exactly this shape (no single-opponent or team case to branch on, unlike Pişti's `buildPlayerNames`).
- **Testing:** no new tests for `BatakScreen.tsx`/`BatakTable.tsx`/`BatakSetupView.tsx`, per the standing policy. The `seating.ts` extraction re-runs Pişti's existing test suite (`PistiTable.test.tsx` and any others exercising the moved functions) to confirm the pure move introduced no regression.

## Out of Scope (Deferred to Later Sub-Projects)

- Reanimated / animated card-travel motion (hand-to-trick-slot lift, pile sweep) — own follow-up pass once this screen is built and reviewed, matching Pişti's own polish sequence (build the playable slice first, animate later).
- Save/resume via `PersistenceAdapter`; `stats:<gameId>` recording.
- The 3-player ("gömmeli") and "eşli" (partnered) variants.
- Multi-hand match play, cumulative target score, the bid-13 ("Draw") instant-match-win rule.
- Human-vs-human pass-and-play.
- The Alper-Games-reference visual polish checklist that Pişti went through (felt texture, card back, wood corners, avatars are already "free" here via the shared `packages/ui` components; Batak-specific new visual surfaces — bid buttons, the trump suit picker, trick slots — get plain functional styling in this pass, not a dedicated reference-matching treatment).
- On-device frame-timing profiling (standing Phase 1 risk note, still open).

## Next Step

Invoke `writing-plans` to turn this into a concrete implementation plan (file list, task breakdown).
