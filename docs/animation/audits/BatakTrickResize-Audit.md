# Architecture Audit: Batak Trick-Center Card Resize

**Used per:** `../AnimationReviewWorkflow.md` §2 (Architecture Audit) and §4 (Implementation Approval Process). Filled in retroactively against the actual landed diff (Tasks 1–6 of `docs/superpowers/plans/2026-08-05-batak-trick-resize.md`, commits `6b62634`..`4d77e40` on `feature/batak-hand-fan-demo08-migration`), the same shape as `BatakHandFan-Demo08Migration-Audit.md`. Doubles as the Regression Review artifact (`AnimationReviewWorkflow.md` §7) for this same diff.

*Template used: full `AuditTemplate.md`. `QuickAuditTemplate.md` was checked first, per direct user instruction — its Eligibility checklist did not clearly pass (see "Quick Audit Eligibility — why this escalated" below), so per that template's own rule ("If any box is unchecked: stop. Use `AuditTemplate.md` instead") this audit uses the full template. The user was given the eligibility reasoning and explicitly chose to proceed with the full template rather than a narrower re-scoping.*

---

**Feature Name:** Batak trick-center card resize — shrink trick-center cards (in flight and resting) from in-hand ("normal") size to a smaller, constant trick footprint, instead of holding them at full size for the entire flight.

**Objective:** Replace the previous workaround — `TrickCenter`'s traveling card frozen at `size="normal"` for its whole flight because `PlayingCard`'s `"small"`/`"normal"` variants aren't uniform scales of one another (Constitution §8 gap 2) — with a mechanism that actually shrinks the card, coordinated with its own travel, without reproducing the landing-moment "pop" that mismatch originally caused.

**Constitution References:** §5.I (Layered Ownership), §5.II (SSOT), §5.III (Explicit Contracts — the size-variant non-linearity itself), §5.VI (Coordinated Property Timelines — the primary principle this work is exercising), §5.IV (trivial, see Layer 2 row below), §8 gap 2 (this change is a direct attempt at a working reference implementation for the gap that principle names).

---

## Quick Audit Eligibility — why this escalated

Evaluated first, per standing project convention (`[[feedback_ask_audit_template_choice]]`) not to self-select a template, and because the change was plausibly small enough to qualify. Full box-by-box reasoning:

| Box | Result | Why |
|---|---|---|
| Touches exactly one Constitution §4 layer | **Fails** | Spans Layer 5/Rendering (`PlayingCard.contentScale` — new composable transform capability on `CornerIndex`/`CenterArt`) and Layer 4/Execution (`BatakHandCard`'s motion primitive, `TravelCard`'s interpolation, `GatherCard`'s animated style), and arguably Layer 3/Planning (`trickCardScale.ts`'s constants deciding transition end-states). See Proposed Ownership and Layer Responsibilities below for the same breakdown in the full-template's own vocabulary. |
| Adds no new Layout Engine geometry/coordinate math (§5.IV) | Passes | `TRICK_SLOT_OFFSETS`'s scaling is static, non-animated arithmetic — see Layer 2 row below. |
| Does not change how multiple properties are coordinated (§5.VI) | Passes | Both scale-adding call sites (`BatakHandCard`'s `motion.setTarget`, `TrickCenter`'s `TravelCard` usage) were *already* multi-property coordination points before this diff; this work populates an already-coordinated `scale` channel with real values rather than building new coordination. See §5.VI Findings below — this holds up as a real finding, not just eligibility trivia. |
| Adds/changes no interactive element's hit behavior (§5.VII) | Passes | No gesture/hit-testing code touched. |
| Is tuning of already-shipped/audited behavior, not a new mechanism | **Mixed** | `BatakHandCard`'s `scale` addition and `TrickCenter`'s `TravelCard` activation are genuine tuning. `PlayingCard.contentScale` is new Rendering-layer capability (opt-in, additive, but genuinely new — no prior way to independently scale corner-index/watermark relative to card body existed). |

Two of five boxes fail or are mixed — the template's own instruction is unambiguous ("Every box must be true… Checking a box you're not sure about defeats the point"). This was reported BLOCKED with the above reasoning; the user, given three options (full audit / split into per-layer Quick Audits / explicitly accept a looser reading of "one layer"), chose the full template — matching both the template's own escalation rule and the depth already used for the hand-fan migration.

---

## Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| Trick-card visual footprint | No dedicated concept before this diff — `TrickCenter`, `GatherCard`, and `BatakHandCard`'s local-departure leg all rendered/targeted the card at full `size="normal"` with no distinct "trick size." |
| `PlayingCard`'s per-size-variant internal layout constants (`CORNER_INDEX_WIDTH`, `WATERMARK_ICON_SIZE`) | `packages/ui/src/PlayingCard.tsx` — pre-existing, independently tuned per `"small"`/`"normal"` variant, not linear functions of one another (Constitution §5.III's own evidence, §8 gap 2). |
| `TravelCard`'s scale-interpolation machinery (`originScale`/`restScale` props, wired into the shared `progress` value already driving `translateX`/`translateY`) | `apps/mobile/src/table/TravelCard.tsx` — pre-existing (added for `PlayedCard`-style callers generically), but every caller before this diff left it at its no-op defaults (`1`/`1`). |
| `useBatakCardMotion`'s `scale` target field (`BatakCardTarget.scale`) | `apps/mobile/src/games/batak/table/useBatakCardMotion.ts` — pre-existing, already driven by `BatakHandCard`'s selection-lift and deal-entrance effects (both already call `motion.setTarget({ ..., scale, timing })`). |
| `TRICK_SLOT_OFFSETS` (trick-cross layout, pixel offsets from dead-center per seat) | `apps/mobile/src/games/batak/table/TrickCenter.tsx` — pre-existing, hand-tuned pixel values sized for the (pre-this-diff) full-size trick card footprint. |

## Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| `TRICK_CARD_SCALE` / `TRICK_CARD_CONTENT_SCALE` / `LOCAL_DEPARTURE_SCALE` constants (deciding the trick card's target end-state) | Layer 3, Animation Planning — new: `apps/mobile/src/games/batak/table/trickCardScale.ts`. Pure data deciding *what* the shrink transitions to and *where in the timeline* it happens (per its own doc comment), consumed by name everywhere it's used — no re-derivation at any call site. |
| Corner-index/watermark independent scale compensation | Layer 5, Rendering — new, additive: `PlayingCard.contentScale` prop (`packages/ui/src/PlayingCard.tsx`), defaults to `1` (no-op) for every pre-existing caller. |
| Local-departure leg's target scale | Layer 4, Animation Execution — unchanged owner (`BatakHandCard.tsx`'s existing `motion.setTarget` call via `useBatakCardMotion`), now also setting `scale` in the same already-coordinated call. |
| In-flight scale interpolation (human play: held constant at `TRICK_CARD_SCALE`; AI play: `1 → TRICK_CARD_SCALE` over the flight) | Layer 4, Animation Execution — unchanged owner (`TravelCard.tsx`'s pre-existing `progress`-driven interpolation), now fed real values by `TrickCenter.tsx` instead of the no-op default. |
| Resting trick-card static scale | Layer 5, Rendering — `TrickCenter.tsx`'s `PlayingCard` render, a static `{ scale: TRICK_CARD_SCALE }` entry in the same `transform` array as the existing `rotate` entry (not a second style object — see the diff's own comment on why RN's transform-array flattening requires this). |
| Post-gather sweep's constant scale | Layer 4, Animation Execution — `GatherCard.tsx`'s `useAnimatedStyle`, a static (non-interpolated) `{ scale: TRICK_CARD_SCALE }` entry alongside the existing animated `rotateX`/`rotateY` flip. |
| `TRICK_SLOT_OFFSETS` (rescaled) | Layer 2, Layout Engine — `TrickCenter.tsx`, a pure, static rescaling of `BASE_TRICK_SLOT_OFFSETS` by `TRICK_CARD_SCALE`, computed once at module load with no animation-phase or gesture-state input. |

Every row maps to exactly one layer — the "multiple layers touched" finding above is about the *feature as a whole* spanning Layers 2/3/4/5, not any individual value having an ambiguous or shared owner.

## Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched. |
| 2. Layout Engine | `TrickCenter.tsx`'s `TRICK_SLOT_OFFSETS` rescaling — pure, static, no animation/gesture/render-cycle dependency (§5.IV holds). |
| 3. Animation Planning | New: `trickCardScale.ts` decides the trick card's target scale values and (via its own doc comment) documents an open decision about *when in the timeline* the shrink happens — see §5.VI Findings below. |
| 4. Animation Execution/Runtime | Three separate, pre-existing execution owners each retarget/extend with the new scale value: `BatakHandCard`'s `useBatakCardMotion` instance (local departure), `TravelCard`'s shared `progress` interpolation (flight), `GatherCard`'s `useAnimatedStyle` (post-gather sweep, static not interpolated). No new execution *mechanism* — all three primitives already existed and already handled `scale` for other callers/other properties. |
| 5. Rendering | New: `PlayingCard.contentScale` prop, composing an additional transform on `CornerIndex` and `CenterArt`'s rendered output. Also: `TrickCenter`'s resting-card static `scale` transform entry. |
| 6. Interaction | Not touched. |

## Boundary Violations

**None found.** Every value in Proposed Ownership maps to exactly one layer, and no layer reaches into another's job: `trickCardScale.ts`'s constants are imported by name everywhere (never recomputed independently — §5.II holds), `PlayingCard.contentScale` only paints what it's told (never decides *what* scale to use — that stays in Layer 3's constants module, consumed by the Layer 4/5 call sites), and `TravelCard`/`useBatakCardMotion`'s pre-existing coordination primitives are used exactly as designed, not bypassed or duplicated.

No `AnimationReviewWorkflow.md` §6 Stop Condition applies.

## Severity Classification

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| `PlayingCard`'s `"small"`/`"normal"` size variants remain internally non-linear (Constitution §8 gap 2's root cause) | Acceptable Technical Debt (pre-existing, unchanged by this diff) | Not resolved by this diff — worked *around* differently than before. Previously: freeze at `size="normal"`, skip the size-variant transition entirely (§8 gap 2's "non-compliant workaround"). Now: stay at `size="normal"` throughout (never switch variants) and apply a uniform outer `scale` transform plus a `contentScale` compensation for the two sub-elements whose constants don't scale uniformly. This is a genuinely different mechanism — see §5.VI Findings below for why it's arguably a candidate reference implementation for the gap, not just a second instance of the same workaround. Recorded as an Open Question, not resolved unilaterally here. |
| `LOCAL_DEPARTURE_SCALE`/`TravelCard` scale split (100% of the shrink happens during `BatakHandCard`'s local departure; `TravelCard` holds it constant for a human play) is a first-pass, unconfirmed choice — flagged by `trickCardScale.ts`'s own doc comment | Minor / Acceptable Technical Debt, pending on-device check | No action now. `trickCardScale.ts` itself documents the retuning path ("retune toward 1... if the ~200ms local-departure window reads as too abrupt"). Revisit only if Task 7 Step 4's on-device pass (the user's own, not this audit's) finds it abrupt. |
| `TrickCenter.tsx`'s `styles.trickCross` comment block ("`TRICK_SLOT_OFFSETS` itself is still tuned for the old, smaller card footprint and will read as much heavier overlap now") appears stale relative to the actual code, which now rescales `TRICK_SLOT_OFFSETS` by `TRICK_CARD_SCALE` | Minor | Pre-existing comment, not modified by this diff (Tasks 1–6 touched the `TRICK_SLOT_OFFSETS` computation and the JSX, not this later `styles` block). Documentation drift, not a functional defect — worth a follow-up comment fix, not blocking. |

## Risks

- **§5.VI — Coordinated Property Timelines (the two cases the task brief flagged for genuine scrutiny):**
  - `BatakHandCard`'s local-departure effect: before this diff, its `motion.setTarget({ x, y, timing })` call already coordinated two properties atomically (`useBatakCardMotion.setTarget` applies the same `duration`/`easing` to every field present in one call, all launched together — see `useBatakCardMotion.ts`). This diff adds `scale` to that same call, at the same call site, using a field (`BatakCardTarget.scale`) that already existed and was already used by this exact file's selection-lift and deal-entrance effects. This is populating an already-coordinated field with a real value, not building new coordination — the mechanism (one `setTarget` call = one atomic retarget) is unchanged.
  - `TrickCenter`'s `TravelCard` usage: `TravelCard.tsx`'s `originScale`/`restScale` props were already wired into the same single `progress` Animated.Value driving `translateX`/`translateY` (defaulting to `1`/`1`, a no-op, before this diff — see the component's own doc comment: "translateX/translateY/rotate/scale all share the one `progress` value, so they're guaranteed frame-perfect in sync"). `TrickCenter` now supplies real values instead of the no-op default. Same conclusion: activating pre-existing coordination, not adding new coordination machinery.
  - Conclusion for both: **no §5.VI violation, and no new coordination mechanism introduced.** This is the primary finding this audit was asked to make a real call on, not just check as an eligibility box.
- **`LOCAL_DEPARTURE_SCALE`/`TravelCard` split** — already covered under Severity above; the open design question is *where* the shrink happens in the timeline, not *whether* it's coordinated.
- **Reduced motion:** `BatakHandCard`'s local-departure effect returns early under `reducedMotion` (`if (!isDeparting || departed.current || reducedMotion) return;`), same as before this diff — under reduced motion the departure leg's `scale` change (like its `x`/`y`) simply never fires, and `TravelCard`'s own `reducedMotion` path snaps `progress` to `1` immediately (landing at `restScale` with no animation). Net visual result is correct (card ends at the shrunk size with no animation, matching this codebase's established "skip flourish, arrive instantly" reduced-motion convention), but this diff didn't add or change that branching — flagged for completeness, not as a new risk.
- **`GatherCard`'s constant (non-interpolated) `TRICK_CARD_SCALE`:** correct by construction, not a gap — the card is already at `TRICK_CARD_SCALE` the instant before gathering starts (per `TrickCenter`'s resting-card render), so `GatherCard` holding scale constant for the whole sweep reproduces the same value, not a mismatch requiring interpolation. Confirmed by code read; worth a live check per Task 7 Step 4 ("let a trick complete and gather — does `GatherCard` avoid popping back to normal size?").
- **Tuning basis:** `TRICK_CARD_SCALE`/`TRICK_CARD_CONTENT_SCALE` were tuned live against real `PlayingCard`s via the playground's Demo10 tool (per `trickCardScale.ts`'s own doc comment), not verified by an automated test — consistent with the standing 2026-07-07 no-new-tests policy and Constitution §5.VIII's still-conditional status.

## Open Questions

- Does this diff's approach (stay at `size="normal"`, compensate via an outer `scale` + `contentScale`, never switch size variants) constitute a working reference implementation for Constitution §8 gap 2 ("§5.VI has no working reference implementation for property pairs whose end-states are not linearly related")? It resolves the *symptom* (no more landing-moment pop from variant-switching) without resolving the *underlying* non-linearity between `"small"` and `"normal"`. Not resolved here — updating §8 gap 2's status is a Constitution §10 action, out of scope for this audit, and should be raised separately if the on-device pass confirms this reads as fully resolved.
- Should `LOCAL_DEPARTURE_SCALE` be retuned to spread more of the shrink into `TravelCard`'s flight leg, per `trickCardScale.ts`'s own flagged uncertainty? Deferred to Task 7 Step 4 (on-device, the user's own pass).
- On-device verification (Task 7 Step 4) has not yet happened — this audit's Approval below is conditional on it, not a substitute for it, mirroring how `BatakHandFan-Demo08Migration-Audit.md` handled the same situation.

## Approval

**Approved to implement:** Pending — implementation has already landed (Tasks 1–6, committed on `feature/batak-hand-fan-demo08-migration`) and this audit found no Critical/Major findings (only Minor/Acceptable-Technical-Debt items, all recorded above), but per `AnimationReviewWorkflow.md` §4/§7 this is not "Approved" until the on-device pass below actually happens.

**Conditions (if any):** On-device verification per the plan's Task 7 Step 4 — watch a human play (does the local-departure shrink look smooth or abrupt — the one genuinely open design question), watch an AI play (does it land at a visually matching size to the human's?), let a trick complete and gather (does `GatherCard` avoid popping back to normal size?), and check gömmeli's compact mode if reachable. This is the user's own pass, not something verifiable from the sandbox.

## Review Date

2026-08-05

## Reviewer

Claude Sonnet 5, in collaboration with the user (Ege Özel) — `QuickAuditTemplate.md`'s eligibility checklist was genuinely evaluated first (not self-selected) and found not clearly passing; the user was given that reasoning plus three options and explicitly chose to proceed with this full template, per `[[feedback_ask_audit_template_choice]]`.
