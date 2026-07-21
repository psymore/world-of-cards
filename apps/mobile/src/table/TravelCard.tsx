import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from '../components/useReducedMotion';
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from './travelAnimation';

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
  // Rotation (degrees) and scale the card visually had at departure, interpolated down to 0deg /
  // restScale as it travels. All three default to no-op values (0deg, scale 1→1) so every
  // pre-existing consumer is byte-identical to before these props existed. First real use:
  // Batak's own played card, which departs from its rotated, lifted-scale in-hand appearance
  // rather than a flat, unscaled one — see
  // docs/superpowers/specs/2026-07-21-batak-card-play-animation-smoothness-design.md.
  originRotateDeg?: number;
  originScale?: number;
  restScale?: number;
}

// Not exported: the reset/timing lifecycle (create the progress value, reset+animate on
// resetKey/reducedMotion change) factored out so promoting it to a standalone hook later (if a
// future caller needs the raw progress value to layer its own extra interpolation on top, e.g.
// a scale-in) is a one-line change instead of a refactor. See
// docs/superpowers/specs/2026-07-18-shared-card-travel-animation-design.md.
function useTravelProgress(resetKey: string | number): Animated.Value {
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
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [resetKey, reducedMotion]);

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
}: TravelCardProps) {
  const progress = useTravelProgress(resetKey);

  return (
    <Animated.View
      style={{
        // Fully opaque for the entire flight (no fade-in) so the card reads as physically
        // traveling along the path, not materializing at the end of it — see
        // docs/superpowers/specs/2026-07-18-card-travel-full-visibility-design.md.
        //
        // All four transforms are driven by the same `progress` value (never separate
        // Animated.Values), so they are guaranteed frame-perfect in sync on the native thread —
        // rotate/scale interpolating even a few frames out of step with translate would itself
        // read as a wobble during flight.
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
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [`${originRotateDeg}deg`, '0deg'],
            }),
          },
          {
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
