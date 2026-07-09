import React, { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { PlayingCard, PlayingCardProps } from './PlayingCard';

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

  useEffect(() => {
    Animated.timing(lift, {
      toValue: selected ? -liftDistance : 0,
      duration: LIFT_ANIM_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [selected, liftDistance, lift]);

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
