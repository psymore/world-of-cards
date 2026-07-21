import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { Card } from '@world-cards/engine';
import { PlayingCard } from '@world-cards/ui';
import { useReducedMotion } from '../components/useReducedMotion';
import { CARD_TRAVEL_DURATION_MS, CARD_TRAVEL_EASING } from './travelAnimation';

// An in-place face-down -> face-up flip that holds fully visible once complete — distinct from
// GatherCard (which flips WHILE flying out and fades to fully transparent at the end, correct
// for "this card is leaving the table" but wrong here, where the whole point is that the
// revealed card stays visible for the human to read). Used only for Batak gömmeli's
// kitty-exchange reveal stage (BatakTable's staged pile, while pendingBury.stage === 'revealing').
export function KittyRevealCard({ card }: { card: Card }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
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

  const frontRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const backRotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontOpacity = progress.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });
  const backOpacity = progress.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });

  return (
    <Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          backfaceVisibility: 'hidden',
          opacity: frontOpacity,
          transform: [{ perspective: 800 }, { rotateY: frontRotate }],
        }}>
        <PlayingCard card={card} size="small" />
      </Animated.View>
      <Animated.View
        style={{
          backfaceVisibility: 'hidden',
          opacity: backOpacity,
          transform: [{ perspective: 800 }, { rotateY: backRotate }],
        }}>
        <PlayingCard card={card} faceDown size="small" />
      </Animated.View>
    </Animated.View>
  );
}

// Flies a card from its rendered position toward destinationOffset and fades out over the last
// third — no flip, deliberately GatherCard's exact translate/fade shape minus the flip. Two
// distinct uses: (1) the "collecting" leg of the kitty-exchange sequence (face-up, the default —
// these cards are already face-up from the reveal stage and must stay that way while merging into
// the bidder's hand); (2) the AI-bidder path of the "burying" leg (faceDown=true — unlike the
// human bidder, whose chosen cards were already shown face-up in the bury slots before Confirm,
// the AI's discards must never be shown face-up at all, so this renders them face-down for their
// entire flight instead of using GatherCard's face-up-then-flip, which would otherwise leak the
// AI's card choice to the human for roughly the first half of the animation).
export function KittyCollectCard({
  card,
  destinationOffset,
  faceDown = false,
}: {
  card: Card;
  destinationOffset: { x: number; y: number };
  faceDown?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
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

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, destinationOffset.x] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, destinationOffset.y] });
  const opacity = progress.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View style={{ transform: [{ translateX }, { translateY }], opacity }}>
      <PlayingCard card={card} faceDown={faceDown} size="small" />
    </Animated.View>
  );
}
