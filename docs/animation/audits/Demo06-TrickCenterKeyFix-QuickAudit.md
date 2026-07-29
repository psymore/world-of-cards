# Quick Audit: Demo 06 Departing-Card Missing `key` Fix

**Used per:** `../AnimationReviewWorkflow.md` §2 — the fast path for changes that are genuinely small and obvious.

---

## Eligibility

- [x] Touches exactly one Constitution §4 layer.
- [x] Adds no new Layout Engine geometry or coordinate math (§5.IV).
- [x] Does not change how multiple properties are coordinated on one transition (§5.VI).
- [x] Adds or changes no interactive/tappable element's hit behavior (§5.VII) — `PlayedCard` has no `Pressable`/touch handler at all (confirmed in `Demo06-ZIndexFix-Audit.md`'s own Layer Responsibilities check), so nothing here can affect what's tappable.
- [x] Is a correctness fix to already-shipped, already-audited code — not a new mechanism.

All boxes pass — Quick template applies.

---

## Change

**Name:** Give `PlayedCard` a stable `key` so a second play while one is still resting doesn't silently reuse the first card's animation instance.

**One-line description:** `Demo06HandReposition.tsx`'s render has exactly one conditional `PlayedCard` slot with no `key` prop; when `playedCard` changes from card A to card B while the slot is still occupied, React treats it as the *same* component instance receiving new props, not a new mount.

**Layer touched (Constitution §4):** 5, Rendering — this is purely a React reconciliation identity fix, not a geometry, timing, or interaction change.

## Root Cause (found via direct code read, not guessed)

`PlayedCard`'s departure animation is kicked off entirely inside:

```ts
useLayoutEffect(() => {
  motion.retarget(/* ... */);
  const timer = setTimeout(onComplete, TRAVEL_DURATION_MS + HOLD_MS);
  return () => clearTimeout(timer);
}, []); // deliberately empty — "fires once, on mount" (see the component's own doc comment)
```

That's correct *if* a new card always means a new mount. It doesn't: the render site is

```tsx
{playedCard ? <PlayedCard card={playedCard.card} ... /> : null}
```

with no `key`. If a second card is played before the first's `onComplete` fires (nothing currently prevents this — see the companion Full Audit for why that's being restricted anyway), `playedCard` changes to a new object, but React sees the same element type in the same position and **updates the existing instance** instead of unmounting/remounting it. The `useLayoutEffect`'s empty dependency array means it does not re-run — so the second card's `motion.retarget()` never fires. The card still renders (its `left`/`top`/`transform` style values are plain, non-effect-gated props that update normally), just frozen at its mount keyframe with no departure animation at all. This matches the reported symptom exactly.

## Quick Checks

- **Does this duplicate a value another layer or file already owns?** No — `key={playedCard.card.id}` is a plain React identity primitive, not a value with an owner elsewhere.
- **Does this leave any coordinate space, unit, or offset ambiguous?** No — no coordinates are touched.
- **Does this depend on a static layout position that could drift from where the element actually renders?** No — `key` affects only component identity/lifecycle, never layout.

## Severity Classification

| Finding | Severity | Resolution |
|---|---|---|
| Missing `key` on `PlayedCard`'s single conditional render slot causes component-instance reuse across different cards, silently skipping the reused instance's one-time mount effect | Major (confirmed, reproducible, user-reported) | Fix: add `key={playedCard.card.id}` to the `PlayedCard` element. Forces a genuine unmount/remount on every new play, restoring the "fires once per real mount" guarantee the effect's own empty-deps array already assumes. |

## Approval

**Approved to implement:** Yes
**Reviewer:** Claude (direct code read of `Demo06HandReposition.tsx`'s render and `PlayedCard`'s `useLayoutEffect`)
**Date:** 2026-07-29
