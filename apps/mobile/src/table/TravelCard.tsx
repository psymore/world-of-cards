import React, { useEffect, useRef } from 'react';
import { Animated, EasingFunction } from 'react-native';
import { useReducedMotion } from '../components/useReducedMotion';
import {
  CARD_TRAVEL_DURATION_MS,
  CARD_TRAVEL_EASING,
  CARD_SCALE_EASING,
  CARD_SCALE_HOLD_FRACTION,
  CARD_SCALE_SHRINK_EASING,
} from './travelAnimation';

export interface TravelCardProps {
  // Where the card visually travels from, relative to its own rest position (0, 0) — e.g.
  // revealOriginOffset(resolveRevealOrigin(playerId, humanPlayerId, seats)). The destination
  // itself is never a prop: the caller controls it entirely by where it renders this component
  // (see BatakTable's TRICK_SLOT_OFFSETS-positioned trickSlot) — this is the one property that
  // must differ per game, so it's deliberately left outside this component.
  originOffset: { x: number; y: number };
  // Retriggers the animation whenever it changes (e.g. card.id) — explicit rather than relying
  // on the caller always fully unmounting/remounting between cards, so this stays correct even
  // for a future caller that keeps the wrapper mounted and only swaps its `children`.
  resetKey: string | number;
  children: React.ReactNode;
  // The card's rotation (degrees) in its hand slot at the moment it was played — held fixed for
  // the entire flight, not eased toward 0deg. A card sitting at, say, a 12-degree fan angle keeps
  // that exact angle all the way to the table, the same way a physical card would if you slid it
  // out from a fanned hand without twisting it upright first — see
  // docs/superpowers/specs/2026-07-22-batak-travel-preserve-hand-rotation-design.md. Defaults to
  // 0deg (no-op) so every pre-existing consumer (AI plays never supply a nonzero angle — see
  // TrickCenter.tsx) is byte-identical to before this prop existed.
  originRotateDeg?: number;
  // Size the card travels at (originScale) vs. lands at (restScale) — see the scale interpolation
  // below: held at originScale for most of the flight, shrinking to restScale only over the final
  // stretch (CARD_SCALE_HOLD_FRACTION), not a continuous resize across the whole travel.
  originScale?: number;
  restScale?: number;
  // Overrides CARD_TRAVEL_DURATION_MS for just this flight — used by Batak's human-play local-
  // departure handoff (BatakScreen.tsx), where a first, short leg already covers part of the
  // travel time/distance before this component ever mounts, so the remaining leg needs less than
  // the full duration to land on schedule. Defaults to CARD_TRAVEL_DURATION_MS, so every
  // pre-existing consumer is byte-identical to before this prop existed.
  durationMs?: number;
}

// Not exported: the reset/timing lifecycle (create the progress value, reset+animate on
// resetKey/reducedMotion/easing change) factored out so promoting it to a standalone hook later
// (if a future caller needs the raw progress value to layer its own extra interpolation on top)
// is a one-line change instead of a refactor. See
// docs/superpowers/specs/2026-07-18-shared-card-travel-animation-design.md. Parametrized on
// `easing` (rather than hardcoding CARD_TRAVEL_EASING) so translate/rotate and scale can each run
// their own independently-eased Animated.Value in parallel — see CARD_SCALE_EASING's doc comment
// for why sharing one curve between a position change and a size change looks wrong.
function useAnimatedProgress(
  resetKey: string | number,
  durationMs: number,
  easing: EasingFunction
): Animated.Value {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing,
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [resetKey, durationMs, easing, reducedMotion]);

  return progress;
}

// Animates `children` traveling from `originOffset` to its resting position (wherever the
// caller renders this component) — opacity fades in alongside the translate. Shared by every
// game's "just-played card travels from its seat to its resting spot" motion (first use:
// Batak's trick cross; Pişti's own reveal-to-pile animation is a separate, untouched
// implementation for now). Rotation/scale interpolation is additive and optional (see
// TravelCardProps) — omitting them reproduces the original translate-only behavior exactly.
export function TravelCard({
  originOffset,
  resetKey,
  children,
  originRotateDeg = 0,
  originScale = 1,
  restScale = 1,
  durationMs = CARD_TRAVEL_DURATION_MS,
}: TravelCardProps) {
  const progress = useAnimatedProgress(resetKey, durationMs, CARD_TRAVEL_EASING);
  // Separate Animated.Value from `progress`, driven honestly linear-in-time (see
  // CARD_SCALE_EASING's doc comment): `progress` is nonlinear in time (CARD_TRAVEL_EASING is
  // heavily front-loaded), so gating "when the shrink starts" off of it would make the shrink
  // start much earlier in real time than CARD_SCALE_HOLD_FRACTION implies. Both start/reset
  // together (same resetKey/durationMs), just via separate Animated.timing calls.
  const scaleProgress = useAnimatedProgress(resetKey, durationMs, CARD_SCALE_EASING);

  return (
    <Animated.View
      style={{
        // Fully opaque for the entire flight (no fade-in) so the card reads as physically
        // traveling along the path, not materializing at the end of it — see
        // docs/superpowers/specs/2026-07-18-card-travel-full-visibility-design.md.
        //
        // translateX/translateY/rotate all share the one `progress` value, so they're guaranteed
        // frame-perfect in sync on the native thread — rotate interpolating even a few frames out
        // of step with translate would itself read as a wobble during flight. scale intentionally
        // runs off its own, linearly-timed `scaleProgress` value instead (see its declaration
        // above) so its 3-point inputRange below means what it says in real time.
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [originOffset.x, 0],
            }),
          },
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [originOffset.y, 0],
            }),
          },
          // Deliberately not driven by `progress`: the card keeps its exact hand-fan angle for
          // the whole flight rather than un-rotating as it travels — see originRotateDeg's doc
          // comment above. A plain static value, not an interpolation.
          { rotate: `${originRotateDeg}deg` },
          {
            // Held at originScale for CARD_SCALE_HOLD_FRACTION of the flight — no gradual resize
            // "on the way" — then shrinks to restScale over just the final stretch, right before
            // landing. Not a continuously-changing size across the whole travel. `easing` here
            // only affects the shrink segment (RN's interpolate applies it to the local fraction
            // *within* whichever segment is active — the flat hold segment is a no-op regardless,
            // since its output doesn't change) — without it, the shrink itself was a constant-rate
            // linear resize, which measured live as a fast mechanical "pop" rather than settling
            // smoothly into its final size.
            scale: scaleProgress.interpolate({
              inputRange: [0, CARD_SCALE_HOLD_FRACTION, 1],
              outputRange: [originScale, originScale, restScale],
              easing: CARD_SCALE_SHRINK_EASING,
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
  );
}
