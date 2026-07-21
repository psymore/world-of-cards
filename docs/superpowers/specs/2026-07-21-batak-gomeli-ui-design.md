# Batak Gömmeli Mobile UI — Design

## Context

3-player "gömmeli" (buried-kitty) Batak is fully implemented at the engine level — rules, state model, `RuleEngine`, and all three AI difficulties (Easy/Medium/Hard) already handle it correctly, including the `'kitty-exchange'` phase (see `docs/superpowers/specs/2026-07-15-batak-gomeli-rules-and-state-design.md`, `docs/superpowers/specs/2026-07-15-batak-gomeli-rule-engine-design.md`, `docs/superpowers/specs/2026-07-20-batak-gomeli-ai-strategies-design.md`). It is **not reachable from the mobile app**: the setup screen only offers the existing 4-player game, and the table UI has no rendering at all for the `'kitty-exchange'` phase. This sub-project builds that UI, making 3-player gömmeli genuinely playable by a human end-to-end.

Gömmeli is a mode toggle on the same registered `'batak'` game, not a new registry entry — mirroring how Pişti's 2-player/4-player choice works.

## Scope

In scope: setup-screen variant picker, seating for 2 AI opponents, the full kitty-exchange phase UI (permanent kitty pile, staged bury-then-reveal sequence, the bury-slots card-placement interaction), and the mechanical engine/registry plumbing needed to reach any of it.

Explicitly out of scope (do not expand into these during implementation):
- The Batak bidding-AI miscalibration (Medium/Hard overbidding relative to what they can make) — pre-existing, separately tracked (see `[[project_batak_bidding_ai_too_aggressive]]` memory), unaffected by this work.
- The eşli (partnered) 4-player variant — untouched.
- Native on-device visual verification — standing gap across all prior Batak/Pişti UI work (browser/Playwright only), unchanged here.
- New automated UI tests — per the standing 2026-07-07 testing policy, default to none; flag for an explicit ask before implementation if a specific piece (e.g. the new seating branch, or the new `useBurySlots` hook) seems to warrant an exception.

## Architecture

### 1. Variant selection & setup flow

`BatakSetupView` (`apps/mobile/src/games/batak/BatakSetupView.tsx`) gains a **variant picker** — "Standard" vs. "Gömmeli" — presented separately from the existing difficulty picker (not folded into a single combined control). Picking Gömmeli means 3 total players; no separate player-count control is needed since 3-player always implies gömmeli rules (there is no other 3-player variant).

`BatakScreen` (`apps/mobile/src/games/batak/BatakScreen.tsx`) changes:
- `AI_IDS`/`PLAYER_NAMES` become variant-dependent: `['ai-1', 'ai-2']` for Gömmeli vs. the existing `['ai-1', 'ai-2', 'ai-3']` for Standard.
- `setup()` is called with the resulting `players` array — the engine already derives every gömmeli-specific rule (hand size, bid range, kitty size, bust threshold) purely from `players.length` via `ruleConstants`, so no other setup-option changes are needed.
- The hardcoded `isTrickCompleting = state.currentTrick.length === 3` (`BatakScreen.tsx:121`) becomes `state.currentTrick.length === state.players.length - 1`. This was a latent bug waiting for any non-4-player mode; fixing it is required for gömmeli's 3-card tricks to complete correctly, and is a pure generalization with no effect on the existing 4-player path (`4 - 1 === 3`, unchanged).
- `guaranteeStrongHand: difficulty === 'easy'` is unchanged (already player-count-agnostic, previously verified by code trace for 16-card hands).

Registry (`packages/engine/src/games/batak/index.ts`): `batakDescriptor.minPlayers`/`maxPlayers` change from the hardcoded `4`/`4` to `3`/`4`.

### 2. Seating for 2 AI opponents

`assignSeats` (`apps/mobile/src/table/seating.ts`) gains a new branch for exactly 2 opponents, seating them **left and right** (human at bottom, nobody "across") — a symmetric 3-handed layout, distinct from the existing 3-opponent (Pişti 4-player) branch and the generic fallback, neither of which change.

No new opponent-rendering work is needed: since the 2026-07-18 turn-indicator-simplification pass, Batak's opponent seats already render only a name badge (no per-card face-down stack). This also means hiding the AI bidder's actual bury choice from the human is free by construction — there was never a per-card opponent-hand visual to hide in the first place.

Hand layout for 16-card (steady state) and the transient 20-card (mid kitty-exchange, before burying) hands needs no new code: `splitTwoRows(count) = [ceil(count/2), count - ceil(count/2)]` and `fillWidthMarginPx` are already fully general formulas (not hardcoded to 13), confirmed by reading `apps/mobile/src/table/seating.ts:67-91` directly. They will produce `[8,8]` for 16 and `[10,10]` for the transient 20-card hand automatically.

### 3. The permanent kitty pile

`setup()` already deals `kittySize` (4) real cards into a genuine `'kitty'` table zone as part of the initial deal (`packages/engine/src/games/batak/rules.ts:52,180`), before bidding even starts. This zone sits untouched through bidding and trump-selection. The UI renders `state.table.zones['kitty'].cards` face-down at the vacant top-center table slot (vacant because the 2 gömmeli opponents sit left/right, per Section 2) from deal onward — real engine data, not a placeholder, and no staging needed for this part since the zone's contents don't change until trump is selected.

### 4. Kitty-exchange phase — staged bury-then-reveal sequence

The engine's real move order is unchanged and is not what the UI narrates directly:
- `selectTrump` atomically merges the kitty into the bidder's hand (16 → 20 cards) and empties the `'kitty'` table zone, in one state transition, entering `'kitty-exchange'`.
- `bury` atomically moves the bidder's chosen 4 cards to the `'buried'` zone and advances to `'playing'`.

Per your explicit direction, the UI presents a different *visual* order — bury first, then reveal the original kitty, then pick it up — matching how it would feel at a physical table. This is achieved entirely through UI-side staging (the same category of technique already used elsewhere in this codebase for the trick-completion pause and Pişti's reveal-then-commit human plays), with **no reordering of the underlying engine calls**:

1. The instant `state.phase` becomes `'kitty-exchange'`, the UI captures a local snapshot of the 4 real kitty `Card` objects (read from the `'kitty'` zone's contents on the immediately preceding render, before the transition emptied it) plus the bidder's identity. This snapshot is what lets the pile keep rendering unchanged through the staged sequence even though the real zone is now empty.
2. A status message renders per bidder: **"Choose four cards to bury."** for a human bidder, **"AI is choosing four cards to bury..."** for an AI bidder.
3. **Human bidder — bury-slots interaction** (see Section 5 for the component/hook pairing): four empty, semi-transparent placeholder slots render in the center of the screen from the moment kitty-exchange begins. Tapping a card in hand animates it into the first open slot (hand repositions/rebalances around the now-smaller set, using the existing per-hand-size layout formulas from Section 2). Tapping a card already in a slot animates it back to its correct place in the hand. The **Confirm** button enables the instant a 4th card lands in a slot, disabled otherwise. Pressing Confirm does **not** immediately call `onMove` — it starts the staged animation below.
4. **AI bidder:** the AI's already-implemented `chooseMove` for `'kitty-exchange'` (Easy/Medium/Hard all handle this phase, per the merged AI-strategies sub-project) supplies its chosen 4 cards; there is no slot UI for the AI (nothing to tap), but the same staged sequence below runs using its choice, paced by the existing AI "thinking delay" convention (`useAITurn`), so the human watching sees the identical pacing regardless of who's bidding.
5. **Staged animation**, run identically for both bidder types:
   a. The 4 chosen (about-to-be-buried) cards animate face-down toward the kitty-pile spot — for the human bidder this is the 4 cards already sitting in the bury slots; for an AI bidder this is its computed choice, staged the same way. They land as a separate pile that will remain permanently hidden.
   b. Immediately afterward, the snapshotted *original* kitty cards flip face-up, revealed to **every** player (not just the bidder) — held visible for **~3.5 seconds** (bump to 4s if 3.5 reads as too short once it's actually running).
   c. After the hold, those revealed cards join the bidder's hand. For a human bidder, use whichever concrete technique (individual per-card travel into the hand's layout, a brief hand collapse/re-fan, replaying the existing deal-entrance fan-opening motion, or another approach) produces the smoothest result once tried against the running app — this is a deliberate implementation-time visual-quality call, not fixed in this spec. For an AI bidder this step has no visible per-card motion (opponent hands render only a badge, per Section 2), so the pile can move directly out of view for that case.
   d. Only once this sequence completes does the UI call `onMove({ type: 'bury', cardIds })`, committing to the engine (which instantly reflects `phase: 'playing'` and the true 16-card hand).
6. Rendering catches up to true engine state once the sequence completes; no further staging is needed for the resulting trick play, which proceeds exactly like today's 4-player trick play. The permanently-buried pile from step 5a is not rendered once the sequence completes — those 4 cards have no further gameplay relevance and the vacant top slot simply goes empty for the remainder of the hand, matching "hidden forever" literally rather than leaving a dead, unexplained face-down stack on the table.

This mirrors the existing precedent of holding a resolved-but-not-yet-rendered engine state behind a UI-only pause, applied to a new phase transition rather than a new engine mechanic.

**Performance requirements for the bury-slots interaction** (explicit, non-functional constraints — not optional polish):
- Slot positions are measured once via `onLayout` and reused for every card's travel-animation target, not recomputed per frame or per tap.
- All card motion (hand↔slot, slot↔pile, pile↔hand) animates only `transform` properties (translate/scale/rotation), matching this codebase's existing `useNativeDriver: true` convention — no layout-triggering property (width/height/margin recalculated per frame) drives the animation itself.
- No unnecessary re-renders: slot state and in-flight-card state should be scoped so that an unrelated re-render of the table (e.g. an opponent's turn elsewhere) doesn't re-run the bury-slot layout math.

### 5. New bury-slots component + hook

The existing `useCardSelection` (`apps/mobile/src/components/useCardSelection.ts`) holds a single `selectedCardId: string | null` and auto-plays the card on a second tap — a fundamentally different contract than "place up to 4 cards into visible slots, then explicitly confirm, with either direction reversible by tapping." Rather than overload it (which would risk changing behavior for every existing tap-to-play consumer in both Pişti and Batak), this adds:
- A new hook — working name `useBurySlots` — holding which card (if any) occupies each of the 4 slot indices, capped at a caller-supplied maximum sourced from `ruleConstants(3).kittySize` rather than a hardcoded literal, with `placeInSlot(cardId)` / `returnToHand(cardId)` / `confirm()` / `clear()` in place of tap-to-auto-play.
- A new presentational component — working name `BurySlots` — rendering the four semi-transparent placeholder slots and whatever card currently occupies each, exposing its own slot layout (measured once, per the performance requirements above) as the animation destination for hand→slot travel and the origin for slot→hand travel.

`useCardSelection` itself is untouched.

## Engine/registry plumbing (mechanical)

- `packages/engine/src/games/batak/index.ts`: add `export { ruleConstants }` (type-only `RuleConstants` export as needed) alongside the existing `export * from './types'` — currently unreachable from the mobile app's `@world-cards/engine/games/batak` subpath, needed for the bid grid, the bury-count cap in `useBurySlots`, and the kitty-pile card count.
- `packages/engine/src/games/batak/index.ts`: `batakDescriptor.minPlayers`/`maxPlayers`: `4`/`4` → `3`/`4`.

## Testing

Per the standing 2026-07-07 testing policy (no new UI tests by default), this sub-project writes none proactively. The one piece with genuine pure-function logic — `assignSeats`' new 2-opponent branch — is a candidate for a unit test given its Pişti/Batak-shared, decision-bearing nature (an incorrect seat assignment would be a real regression across both games), but per policy this will be raised as an explicit ask during implementation rather than assumed.
