# Batak — Decisions

**Owner:** whoever last did substantial work on Batak. **Load:** when asking "why is Batak built this way." **Not** a development diary — see `architecture/phase-2-knowledge-architecture-design.md` §6.1. Implementation history lives in `docs/superpowers/specs/`, `docs/superpowers/plans/`, and git history instead.

---

## Scoped to 4-player individual first, gömmeli and eşli as separate follow-ups

**Decision:** Batak's first vertical slice (rules → engine → AI → UI → tests) covered 4-player individual play only. The 3-player gömmeli (buried-kitty) variant and the 4-player eşli (partnered) variant were deliberately deferred to their own follow-up sub-projects.

**Why:** mirrors how Pişti itself grew incrementally (2p → 4p free-for-all → partner mode) rather than trying to ship all three Batak variants simultaneously.

## Per-seat trick layout was the real first design, not deferred polish

**Decision:** unlike Pişti (which deferred per-seat trick layout as later polish, since it already had a working shared-pile mechanic to retrofit), Batak's per-seat layout — each of the 4 played cards renders near the seat that played it — was built as the actual first design.

**Why:** Batak had no existing shared-pile mechanic, so there was no extra cost to doing it right immediately. Confirmed with the user as a deliberate structural divergence from Pişti's own UI design, not assumed.

## Easy AI never competitively bids; the human always gets a fair contract attempt

**Decision:** Easy-difficulty AI unconditionally returns `pass` during bidding, regardless of hand strength or the current highest bid. Combined with the engine's existing forced-all-pass rule (which assigns the contract to `players[0]` when everyone passes) and the mobile app always seating the human at `players[0]`, the human always ends up as bid winner in an Easy game.

**Why:** makes Easy mode more learnable for beginners — requested directly by the user, not derived from the separate bidding-AI-miscalibration bug (see `known-issues.md`), though it surfaced that bug's severity as a side effect (with Easy AI no longer competing for the bid, Hard AI always ends up with the contract in the benchmark, exposing how often it then fails it).

## Human hand always gets a guaranteed strong deal on Easy

**Decision:** an opt-in `BatakSetupOptions.guaranteeStrongHand` reshuffles (reusing the same seeded RNG, capped at 10,000 attempts) until the human's dealt hand satisfies a hand-strength predicate, rather than constructively building a qualifying hand.

**Why:** reuses all the existing, already-tested dealing code and guarantees the result is still a genuinely possible random deal, rather than introducing a second, unvalidated hand-construction path.

## Gömmeli's blind-bury rule: only original hand cards may be buried, never a kitty card

**Decision:** the bidder's 4 bury cards must come from their original 16-card hand only — a kitty card can never legally be buried, enforced identically for AI bidders and the human.

**Why:** a real rule correction the user asked for after playing the just-shipped gömmeli UI live. `buriableCards(state, playerId)` is the single new source of truth, consumed by `getLegalMoves`/`validateMove` and by all three AI difficulties' bury-selection logic — a kitty-card bury is now rejected even if a future UI bug tried to submit one.

## AI bidder's discarded kitty cards must never flash face-up

**Decision:** the kitty-exchange bury animation branches its rendering on `isHumanBidder` — a human bidder's discarded cards animate face-up (they already saw them in the bury slots), but an AI bidder's discarded cards use a `faceDown`-capable variant of the same animation component.

**Why:** the shared animation component defaults to face-up by design (correct for the human path) — using it unmodified for an AI bidder would have been a real information leak, since the entire point of a hidden bury is that opponents can't see what was discarded. Caught in final whole-branch review, not before.

## Reanimated migration was scoped to evidenced need only, not a wholesale switch

**Decision:** only `games/batak/table/HumanHandFan.tsx` (the one file with a genuine multi-card reflow) and `GatherCard.tsx` (already migrated, kept) moved to `react-native-reanimated`. Every other single-card animated component stays on plain `Animated` indefinitely.

**Why:** full detail and the engine-choice rationale live in `docs/animation/ADR/ADR-003-scope-reanimated-migration-to-evidenced-need.md` — this entry exists so Batak's own decision log doesn't omit the fact, not to duplicate the reasoning. See `docs/domains/mobile-expo/overview.md` for the resulting infra/maintenance-cost note.

## TrickCenter's card-resize sidestep is a deliberate stopgap, not a fix

**Decision:** the traveling card in `TrickCenter.tsx` renders at a constant `size="normal"` for its entire flight to the trick center, rather than actually shrinking smoothly to match the resting trick card's footprint.

**Why:** `PlayingCard`'s `"small"`/`"normal"` variants have independently-tuned internal proportions, not a uniform scale of one another — a naive scale interpolation still landed on a visibly different shape at arrival, reading as an abrupt "settle." The shipped fix sidesteps the mismatch rather than solving it; see `known-issues.md` for the still-open problem this leaves behind.

## Deal sequence: a stylized "scatter" shuffle, not a literal riffle simulation

**Decision:** the deal animation uses a stylized "scatter" shuffle plus a cut, chosen over two other animated mockups (and over literally simulating a riffle/overhand shuffle).

**Why:** chosen directly via the visual-companion brainstorming process rather than assumed. Scoping this feature also surfaced and fixed a real pre-existing gap in the same pass: the human's hand was previously invisible during bidding/trump-selection at all (only rendered once `phase === 'playing'`) — fixing that was what made "reveal trump only after hands are shown" true for free, rather than a separate feature.

## Hand-tuned court-card frame geometry is recorded as ground truth, not re-derivable

**Decision:** `CourtCardFrame`'s `GEOMETRY` constants are documented as visually-verified ground truth, not as the output of a formula — a future session should not "correct" them back to a computed baseline.

**Why:** this followed a real root-cause investigation, not a guess. Two rounds of "still looks off" feedback led to actually measuring real DOM pixel positions via the Playground's card gallery (an explicit, one-off exception to the no-unsolicited-screenshots guardrail, made with the user's consent specifically for this diagnosis) — which found a genuine bug: the frame's SVG assumed a coordinate canvas equal to the card's full outer size, but it actually renders inside a content box 4px shorter (two 1px border rings), producing a consistent measurable offset. Once the height constant was corrected and verified against the real measured midpoint, the user then hand-tuned all four bracket paths and stroke widths against a live render for the final look — so the current values are deliberately not re-derived from the (now-corrected) formula alone.

## Spade/club redesign: reverted to the first candidate shown

**Decision:** `SuitIcon`'s spade/club shapes ended up as the very first candidate shown during visual-companion iteration, after several more elaborate alternatives (a wider base, a longer wing-flare stem, a shape traced pixel-for-pixel from a user-supplied paint sketch) were tried and rejected.

**Why:** recorded specifically so a future session doesn't retread the same rejected alternatives from scratch. This is a shared `packages/ui` component, so the outcome applies to both Pişti and Batak (and `apps/playground`) — recorded here because the redesign was done in the context of Batak-era card-face polish work; see `docs/domains/games/pisti/decisions.md` for the equivalent Pişti-side card-art decisions this sits alongside.

## Batak's turn indicator was simplified to the badge alone, Pişti explicitly out of scope

**Decision:** removed the gold `activeArea` background wash and the face-down opponent hand-card stacks from Batak's table entirely; the pre-existing glowing green `PlayerBadge` (already driven by the same `isCurrentTurn`/`isHumanTurn` booleans) is now Batak's sole turn indicator.

**Why:** a deliberate simplification scoped to Batak only — Pişti's own turn-indicator treatment (gold wash + badge glow together, see `docs/domains/games/pisti/decisions.md`) was left untouched, consistent with the standing rule that a per-game visual change is a discussion trigger, not something to auto-mirror across games.

## Selected card renders in front via a shrunk touch target, not a z-order trick

**Decision:** the selected card now renders in front of every other card in the hand (previously it deliberately rendered *behind*, as a workaround for a stray-tap bug). Made safe via a new `hitSlop` prop that shrinks only the selected card's touchable bounds, not by moving it in z-order.

**Why:** reverses an earlier session's tradeoff once a better-targeted fix was available — the earlier z-order workaround traded away the natural "lifting toward the camera" read of a selection to avoid stray taps; shrinking the touch target instead keeps both the correct stacking and the stray-tap fix.

## Human hand's flatten/width-fill parameters default to Pişti's original behavior

**Decision:** `fanRotationDeg`/`fanCurveY` gained optional `degreesPerStep`/`curveMultiplier` parameters (used by Batak's flatter human hand), defaulted to the original constants so Pişti and Batak's AI-2 seat stay byte-identical unless explicitly overridden.

**Why:** lets Batak's human-hand layout diverge from Pişti's without risk of silently changing Pişti's own, already-shipped fan geometry — an explicit opt-in rather than a shared default that could drift.

## The "Dim Unplayable Cards" setting is global, but its gear button is Batak-only for now

**Decision:** `dimUnplayableCards` lives in the shared global `settingsStore`, but the gear/settings button that reaches it was only wired into Batak's `GameScreenLayout` (via an opt-in `onSettingsPress` prop) — Pişti's screen doesn't pass it.

**Why:** scoped to ship the setting where it was needed first (Batak's mandatory-suit-following legality is where "dim illegal cards" actually matters); the resulting asymmetry (toggling it off in Batak also silently affects Pişti's rendering, with no way to restore it from Pişti) was accepted as a known, not-yet-resolved gap rather than solved as part of this pass — see `known-issues.md`.

## Gömmeli's Hard AI bury search uses a dedicated `trickMarginEvaluate`, not the shared `calculateScore`

**Decision:** Hard AI's bury-selection minimax search (over the top 8 `scoreHandForBury`-ranked candidates) uses a purpose-built `trickMarginEvaluate` (raw `tricksWon` difference) instead of reusing the card-play search's `calculateScore`-based evaluate function. Its `maxDepth` is `4`, not the original design spec's `3`.

**Why:** both corrections were caught by tracing the real `minimaxChooseMove` code during planning, not left as originally written. `calculateScore` couldn't be reused because after only 1 simulated trick its bust-threshold quantization gives identical values for every bury candidate — no signal to compare by. `maxDepth` needed to be `4` because the bury is the top-level move being searched here, not a trick-play, so a full 3-player trick (3 plies) needs to fit inside `maxDepth - 1`. Both corrections were independently re-derived by two separate reviewers against the engine's actual ply-accounting, not just asserted.

## Wood edge rails were added Batak-only, not mirrored to Pişti

**Decision:** straight wood-textured edge rails along all 4 table edges (`packages/ui/src/TableEdgeRails.tsx`) were added to Batak's table, matching the existing corner-wedge gradient/grain/trim recipe, without adding them to Pişti's table.

**Why:** per the standing cross-app visual-change guardrail, whether Pişti should get the same treatment was explicitly raised with the user, who chose not to mirror it — a deliberate "raise it, don't auto-mirror it" outcome, not an oversight.

## Opponent hand spacing reuses the human hand's own auto-fit formula

**Decision:** opponent hands (top single-seat row, left/right side stacks) now use the same `fillWidthMarginPx`-based auto-fit spacing formula originally built for the human hand's width-fill, measured via `onLayout`, instead of static per-game-tuned overlap percentages. Rotation/curve was dropped entirely for opponent seats.

**Why:** one continuous formula spreads a small opponent hand (Pişti's max-4 cards) into a clean evenly-gapped row and compresses a large one (Batak's 13-card start) into tight overlap automatically, replacing two separate hand-tuned constants with one shared rule. This was implemented independently for each game's own table file (by two separate task-implementers), and both converged on identical prop names/types with no unexplained drift — see `docs/domains/games/pisti/decisions.md` for the equivalent note on the Pişti side, since this is one shared decision applied to both games' tables, not two independent ones.

## Hand frame is a stretched photo overlay, height-only, peak-aligned to the hand's own curve

**Decision:** `HandFrame` renders a wooden-frame photo behind Batak's two-row hand, peak-aligned to the top row's own curved peak (`fanCurveY`) with a reveal margin so the gold trim clears the cards, height-stretched (`resizeMode="stretch"`, width never touched) to reach the true screen bottom.

**Why:** went through several real, sequential asset problems (a flat JPEG with a checkerboard baked in as opaque pixels rather than real alpha; a mockup built to illustrative rather than Batak's real proportions, which masked a genuine "asset not tall enough" shortfall) before landing on stretching height only — each caught by measuring real pixel/alpha data or actual device dimensions rather than eyeballing. `TableFelt` was also switched from a hand-drawn SVG weave to a `green.png` photo at the same time, applied to both Pişti and Batak per explicit direction ("green.png for all tables") — the one piece of this pass that *was* deliberately shared across games, unlike the frame itself which stayed Batak-only.
