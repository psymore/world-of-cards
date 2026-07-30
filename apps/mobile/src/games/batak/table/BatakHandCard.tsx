import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
import type { Card } from '@world-cards/engine';
import { PlayingCard, CARD_DIMS } from '@world-cards/ui';
import { useBatakCardMotion } from './useBatakCardMotion';

const CARD_WIDTH = CARD_DIMS.normal.width;

export interface BatakHandCardProps {
  cardId: string;
  card: Card;
  // This card's target position/angle at mount — subsequent changes come through the parent
  // re-calling setTarget via the motion object it registers, not through this prop again (this
  // component never re-derives its own position from re-renders, per the fixed-box/shared-value
  // model — see Demo08ReanimatedHandReposition.tsx's own file-level comment).
  initial: { x: number; y: number; angleDeg: number };
  interactive: boolean;
  selected: boolean;
  onPress: () => void;
  registerCardRef: (cardId: string, node: View | null) => void;
  // Hands the parent this card's own motion controller (setTarget/getValues) once, on mount —
  // HumanHandFan uses this to retarget the card on every reflow, and BatakTable's
  // playWithMeasuredOrigin (Task 6) uses it to read the card's real current position at tap time.
  registerMotion: (cardId: string, motion: ReturnType<typeof useBatakCardMotion>) => void;
}

function BatakHandCardComponent({
  cardId,
  card,
  initial,
  interactive,
  selected,
  onPress,
  registerCardRef,
  registerMotion,
}: BatakHandCardProps) {
  const motion = useBatakCardMotion({ x: initial.x, y: initial.y, angleDeg: initial.angleDeg, scale: 1 });

  useEffect(() => {
    registerMotion(cardId, motion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  function handlePress() {
    if (!interactive) return;
    onPress();
  }

  // Captured directly by closure, rebuilt fresh every render — NOT read via a ref inside the
  // worklet callback below. Reading a plain React ref's `.current` from inside a Gesture Handler
  // `.onEnd` worklet is unsafe (Demo08's own file comment documents the exact runtime warning this
  // caused when tried) — see docs/animation/ADR/ADR-001-reanimated-demo08-experiment.md.
  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(handlePress)();
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: motion.shared.translateX.value },
      { translateY: motion.shared.translateY.value },
      { rotate: `${motion.shared.rotate.value}deg` },
      { scale: motion.shared.scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        testID={`batak-hand-card-${cardId}`}
        style={[
          { position: 'absolute', left: '50%', top: 0, marginLeft: -CARD_WIDTH / 2 },
          animatedStyle,
        ]}>
        <View ref={node => registerCardRef(cardId, node)}>
          <PlayingCard card={card} size="normal" highlighted={selected} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export const BatakHandCard = React.memo(BatakHandCardComponent);
