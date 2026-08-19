import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { Card } from '@world-of-cards/engine';
import { PlayingCard, CARD_DIMS } from '@world-of-cards/ui';
import { useReducedMotion } from '../components/useReducedMotion';
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from './travelAnimation';

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
  // Uniform scale for the whole card (body + face content), applied on the OUTER group layer —
  // which uses the default center transform origin — deliberately not on the inner front/back flip
  // layers, whose `transformOrigin` is an edge (see resolveFlipGeometry): scaling about an edge
  // anchors the card to that edge instead of shrinking it in place, displacing it by
  // ~(1 - scale)/2 × the card's dimension along the flip axis. Callers supply the real value; this
  // component stays game-agnostic. Defaults to 1 (no-op), matching every consumer before this prop
  // existed.
  cardScale?: number;
  // Forwarded to the face-up PlayingCard's `contentScale` — compensates the corner index and suit
  // watermark, whose per-size-variant constants aren't a uniform scale of the card body, so that a
  // card rendered at a reduced `cardScale` doesn't read with disproportionately tiny glyphs. Not
  // applied to the face-down layer (a card back has no such content). Defaults to 1 (no-op),
  // matching every consumer before this prop existed.
  contentScale?: number;
}

// Matches TrickCenter's trick cards, which render at size="normal" (not "small") — otherwise the
// card would visibly shrink right at the moment a completed trick starts gathering. This is the
// unscaled layout box; `cardScale` shrinks what's painted inside it via a centered transform, so
// the box itself stays CARD_DIMS.normal regardless of the caller's scale.
const GATHER_CARD_WIDTH = CARD_DIMS.normal.width;
const GATHER_CARD_HEIGHT = CARD_DIMS.normal.height;

// TEMPORARY DEBUG INSTRUMENTATION — see docs/domains/games/batak/known-issues.md "Animation
// stutter after several tricks" investigation. Tracks how many GatherCard instances are
// simultaneously mounted, to catch an unmount-cleanup leak that would compound trick over trick.
let liveGatherCardCount = 0;

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

// Builds the correct transform-array entry for whichever axis this card's geometry uses — RN's
// AnimatedTransform requires a distinct object key (rotateX vs rotateY) per property, so this
// can't be a single shared interpolation object.
function rotationTransform(
  axis: FlipAxis,
  value: Animated.AnimatedInterpolation<string>,
): { rotateX: Animated.AnimatedInterpolation<string> } | { rotateY: Animated.AnimatedInterpolation<string> } {
  return axis === 'X' ? { rotateX: value } : { rotateY: value };
}

// Flips a played card face-down and flies it toward destinationOffset in one animation pass —
// used only for Batak's trick-gathering sweep (BatakTable's TrickCenter, when gatheringTrick is
// set). One instance per gathered card; each runs once on mount and is unmounted along with its
// parent once BatakScreen's gather timer commits the move, so there's no reset/retrigger case to
// handle (unlike TravelCard, which is reused for multiple plays over one mounted lifetime).
//
// Deliberately plain `Animated`, not Reanimated, despite being migrated to Reanimated once before
// (see git history around the "migrate Batak's HumanHandFan + GatherCard to Reanimated" commit).
// Reverted back per the "Animation stutter after several tricks" investigation
// (docs/domains/games/batak/known-issues.md): a live-instrumented playthrough showed frame-gap
// stalls tightly coupled to every GatherCard mount/unmount cycle, growing monotonically worse
// trick over trick within one hand (up to several *seconds* by trick 10+), while the component's
// own mount count always cleanly returned to 0 — i.e. not a leaked React component, but Reanimated
// UI-thread bookkeeping (the shared value + its 3 style mappers, recreated fresh every trick, up
// to 13 times a hand) not being reclaimed as fast as new instances are created. `TravelCard.tsx`
// mounts/unmounts at the same rough frequency (once per play, not just per trick) using plain
// `Animated` and has never shown this — the animation engine, not the mount/unmount pattern, is
// the actual differentiator. `TravelCard`'s pre-existing plain-Animated implementation (before its
// own would-be migration was descoped by ADR-003) is the template this restores.
//
// Card size is entirely the caller's business (cardScale/contentScale, both no-op by default) —
// this component holds no game-specific constants, so its two consumers can render at different
// footprints: TrickCenter's trick gather passes Batak's shrunk trick-card scale, while
// KittyExchangeCenter's bury flight takes the full-size defaults.
export function GatherCard({
  card,
  destinationOffset,
  restRotateDeg = 0,
  cardScale = 1,
  contentScale = 1,
}: GatherCardProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!__DEV__) return;
    liveGatherCardCount += 1;
    console.log(`[BATAK-PERF] GatherCard mounted, live count: ${liveGatherCardCount}`);
    return () => {
      liveGatherCardCount -= 1;
      console.log(`[BATAK-PERF] GatherCard unmounted, live count: ${liveGatherCardCount}`);
    };
  }, []);

  useEffect(() => {
    // Reduced-motion users jump straight to progress=1, i.e. fully faded out (see groupOpacity
    // below) — matching the pre-existing (pre-this-feature) behavior of the trick just vanishing
    // instantly on commit, with no flip/travel flourish. This is intentional, not a bug: the
    // "meaningful end state" of this animation is the card being gone, so skipping straight to it
    // is the correct reduced-motion behavior, not a state that needs to look presentable.
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: CARD_TRAVEL_DURATION_MS,
      easing: CARD_TRAVEL_EASING,
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, [reducedMotion]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, destinationOffset.x],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, destinationOffset.y],
  });
  // Fades out over the animation's last third so the card visually dissolves as it nears the
  // winner's side instead of appearing to stop abruptly — there's no literal pile graphic to land
  // on (Batak's 2026-07-18 turn-indicator-simplification pass removed opponent card stacks
  // entirely).
  const groupOpacity = progress.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [1, 1, 0],
  });

  // Standard two-layer RN flip: a face-up layer rotating 0deg->(sign*180)deg and a face-down
  // layer rotating (sign*180)deg->(sign*360)deg, each hard-cut via a doubled input-range opacity
  // swap exactly at the midpoint (0.5). backfaceVisibility alone isn't reliably consistent across
  // iOS/Android/web, so the opacity swap is the real mechanism here, not just a
  // belt-and-suspenders backup. Axis, sign, and pivot all come from resolveFlipGeometry, so the
  // card rotates around the edge nearest its destination — see that function's doc comment.
  const { axis, sign, transformOrigin } = resolveFlipGeometry(destinationOffset);
  const frontRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${sign * 180}deg`],
  });
  const backRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${sign * 180}deg`, `${sign * 360}deg`],
  });
  const frontOpacity = progress.interpolate({
    inputRange: [0, 0.5, 0.5001, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = progress.interpolate({
    inputRange: [0, 0.4999, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <Animated.View
      style={{
        width: GATHER_CARD_WIDTH,
        height: GATHER_CARD_HEIGHT,
        // restRotateDeg is a rotateZ (in-plane tilt); the flip below rotates the inner front/back
        // layers around X or Y instead, so the two never conflict.
        transform: [{ translateX }, { translateY }, { rotate: `${restRotateDeg}deg` }, { scale: cardScale }],
        opacity: groupOpacity,
      }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backfaceVisibility: 'hidden',
            opacity: frontOpacity,
            transformOrigin,
            transform: [{ perspective: 800 }, rotationTransform(axis, frontRotate)],
          },
        ]}>
        <PlayingCard card={card} size="normal" contentScale={contentScale} />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backfaceVisibility: 'hidden',
            opacity: backOpacity,
            transformOrigin,
            transform: [{ perspective: 800 }, rotationTransform(axis, backRotate)],
          },
        ]}>
        <PlayingCard card={card} faceDown size="normal" />
      </Animated.View>
    </Animated.View>
  );
}
