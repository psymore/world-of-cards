# Architecture Audit: HomeScreen Staggered Mount-Entrance Animation

**Used per:** `../AnimationReviewWorkflow.md` §2 (Architecture Audit) and §4 (Implementation Approval Process). Completed before implementation begins, per direct user instruction to use this full template (not `QuickAuditTemplate.md`) for this task, regardless of what the task brief's own eligibility-checklist framing suggested.

**Scope note:** this is production code (`apps/mobile`), not an `apps/playground` demo, and touches two existing files rather than one isolated demo component — a standalone audit file in this folder is the correct container per `AuditTemplate.md`'s own header guidance, not an embedded per-demo doc.

---

**Feature Name:** HomeScreen game-menu-row staggered mount entrance

**Objective:** Add a one-time, mount-triggered fade + slide-up ("settle upward into place") animation to each `GameMenuRow` on the Home screen, staggered by list index, so the game list visibly reveals itself on screen load instead of appearing instantly.

**Constitution References:**
- §4, layers 4 (Animation Execution/Runtime) and 5 (Rendering) — the only two layers this change substantively touches.
- §5.V (Visual State Continuity) — relevant because this is a single, never-retargeted mount transition; worth explicitly confirming the historical jump-artifact failure mode (which required a reset-then-reinterpolate step) cannot occur here.
- §5.VI (Coordinated Property Timelines) — two properties (opacity, translateY) describe one physical event (the row's reveal) and must start/complete together; also worth explicitly checking against this principle's rationale, since the *mechanism* used here (one shared `Animated.Value` interpolated for both outputs) is the same literal mechanism §5.VI's rationale says was already implicated in a real bug elsewhere (`useCardMotion`'s original design) — see Layer Responsibilities and Severity Classification below for why that history does not apply here.
- §5.VII (Interactive Target Fidelity) — the row's `Pressable` is nested inside the newly-animated `Animated.View` wrapper; the wrapper's `transform` moves the whole subtree, so this needs a direct check, not an assumption.
- §5.IV (Deterministic, Pure Layout) — not meaningfully engaged: no Layout Engine geometry is added or computed by this change (the translateY end values, `12`/`0`, are fixed constants, not derived from any layout formula).
- §7 item 1 / `ADR-003` — engine choice. Plain `Animated` (`useNativeDriver: true`) is the default for `apps/mobile` outside the one evidenced-need file (`HumanHandFan.tsx`). This change has no reflow (each row's own transform is self-contained, no sibling repositioning) and no gesture/tap-arbitration concern, so there is no trigger under `ADR-003`'s Revisit Trigger to reach for Reanimated.
- §6 (Rejected Proposals) — not applicable; this change adds no live-progress observation or threshold-event coordination.
- §8 gap 2 (§5.VI's size-variant landing-mismatch gap) — not applicable; no size-variant/scale transition exists in this change.

---

## Current Ownership

| Value / Behavior | Current Owner (layer + location) |
|---|---|
| `GameMenuRow`'s rendered opacity/position | Rendering (layer 5) — static; no `Animated.Value`, no transform. `apps/mobile/src/screens/home/GameMenuRow.tsx`. |
| Row mount order / list index | Rendering (layer 5) — `HomeScreen.tsx`'s `games.map(...)`, JSX array order + `key={game.id}`. |
| `Pressable`'s hit-test region | Interaction (layer 6) — currently coincides exactly with the row's static layout box, since nothing transforms it. |
| Reduced-motion preference | Environmental input, consumed today by other components via `useReducedMotion()` (`apps/mobile/src/components/useReducedMotion.ts`); not yet consumed anywhere in `GameMenuRow`/`HomeScreen`. |

## Proposed Ownership

| Value / Behavior | Proposed Owner (Constitution §4 layer) |
|---|---|
| Row's opacity/translateY over time | Layer 4, Animation Execution/Runtime — one `Animated.Value` (`progress`) per `GameMenuRow` instance, `useRef`-held, driven by a single `Animated.timing` call in a mount `useEffect`. |
| Row's interpolated visual style | Layer 5, Rendering — the outer `Animated.View`'s `opacity`/`transform: [{ translateY }]`, both derived from the one `progress` value via `.interpolate()`. |
| *That* the row should reveal with a per-index stagger, and by how much (`index * 60`) | Layer 3, Animation Planning — decided once in `HomeScreen.tsx`'s `games.map(...)`, passed down as the `entranceDelayMs` prop. This is the entirety of the "planning" surface here: deciding a start-time offset, not a spatial start/end state (there is no position handoff to plan, unlike a card traveling between two layout slots). |
| Reduced-motion gating (skip straight to rest state) | Layer 4, Animation Execution/Runtime — `GameMenuRow` reads `useReducedMotion()` and either initializes `progress` at `1` directly or calls `progress.setValue(1)` in the effect, never engaging `Animated.timing` at all. |
| `Pressable`'s hit-test region | Layer 6, Interaction — unchanged mechanism (still layout-frame-based), now nested one level inside a `transform`-bearing ancestor. See Boundary Violations / Risks below for why this is judged non-blocking rather than assumed safe. |

## Layer Responsibilities

| Layer (§4) | This Change's Role |
|---|---|
| 1. Domain/Game State | Not touched. |
| 2. Layout Engine | Not touched. The row's real flex-list layout (size, position among siblings, `gap: 12`) is unaffected — `transform` never participates in layout, and the `12`/`0` translateY endpoints are fixed constants, not geometry derived from any layout formula. |
| 3. Animation Planning | `HomeScreen.tsx` decides that each row should start its own reveal offset by `index * 60`ms — the only planning decision in this change, and a narrow one (a start-time offset, not a start/end spatial state). |
| 4. Animation Execution/Runtime | The substantial new surface. `GameMenuRow` owns one `Animated.Value` (`progress`, `useRef`-held so it survives re-renders but is fresh per mount) and one `useEffect` that either snaps it to `1` (reduced motion) or runs one `Animated.timing(progress, { toValue: 1, duration: 260, delay: entranceDelayMs, useNativeDriver: true })`. No retarget path exists — this value is set exactly once per mount and never re-interpolated or reset mid-flight under normal operation (see §5.V discussion below for the one edge case, reduced-motion toggling mid-animation, and why it's non-blocking). |
| 5. Rendering | `GameMenuRow`'s existing `Pressable`/`MiniCardFan`/text content is now wrapped in one additional `Animated.View` whose `opacity` and `transform: [{ translateY }]` both interpolate from the single `progress` value. No other rendering change. |
| 6. Interaction | `Pressable` itself is unchanged — same props, same position in the tree relative to its own content. Its hit-test region is layout-frame-based, as before; the new ancestor `transform` does not change what layout system computes for that frame. See Boundary Violations below for the resulting §5.VII check. |

## Boundary Violations

**None found that rise to Major/Critical.** Checked directly against all of Constitution §5 and `AnimationReviewWorkflow.md` §6's Stop Conditions:

- No layer performs another layer's job. Planning (the stagger offset) and Execution (the timing call) stay cleanly separated via a plain prop, matching the Layer Model's own pattern for how Planning output should reach Execution.
- No new geometry duplication (§5.II) — translateY's endpoints are literal constants owned by exactly one place (`GameMenuRow`'s own JSX), not recomputed anywhere else.
- No coordinate-space ambiguity (§5.III) — `translateY`'s `[12, 0]` output range is a plain vertical pixel offset in the row's own local transform space, the same convention every other `Animated.View` `transform` in this codebase already uses; nothing crosses a component boundary as an unlabeled number.
- Layout Engine purity (§5.IV) is not engaged, since no Layout Engine code exists in this change.

**One Minor, non-blocking finding, recorded rather than silently accepted** — see Severity Classification and Risks below: a transient §5.VII (Interactive Target Fidelity) divergence is theoretically possible during the brief animation window, because the `Pressable`'s hit-test frame (layout-based, always at the row's final resting position) does not itself move, while the row's *visual* position is offset by up to 12dp for up to ~260ms plus its stagger delay. This is judged not to reproduce the bug category §5.VII exists to prevent (see reasoning below), but is recorded explicitly rather than waved off, per the Constitution's own standard for how this class of finding should be handled.

## Severity Classification

| Finding | Severity | Resolution / Escalation |
|---|---|---|
| §5.VII transient touch-target/visual divergence: each row's static (layout) hit-test box sits at its *final* resting position for the whole animation, while its visual position is offset by up to 12dp during the reveal. | Minor / Acceptable Technical Debt | Reasoned through, not assumed safe: (1) each row occupies a **unique, non-overlapping** static box in a normal vertical flex list — this is structurally different from the rail-fan bug (`§5.VII` evidence), where *multiple* cards shared the *identical* static box, creating genuine ambiguity about which element should receive a tap. Here there is no competing element for a given tap to be misrouted to in the general case. (2) The one narrow overlap case — the row's transient visual position (offset by up to 12dp, exactly the list's `gap: 12`) could momentarily encroach into the *next* row's reserved static box during the animation, at which point a tap landing in that sliver would route (correctly, by hit-test rules) to the next row rather than the one the user visually perceives moving through that space. (3) This requires a tap precisely inside a ≤12dp sliver, within a ≤260ms(+stagger) window, at the very moment the app has just mounted — before a user has plausibly had time to target a specific row. (4) The consequence if it did occur is still benign: navigation to a real, correctly-positioned game row, not a crash or navigation to an unrelated screen. Accepted as-is; not a required code change for this task. Revisit only if a future change meaningfully lengthens the animation duration/offset or removes the vertical-only, non-overlapping-list-item structure this reasoning depends on. |
| Reuse of a single shared `Animated.Value` interpolated into two outputs (opacity, translateY) — the same literal *mechanism* §5.VI's rationale flags as implicated in the `useCardMotion` jump-artifact bug. | Not a violation (verified, not assumed) | The historical bug required a **reset-then-reinterpolate** step on an in-flight, retargeted transition — resetting `progress` to `0` and swapping its `.interpolate()` mapping while a previous leg was still conceptually "live," creating a one-frame window where a stale mapping could paint at input `0`. This component has **no retarget path**: `progress` is created once per mount, animates exactly once from its initial value (`0`, or `1` under reduced motion) to `1`, and is never reset or re-targeted afterward under normal operation. The specific failure mechanism §5.VI's rationale describes cannot occur here. (One narrow edge case — reduced-motion toggling live, mid-animation — is addressed separately below under Risks; it does not involve a reset-then-reinterpolate step either.) |
| Engine choice: plain `Animated`, not Reanimated. | Not a violation | Consistent with `ADR-003`'s default and Final State Reference — this change has no multi-card reflow and no gesture/tap-arbitration requirement, so none of `ADR-003`'s Revisit Trigger conditions apply. |

No Major or Critical findings. Approval is not blocked.

## Risks

- **Reduced-motion toggled live, mid-animation.** If OS "reduce motion" flips from off→on while a row's entrance is still in flight, the effect re-runs (`reducedMotion` is a dependency) and calls `progress.setValue(1)`, hard-snapping to the rest state rather than easing there. This is the intended accessibility behavior (immediate settle, no continued motion once reduced motion is requested), not a bug — noted so a future session doesn't mistake the snap for an unintended regression. Toggling the OS setting during the sub-second window right after Home mounts is an extreme edge case in the first place.
- **Re-mount replay.** `progress` is `useRef`-initialized fresh per component instance, so navigating away from and back to `HomeScreen` naturally replays the full staggered entrance on every remount (each `GameMenuRow` unmounts/remounts with the screen). This is consistent with "mount-entrance animation" as specified and not flagged as a defect, but recorded so it isn't later mistaken for one.
- **Empty-game-list branch.** When `games.length === 0`, `HomeScreen` renders a plain `Text` empty-state instead of any `GameMenuRow`s — this change has no interaction with that branch at all.
- **Test-environment timing.** `Animated.timing(...).start()` fires after `delay` outside of Jest's synchronous render pass. `HomeScreen.test.tsx` already uses `await render(...)` for its existing two assertions (checking rendered text and a `fireEvent.press` call), and `Pressable`'s `onPress` is not gated by animation completion — pressing during/before the entrance still fires `onSelectGame` correctly, since `opacity`/`transform` are purely visual and never conditionally block interaction in the code as specified in the brief. Actual test run results are recorded in the task report, not assumed here.

## Open Questions

None blocking. One deliberately-scoped-out item, per the brief's own instruction: `HeroCard`'s own entrance (settling into its tilted rest position before the rows start) is not included in this change — the brief explicitly makes it optional, tied to whether the Audit's scope "naturally" covers it. It does not: `HeroCard` is a separate, already-existing, zero-prop component untouched by either file this task modifies, and adding motion to it would be a second, independently-scoped feature (its own mount effect, its own Constitution layer analysis, its own risk section) rather than a natural extension of the row-stagger work audited here. Recorded as a follow-up, not started.

## Approval

**Approved to implement:** Yes
**Conditions (if any):** None required. Two Minor/non-blocking notes carried forward for future reference (see Severity Classification and Risks): the transient §5.VII touch-target divergence, and the intentional re-mount replay behavior.

## Review Date

2026-07-30

## Reviewer

Claude (Architecture Audit against `docs/animation/animation-architecture-constitution.md` and `docs/animation/ADR/ADR-003-scope-reanimated-migration-to-evidenced-need.md`, prior to implementing Task 9 of the HomeScreen redesign plan)
