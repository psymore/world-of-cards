# Shared card-travel animation — design

## Context

Batak's `TrickCenter.TravelCard` and Pişti's `PistiTable.RevealCard` (`apps/mobile/src/games/batak/BatakTable.tsx`, `apps/mobile/src/games/pisti/PistiTable.tsx`) are two separately hand-rolled implementations of the same idea: animate a just-played card's opacity and position from an origin offset down to rest, using the same shared timing constants (`CARD_TRAVEL_DURATION_MS`/`CARD_TRAVEL_EASING`, `apps/mobile/src/table/travelAnimation.ts`) and the same origin-resolution helpers (`resolveRevealOrigin`/`revealOriginOffset`, `apps/mobile/src/table/seating.ts`).

The two implementations differ in exactly the ways that should differ per game: Batak's already lets its parent (`TrickCenter`'s per-seat `trickSlot`, positioned via `TRICK_SLOT_OFFSETS`) control the destination — it only animates the origin-to-rest delta, relative to wherever it's rendered. Pişti's `RevealCard` bakes a fixed destination offset (`PILE_CARD_OFFSETS[MAX_STACKED_PILE_CARDS]`) directly into its interpolation, and additionally does a scale-in (0.6→1) and renders a "X played" label — neither of which Batak's version has.

This is the same kind of duplication `SelectableCard`/`useCardSelection` already solved for card selection/deselection — one shared component, each game supplying only what genuinely differs (there, selection state; here, destination layout).

## Scope

Extract Batak's existing pattern — origin-relative animation, parent controls destination by where it renders the component — into a shared `TravelCard`, and swap Batak's local implementation to use it. **Pişti's `RevealCard` is explicitly out of scope and untouched in this pass.** Its extra scale/label/baked-destination behavior isn't replicated or guessed at here; migrating it is a separate future task once actually undertaken, not speculated on now.

## Component: `TravelCard` (`apps/mobile/src/table/TravelCard.tsx`)

New file, alongside the other shared table/animation pieces it depends on (`travelAnimation.ts` for timing, `seating.ts` for origin resolution — which it does *not* import; origin resolution stays entirely caller-side) and next to `DealFlightOverlay.tsx` (the deal-time sibling animation).

```ts
export interface TravelCardProps {
  // Where the card visually travels from, relative to its own rest position (0, 0) — e.g.
  // revealOriginOffset(resolveRevealOrigin(playerId, humanPlayerId, seats)). The destination
  // itself is never a prop: the caller controls it entirely by where it renders this component
  // (see BatakTable's TRICK_SLOT_OFFSETS-positioned trickSlot for the existing example) — this is
  // the one property that must differ per game, so it's deliberately left outside this component.
  originOffset: { x: number; y: number };
  // Retriggers the animation whenever it changes (e.g. card.id) — explicit rather than relying on
  // the caller always fully unmounting/remounting between cards, so this stays correct even for a
  // future caller that keeps the wrapper mounted and only swaps its `children`.
  resetKey: string | number;
  children: React.ReactNode;
}

export function TravelCard(props: TravelCardProps): JSX.Element;
```

Internally: one `Animated.Value` (progress, 0→1), reset+animated via `CARD_TRAVEL_DURATION_MS`/`CARD_TRAVEL_EASING` in a `useEffect` keyed on `[resetKey, reducedMotion]` (checked directly against `useReducedMotion`'s real implementation — it live-subscribes to `AccessibilityInfo`'s `reduceMotionChanged` event, not just a one-time resolve at mount, so this dependency is load-bearing, not incidental), or snapped instantly to 1 when `reducedMotion` is already true. Wraps `children` in an `Animated.View` whose `opacity` and `translateX`/`translateY` all interpolate off that one value, translate going from `originOffset` down to `(0, 0)`.

The reset/timing lifecycle (the "create the progress value, reset+animate on `resetKey`/`reducedMotion` change" logic) is factored into a small helper *within this file*, not exported. This costs nothing today and changes nothing about the public API above — but if a future game's migration (Pişti's, or a later trick-taking game's) ever needs the raw progress value directly to layer its own extra interpolation (e.g. Pişti's scale-in) on top, promoting that helper to an exported hook is a one-line change instead of a refactor, without having to guess today at what shape a `scale`/`label` prop should take.

## Batak wiring

`BatakTable.tsx`'s local `TravelCard` function (currently ~lines 284–317) is deleted entirely. `TrickCenter.slotFor`'s existing call:

```tsx
<TravelCard card={card} origin={resolveRevealOrigin(playerId!, humanPlayerId, seats)} />
```

becomes:

```tsx
<TravelCard originOffset={revealOriginOffset(resolveRevealOrigin(playerId!, humanPlayerId, seats))} resetKey={card.id}>
  <PlayingCard card={card} size="small" />
</TravelCard>
```

Pure extraction — rendered output should be pixel-identical to today; the `revealOriginOffset` call moves from inside the old local component to the call site (since the shared component takes a raw offset, not a `RevealOrigin`).

## Testing

No new automated tests — decorative animation/timing UI, matching the standing 2026-07-07 mobile-UI testing policy (the original `TravelCard`/`RevealCard` had none either). Existing suite re-run for regression after the change.

## Out of scope / deferred

- Pişti's `RevealCard` migration to the shared component (its scale-in and label behavior are not built into `TravelCard` speculatively).
- Any future trick-taking game (Hearts, Spades) reusing this: expected to work as-is for the origin/timing pieces, but each will need its own destination-layout code (a `TRICK_SLOT_OFFSETS`-equivalent), same as Batak needed — this is correct scope, not a gap, since destination layout is genuinely game-specific.
