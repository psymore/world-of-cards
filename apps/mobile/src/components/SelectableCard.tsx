import React, { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { PlayingCard, PlayingCardProps } from '@world-cards/ui';
import { useReducedMotion } from './useReducedMotion';

export interface SelectableCardProps extends PlayingCardProps {
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  rotateDeg?: number;
  marginLeft?: number;
  liftDistance?: number;
}

const DEFAULT_LIFT_DISTANCE = 16;
const LIFT_ANIM_DURATION_MS = 150;

export function SelectableCard({
  selected = false,
  disabled,
  onPress,
  rotateDeg = 0,
  marginLeft,
  liftDistance = DEFAULT_LIFT_DISTANCE,
  ...cardProps
}: SelectableCardProps) {
  const lift = useRef(new Animated.Value(selected ? -liftDistance : 0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Selecting snaps instantly: a fast player taps once to select and immediately taps again to
    // play, and a 150ms rise would still be mid-flight when that second tap lands. Deselecting
    // (picking a different card, or the selected card unmounting once played) has no such urgency,
    // so it keeps the smooth animated drop for polish — unless the user has reduce-motion enabled,
    // in which case both directions snap instantly.
    if (selected || reducedMotion) {
      lift.setValue(selected ? -liftDistance : 0);
    } else {
      Animated.timing(lift, {
        toValue: 0,
        duration: LIFT_ANIM_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [selected, liftDistance, lift, reducedMotion]);

  return (
    <Animated.View
      style={{ marginLeft, transform: [{ rotate: `${rotateDeg}deg` }, { translateY: lift }] }}
    >
      <Pressable disabled={disabled} onPress={onPress}>
        <PlayingCard {...cardProps} highlighted={selected} />
      </Pressable>
    </Animated.View>
  );
}
