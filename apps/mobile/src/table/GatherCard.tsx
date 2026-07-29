import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Card } from '@world-cards/engine';
import { PlayingCard, CARD_DIMS } from '@world-cards/ui';
import { useReducedMotion } from '../components/useReducedMotion';
import { CARD_TRAVEL_DURATION_MS } from './travelAnimation';

export interface GatherCardProps {
  card: Card;
  // Where the card visually travels to, relative to its own rest position (0, 0) — e.g.
  // revealOriginOffset(resolveRevealOrigin(winnerId, humanPlayerId, seats)). Mirrors TravelCard's
  // originOffset but in the opposite direction: this is a fly-OUT (rest -> destination), not a
  // fly-IN (origin -> rest), which is why it's a separate component rather than a new TravelCard
  // prop — TravelCard's contract ("the caller controls the destination by where it renders this
  // component") doesn't hold once the destination itself needs to animate away from that spot.
  destinationOffset: { x: number; y: number };
  // The angle this card was resting at just before the trick swept (see BatakScreen's
  // restingRotations doc comment) — held fixed for the whole sweep, same principle as
  // TravelCard's originRotateDeg: a card that landed at a natural hand-fan angle shouldn't snap
  // flat right as it starts flying away. A plain static value (not animated), composed alongside
  // the flip's own rotateX/rotateY on a different axis (rotateZ), so it doesn't interfere with the
  // flip geometry at all. Defaults to 0 (no-op), matching every consumer before this prop existed.
  restRotateDeg?: number;
}

// Matches TrickCenter's trick cards, which render at size="normal" (not "small") — otherwise the
// card would visibly shrink right at the moment a completed trick starts gathering.
const GATHER_CARD_WIDTH = CARD_DIMS.normal.width;
const GATHER_CARD_HEIGHT = CARD_DIMS.normal.height;

// Reanimated's own Easing (a worklet-compatible curve, evaluated on the UI thread) — kept local to
// this file rather than widening travelAnimation.ts's shared CARD_TRAVEL_EASING export until every
// one of its consumers (TravelCard, KittyRevealCard) has also migrated off plain `Animated` — see
// docs/superpowers/plans/2026-07-29-batak-reanimated-migration.md. Same curve
// (Easing.out(Easing.cubic)) as the plain-Animated version this replaces.
const GATHER_CARD_EASING = Easing.out(Easing.cubic);

type FlipAxis = 'X' | 'Y';

interface FlipGeometry {
  axis: FlipAxis;
  sign: 1 | -1;
  transformOrigin: string;
}

// Derives which edge the card should pivot around and which way it should swing, purely from
// destinationOffset — Batak's offsets are always axis-aligned (either {x: 0, y: ±195} or
// {x: ±165, y: 0}, per REVEAL_ORIGIN_OFFSETS in ../table/seating.ts), so checking which
// component is non-zero is enough to tell direction. The card pivots at the edge NEAREST the
// destination and the opposite edge swings toward it — see
// docs/superpowers/specs/2026-07-19-batak-trick-gather-directional-flip-design.md for the
// validated rotation-sign table this implements.
function resolveFlipGeometry(destinationOffset: { x: number; y: number }): FlipGeometry {
  if (destinationOffset.y !== 0) {
    return destinationOffset.y > 0
      ? { axis: 'X', sign: 1, transformOrigin: '50% 100%' } // toward bottom (human)
      : { axis: 'X', sign: -1, transformOrigin: '50% 0%' }; // toward top (AI)
  }
  if (destinationOffset.x !== 0) {
    return destinationOffset.x > 0
      ? { axis: 'Y', sign: -1, transformOrigin: '100% 50%' } // toward right (AI)
      : { axis: 'Y', sign: 1, transformOrigin: '0% 50%' }; // toward left (AI)
  }
  // Fallback ({x: 0, y: 0}) — not expected in practice (every real Batak seat resolves to a
  // non-zero direction), but a safe default rather than a special-cased crash: today's original
  // center-pivot rotateY behavior.
  return { axis: 'Y', sign: 1, transformOrigin: '50% 50%' };
}

// Flips a played card face-down and flies it toward destinationOffset in one animation pass —
// used only for Batak's trick-gathering sweep (BatakTable's TrickCenter, when gatheringTrick is
// set). One instance per gathered card; each runs once on mount and is unmounted along with its
// parent once BatakScreen's gather timer commits the move, so there's no reset/retrigger case to
// handle (unlike TravelCard, which is reused for multiple plays over one mounted lifetime).
export function GatherCard({ card, destinationOffset, restRotateDeg = 0 }: GatherCardProps) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const { axis, sign, transformOrigin } = resolveFlipGeometry(destinationOffset);

  useEffect(() => {
    // Reduced-motion users jump straight to progress=1, i.e. fully faded out (see the group
    // style's opacity below) — matching the pre-existing (pre-this-feature) behavior of the trick
    // just vanishing instantly on commit, with no flip/travel flourish. This is intentional, not a
    // bug: the "meaningful end state" of this animation is the card being gone, so skipping
    // straight to it is the correct reduced-motion behavior, not a state that needs to look
    // presentable.
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: CARD_TRAVEL_DURATION_MS, easing: GATHER_CARD_EASING });
  }, [reducedMotion, progress]);

  const groupStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, destinationOffset.x]) },
      { translateY: interpolate(progress.value, [0, 1], [0, destinationOffset.y]) },
      // restRotateDeg is a rotateZ (in-plane tilt); the flip below rotates the inner front/back
      // layers around X or Y instead, so the two never conflict.
      { rotate: `${restRotateDeg}deg` },
    ],
    // Fades out over the animation's last third so the card visually dissolves as it nears the
    // winner's side instead of appearing to stop abruptly — there's no literal pile graphic to
    // land on (Batak's 2026-07-18 turn-indicator-simplification pass removed opponent card
    // stacks entirely).
    opacity: interpolate(progress.value, [0, 0.65, 1], [1, 1, 0]),
  }));

  // Standard two-layer flip: a face-up layer rotating 0deg->(sign*180)deg and a face-down layer
  // rotating (sign*180)deg->(sign*360)deg, each hard-cut via a doubled input-range opacity swap
  // exactly at the midpoint (0.5). backfaceVisibility alone isn't reliably consistent across
  // iOS/Android/web, so the opacity swap is the real mechanism here, not just a
  // belt-and-suspenders backup. Axis, sign, and pivot all come from resolveFlipGeometry, so the
  // card rotates around the edge nearest its destination — see that function's doc comment.
  const frontStyle = useAnimatedStyle(() => {
    const rotateValue = `${interpolate(progress.value, [0, 1], [0, sign * 180])}deg`;
    return {
      backfaceVisibility: 'hidden' as const,
      opacity: interpolate(progress.value, [0, 0.5, 0.5001, 1], [1, 1, 0, 0]),
      transformOrigin,
      transform: [{ perspective: 800 }, axis === 'X' ? { rotateX: rotateValue } : { rotateY: rotateValue }],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateValue = `${interpolate(progress.value, [0, 1], [sign * 180, sign * 360])}deg`;
    return {
      backfaceVisibility: 'hidden' as const,
      opacity: interpolate(progress.value, [0, 0.4999, 0.5, 1], [0, 0, 1, 1]),
      transformOrigin,
      transform: [{ perspective: 800 }, axis === 'X' ? { rotateX: rotateValue } : { rotateY: rotateValue }],
    };
  });

  return (
    <Animated.View style={[{ width: GATHER_CARD_WIDTH, height: GATHER_CARD_HEIGHT }, groupStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        <PlayingCard card={card} size="normal" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        <PlayingCard card={card} faceDown size="normal" />
      </Animated.View>
    </Animated.View>
  );
}
