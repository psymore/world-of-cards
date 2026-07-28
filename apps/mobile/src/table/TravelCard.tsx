import React, { useEffect, useRef } from "react";
import { Animated, EasingFunction } from "react-native";
import { useReducedMotion } from "../components/useReducedMotion";
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from "./travelAnimation";

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
  // Size the card travels at (originScale) vs. lands at (restScale) — interpolated continuously
  // across the whole flight, off the same `progress` value driving translateX/Y (see below), not
  // held at originScale and shrunk only near the end — a hold-then-shrink read as an abrupt pop
  // right before landing.
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
// resetKey/durationMs/reducedMotion change) factored out so promoting it to a standalone hook
// later (if a future caller needs the raw progress value to layer its own extra interpolation on
// top) is a one-line change instead of a refactor. See
// docs/superpowers/specs/2026-07-18-shared-card-travel-animation-design.md.
function useAnimatedProgress(
  resetKey: string | number,
  durationMs: number,
  easing: EasingFunction,
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
  const progress = useAnimatedProgress(
    resetKey,
    durationMs,
    CARD_TRAVEL_EASING,
  );

  return (
    <Animated.View
      style={{
        // Fully opaque for the entire flight (no fade-in) so the card reads as physically
        // traveling along the path, not materializing at the end of it — see
        // docs/superpowers/specs/2026-07-18-card-travel-full-visibility-design.md.
        //
        // translateX/translateY/rotate/scale all share the one `progress` value, so they're
        // guaranteed frame-perfect in sync on the native thread — any of them interpolating even a
        // few frames out of step with another would itself read as a wobble/pop during flight.
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
            // Continuous shrink across the whole flight (not held at originScale and shrunk only
            // near the end, which read as a mechanical "pop" right before landing) — the same
            // CARD_TRAVEL_EASING curve driving translateX/Y also decelerates the shrink into its
            // final size.
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [originScale, restScale],
            }),
          },
        ],
      }}>
      {children}
    </Animated.View>
  );
}
