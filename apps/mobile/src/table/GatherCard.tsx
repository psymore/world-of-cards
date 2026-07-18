import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { Card } from '@world-cards/engine';
import { PlayingCard } from '@world-cards/ui';
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
}

// Matches PlayingCard's 'small' size (packages/ui/src/PlayingCard.tsx's CARD_DIMS.small), which
// isn't exported from packages/ui — hardcoded here the same way BatakTable.tsx already hardcodes
// its own HUMAN_CARD_WIDTH/HEIGHT for the 'normal' size.
const GATHER_CARD_WIDTH = 64;
const GATHER_CARD_HEIGHT = 86;

// Flips a played card face-down and flies it toward destinationOffset in one animation pass —
// used only for Batak's trick-gathering sweep (BatakTable's TrickCenter, when gatheringTrick is
// set). One instance per gathered card; each runs once on mount and is unmounted along with its
// parent once BatakScreen's gather timer commits the move, so there's no reset/retrigger case to
// handle (unlike TravelCard, which is reused for multiple plays over one mounted lifetime).
export function GatherCard({ card, destinationOffset }: GatherCardProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

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

  // Standard two-layer RN flip: a face-up layer rotating 0deg->180deg and a face-down layer
  // rotating 180deg->360deg, each hard-cut via a doubled input-range opacity swap exactly at the
  // midpoint (0.5). backfaceVisibility alone isn't reliably consistent across iOS/Android/web, so
  // the opacity swap is the real mechanism here, not just a belt-and-suspenders backup.
  const frontRotateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
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
        transform: [{ translateX }, { translateY }],
        opacity: groupOpacity,
      }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backfaceVisibility: 'hidden',
            opacity: frontOpacity,
            transform: [{ perspective: 800 }, { rotateY: frontRotateY }],
          },
        ]}>
        <PlayingCard card={card} size="small" />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backfaceVisibility: 'hidden',
            opacity: backOpacity,
            transform: [{ perspective: 800 }, { rotateY: backRotateY }],
          },
        ]}>
        <PlayingCard card={card} faceDown size="small" />
      </Animated.View>
    </Animated.View>
  );
}
