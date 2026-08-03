# Pişti — Decisions

**Owner:** whoever last did substantial work on Pişti. **Load:** when asking "why is Pişti built this way." **Not** a development diary — see `architecture/phase-2-knowledge-architecture-design.md` §6.1. Implementation history lives in `docs/superpowers/specs/`, `docs/superpowers/plans/`, and git history instead.

---

## AI was built before the UI

**Decision:** Pişti's Easy/Medium/Hard AI strategies were implemented before any mobile UI existed.

**Why:** `simulateGames`-based testing and `registerGame` both require `aiStrategies` to exist — building AI first unlocked both earlier in the project, rather than waiting until the UI sub-project to prove out the shared engine contracts.

## AI moves commit through a reveal beat, not instantly

**Decision:** an AI's chosen move is shown highlighted in the pile for a short "reveal" period before it's committed to state, implemented via a nested `setTimeout` inside `PistiScreen`, not a second effect-scheduled timer.

**Why:** without this, the opponent's move was invisible — the pile just changed with no visible cause. The nested-timeout approach was chosen specifically because a second effect-scheduled timer broke under fake timers in tests, while a nested timeout inside the existing move-handling flow didn't. This same reveal-then-commit pattern was later mirrored for the human player's own plays (previously only AI plays triggered it), rather than inventing a second mechanism for the human path.

## Alper Games' Batak HD was adopted as the explicit visual reference for the table

**Decision:** Pişti's table redesign targeted Alper Games' Batak HD / Spades Batak apps as its visual bar, via a ranked checklist (cheapest → biggest lift): card center art, felt texture/vignette, active-turn badge glow, card back pattern, wood-grain table frame, per-seat avatars, per-seat trick layout.

**Why:** the user wanted Pişti to reach the same visual bar as established commercial Turkish card-game apps, not just be internally consistent. Explicitly out of scope: coin/stake badges, chat/emote, and the suit-selector bidding UI — all tied to Batak features (wagering, human social play, trump bidding) that Pişti doesn't have.

## Tap-to-select-then-tap-to-play was built as a shared, reusable interaction primitive

**Decision:** card selection (`useCardSelection`, a selection state machine) and the lift/highlight animation (`SelectableCard`) were built as two new reusable pieces in `apps/mobile/src/components/`, not as Pişti-local hand-interaction code.

**Why:** intended for reuse by every future game's hand UI, not just Pişti's — the same reasoning already applied to `PlayingCard`/`GameScreenLayout`/`GameResultModal` as shared, game-agnostic pieces from the start of the UI sub-project.

## Card center art: hand-authored SVG shapes, not pip layouts or illustrated portraits

**Decision:** `SuitIcon.tsx` uses simple hand-authored SVG suit shapes, reused for both the corner index and a low-opacity centered watermark, with the same treatment for every rank (no per-rank pip counting).

**Why:** `PlayingCard` renders far too small (56×80px, 36×52px at small size) for traditional pip layouts (would read as clutter) or illustrated court-card portraits (would blur). Enlarging the existing Unicode suit glyphs was also rejected — Unicode glyph rendering is inconsistent across platforms/fonts, a correctness risk, not just a style one. Illustrated court-card art was deliberately deferred as a separate, bigger future investment, not a natural next increment on this component.

## "Per-seat trick layout" was reinterpreted as a motion cue, not a layout rebuild

**Decision:** rather than rebuilding Pişti's single shared discard pile into per-seat trick piles (the literal Batak-style interpretation of the reference checklist's last item), the played card instead visually travels in from the direction of whichever seat played it, landing at the same shared pile.

**Why:** Pişti's fishing mechanic has one shared pile, not one pile per player — a literal per-seat rebuild doesn't fit the game's actual rules. This scope-down was made via an explicit clarifying question to the user, not assumed.

## Avatar glyph and placement were each a deliberate choice among named alternatives

**Decision:** `PlayerAvatar` uses a generic silhouette icon (not a `SuitIcon`-monogram or an initial-letter monogram), merged inline into the existing badge pill (not stacked above it), with a gold ring marking the human seat only.

**Why:** silhouette was chosen as the literal match to the Alper Games reference. Inline placement, specifically, was chosen because a stacked layout doesn't fit the 4-player mode's 64dp side-seat width budget — confirmed via visual verification, which caught a real regression mid-task (the avatar wrapped badge text onto 5 broken lines in that layout) fixed with a `size?: 'normal' | 'small'` prop rather than reworking placement again. This is a deliberate, surfaced deviation from the original plan's "identical avatar size across every seat type" constraint — shown to the user as a concrete before/after tradeoff, who chose to keep per-seat sizing over forcing one size everywhere.

## Seating math got one shared source of truth after a real duplicated-invariant bug

**Decision:** `PARTNER_SEAT_INDEX` (a constant in `pistiSeating.ts`) is the single place that encodes "the partner sits at the second AI seat in turn order" — `PistiScreen.tsx`'s team/name-building logic reads this constant rather than re-encoding the same assumption itself.

**Why:** before this fix, `PistiScreen.tsx` hardcoded `aiIds[1]` as "the partner" based on nothing but a *comment* pointing at `PistiTable.assignSeats` in a different file — two places encoding one invariant with no shared source of truth, a real bug risk caught by review rather than by a test failure. Worth remembering as a general pattern: when a UI-layer assumption (like seat order) mirrors an invariant that a different file actually owns, prefer reading a shared constant over re-deriving or re-asserting the same assumption a second time.

## Four-player mode was a real N-player generalization, not a hardcoded branch

**Decision:** `PistiSetupOptions.players` became `PlayerId[]` (was a 2-tuple); `setup`/redeal/`calculateScore` all generalized to operate over any number of players.

**Why:** confirmed deliberately rather than building a special-cased 4-player branch, so the same code path serves 2p and 4p without duplication. All three AI strategies needed zero changes as a result — they already operated generically over `state.players`, including Hard AI's minimax `evaluate` (which already summed all opponents' scores, not "the" opponent).

## Partner mode: partner is always the AI seat across the table

**Decision:** in 4-player partner mode, the human's partner is always whichever AI seat sits directly across the table (the second seat in turn order) — not a user-selectable choice.

**Why:** geometrically unambiguous since there's only ever one human seat. `calculateScore` was refactored around a "scoring unit" concept (a team's pooled members, or a lone player in free-for-all) so both modes share one code path — free-for-all reduces to exactly the old per-player math, verified against every pre-existing test passing untouched.

## Tie detection counts distinct teams, not raw winner count

**Decision:** `GameResultModal`'s "is this a tie" check counts distinct teams among the winners, not the raw number of winning players.

**Why:** the original check (`winners.length > 1`) was a real correctness trap in partner mode — a clean team win naturally produces 2 winners (both teammates share the pooled score), which would have wrongly shown "It's a tie!" instead of "You win!". Counting distinct teams instead means free-for-all (where every winner is its own "team") keeps its prior, correct behavior unchanged.

## Felt texture and the active-turn glow are separate signals, not one combined effect

**Decision:** the table's felt texture (a static `FeltTexture` overlay: SVG `Pattern` diagonal-diamond weave + `RadialGradient` vignette, painted once, never re-rendered by game state) and the active-turn indicator (a dedicated pill-shaped `badge` around each player's name, with `badgeActive` adding a green border + glow) were built as two independent pieces, rather than folding the turn indicator into the pre-existing whole-area gold "tappable" wash.

**Why:** the existing gold wash already meant "these cards are tappable" and was kept as-is for that affordance; a separate, clearly distinguishable green glow was needed specifically to answer "whose turn is it," so the two signals wouldn't be conflated into one ambiguous highlight.

## Card back pattern uses the app's own navy/gold identity, not the reference's red rosette

**Decision:** `CardBackPattern` recolors the card back to a deep navy with a gold diagonal-diamond lattice, a thin inset gold frame, and a plain gold lozenge emblem — not a literal port of the Alper Games reference's red rosette.

**Why:** importing another app's brand color was rejected in favor of the project's own established navy/gold identity. The emblem is a simple geometric shape rather than per-suit/per-rank detail, for the same reason as the card-center-art decision: an ornate design would blur at this component's actual ~36–56px render size.

## SVG additions were assessed for performance, then actually memoized, not just reassured about

**Decision:** in response to a direct concern that `PlayingCard`/`PistiTable` are shared across every future game, `SuitIcon`, `CardBackPattern`, `PlayingCard` itself, and `FeltTexture` were wrapped in `React.memo`, on top of an architectural (not measured) cost assessment.

**Why:** the assessment alone (native vector draws, no images/network, only ~25–30 small SVG instances even at 4 players) was disclosed as reasoning, not a measurement, since no device profiling was available. The memoization was a concrete follow-up action rather than resting on reassurance — and it's a genuine win, not a no-op, because the engine reuses `Card` object references across zone-array rebuilds rather than deep-cloning them, so `PlayingCard`'s memo on the `card` prop actually skips re-render work for untouched cards.

## `TableFelt` was extracted immediately, as a deliberate exception to "wait for a second consumer"

**Decision:** during a `/simplify`-style cleanup pass, `FeltTexture` was promoted out of `PistiTable.tsx` into a shared, zero-prop `TableFelt.tsx` component immediately — not deferred until a second game actually needed it.

**Why:** this is an explicit, narrow exception to the project's usual default of not building a shared abstraction before a second consumer exists. The exception applies specifically because the component was already maximally generic (zero props, Pişti-agnostic) and felt tables are near-universal across the games still on the roadmap — extracting immediately was judged to beat guaranteeing a future copy-paste. This is a precedent for *when* the general default may be set aside, not a license to extract early as a matter of course.

## Opponent hand spacing reuses the human hand's own auto-fit formula

**Decision:** Pişti's opponent hands (the top single-seat row, left/right side stacks) use the same `fillWidthMarginPx`-based auto-fit spacing formula originally built for the human hand's width-fill, measured via `onLayout`, replacing static per-seat overlap percentages and rotation/curve. This is one shared decision applied to both Pişti and Batak's tables (implemented independently in each game's own table file, converging on identical prop names/types) — see `docs/domains/games/batak/decisions.md` for the fuller "why," recorded there since it's a Batak-era card-layout-and-typography-polish pass.

**Why (Pişti-specific detail):** one continuous formula spreads Pişti's small opponent hands (max 4 cards) into a clean evenly-gapped row automatically, without needing a separate hand-tuned constant the way the pre-existing static overlap percentage did.
