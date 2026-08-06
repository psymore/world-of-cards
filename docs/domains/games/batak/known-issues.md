# Batak — Known Issues

**Owner:** whoever finds/confirms an issue here. **Load:** starting new Batak work. Entries are deleted, not marked "done," once fixed.

---

### Bidding AI miscalibration

Medium/Hard bidding AI bids too aggressively relative to what it can actually make. Empirically confirmed, not just anecdotal: in the 4-player individual variant, Hard AI's win rate against 3×Easy dropped to 49/200 (24.5%) — statistically indistinguishable from the ~25% pure-chance baseline — once Easy AI stopped competing for the bid (a separate, deliberate change), meaning Hard AI wins the contract almost every hand and then fails it often enough that its net score is no better than chance. In 3-player gömmeli, the same unmodified heuristic performs meaningfully better: Hard AI beat 2×Easy in 136/200 games (68%), well above the ~33% chance baseline. The bug's severity is not uniform across variants — a 4-player fix should not be assumed to generalize cleanly to gömmeli, and vice versa.

Likely starting point: `estimateBidDecision`/the shared hand-strength heuristic in `packages/engine/src/games/batak/ai/handStrength.ts` (shared by Medium and Hard, both variants). Possible causes, not yet investigated: overweighting honor cards relative to suit length/distribution, not accounting for the mandatory-raise rule's cost, or never having been validated against actual bid-fulfillment rate (only win rate was checked during the original AI sub-project). `packages/engine/src/games/batak/simulate.test.ts`'s Hard-vs-Easy assertion was deliberately coarsened from `hardWins > 70` to `hardWins > 30` (a "hasn't collapsed" floor, not a quality bar) pending this fix — restore it toward `> 70` once resolved.

### Trick-center resize — shipped, not yet on-device-verified

The trick-center resize is **implemented**, replacing the earlier "hold the card at full `size="normal"` for the whole flight" workaround. Cards now genuinely shrink to a smaller trick footprint, in flight and at rest: `PlayingCard.contentScale` (new, `packages/ui`) independently compensates the corner index and suit watermark, `BatakHandCard`'s local-departure leg does the shrink for a human play, and `apps/mobile/src/games/batak/table/trickCardScale.ts` is the single source for all three constants. The card never switches between `PlayingCard`'s `"small"`/`"normal"` variants — it stays `"normal"` and is uniformly scaled — which is what avoids the non-linear-proportions pop the old workaround existed to dodge. See `docs/superpowers/specs/2026-08-05-batak-trick-resize-design.md`.

An AI card's `TravelCard` no longer interpolates scale across its flight. The original first pass used `originScale={1}` (see `docs/animation/audits/BatakTrickResize-Audit.md`'s "Re-activating `TravelCard`'s scale interpolation" findings, which flagged this specifically for on-device confirmation given `TravelCard` scale-interpolation's prior revert history); `TrickCenter.tsx` now passes `originScale={TRICK_CARD_SCALE}` (equal to `restScale`) for AI plays too, so the card arrives at the trick already at its resting size — same as a human play, which holds scale constant after its own local-departure leg does the shrink.

What's still open (all named in `docs/animation/audits/BatakTrickResize-Audit.md`, none of them a return to the old workaround):

- **Not yet verified on-device.** The audit's Approval is Pending on the user's own device pass; its Conditions list is the checklist.
- **`contentScale` is discontinuous at the local-departure→`TravelCard` handoff.** `BatakHandCard` renders its departing card without `contentScale`, so the corner-index/watermark compensation switches on abruptly at handoff while the card body's own scale stays continuous — a small instance of the same "landing pop" class this feature exists to remove, on a different channel. Documented inline in `trickCardScale.ts`. Deliberately not fixed first-pass: pushing `contentScale` into `BatakHandCard` just relocates the jump to departure-start, and a genuinely continuous version needs a fifth shared value threaded through `useBatakCardMotion` across a component boundary.
- **`LOCAL_DEPARTURE_SCALE`'s split is an unconfirmed tuning choice.** 100% of the shrink currently happens during the ~200ms local-departure leg, with `TravelCard` holding scale constant for the rest of a human play. Whether to spread more of it into the flight instead was flagged as unsettled at design time, not decided — retune toward `1` if the local-departure window reads as abrupt live.

### Human-hand travel-origin gap

The human hand's card-travel origin is a fixed generic offset (`resolveRevealOrigin`/`revealOriginOffset` in `apps/mobile/src/table/seating.ts` always resolves the human's own plays to a single `{x:0, y:195}` "bottom" vector), not the specific hand card's real position. Reads fine for opponents (no per-card visual exists for them since the turn-indicator simplification removed the face-down opponent card stacks), but is visibly wrong for the human's own hand, where the player has a precise expectation of which card should move from where.

Not yet decided or spec'd. Three approaches were discussed: (A) compute the origin analytically from the same deterministic layout formulas already used to render the hand (cheap, but the destination sits inside a `flex: 1` region whose real height is fragile to compute exactly without measuring); (B) measure both ends for real via `measureInWindow` (robust, more plumbing); (C) a hybrid — cache the trick center's destination position once via `onLayout`, measure only the played card's real position live at tap time. Leaning toward (C), but unconfirmed.

### Reduced-motion timing gap

`GatherCard` instances jump `progress` to 1 instantly when `useReducedMotion()` is true (cards vanish right away), but `BatakScreen.tsx`'s `gatherTimeoutRef` still waits the full `CARD_TRAVEL_DURATION_MS` (530ms) before calling `performMove` and incrementing the winner's tricks-won badge. Net effect: reduced-motion users see the 4 cards vanish, then ~530ms of an empty trick center, then the badge ticks up. Fix if picked up: when `reducedMotion` is true, commit immediately instead of arming the full-duration timer.

### Under-commented non-null assertions

`BatakScreen.tsx`'s trick-completing snapshot block (inside `commitMove`) uses several non-null assertions (`...find(...)!`, `state.trumpSuit!`) that are safe by the pre-commit-state invariant (3 prior cards guaranteed present in the trick zone; `trumpSuit` always set during the playing phase) but are load-bearing and not explained inline. A one-line comment noting they rely on `state` being the pre-4th-play snapshot would help a future reader.
