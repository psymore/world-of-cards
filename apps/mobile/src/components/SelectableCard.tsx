import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { PlayingCard, PlayingCardProps } from '@world-cards/ui';
import { useReducedMotion } from './useReducedMotion';

export interface SelectableCardProps extends PlayingCardProps {
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  rotateDeg?: number;
  marginLeft?: number;
  liftDistance?: number;
  curveOffsetY?: number;
}

const DEFAULT_LIFT_DISTANCE = 16;
const LIFT_ANIM_DURATION_MS = 150;
// Matches PlayingCard's default CARD_RADIUS, used when the caller doesn't override cardRadius.
const DEFAULT_CARD_RADIUS = 6;

export function SelectableCard({
  selected = false,
  disabled,
  onPress,
  rotateDeg = 0,
  marginLeft,
  liftDistance = DEFAULT_LIFT_DISTANCE,
  curveOffsetY = 0,
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
      style={{ marginLeft, transform: [{ rotate: `${rotateDeg}deg` }, { translateY: Animated.add(lift, curveOffsetY) }] }}
    >
      <Pressable disabled={disabled} onPress={onPress}>
        <PlayingCard {...cardProps} highlighted={selected} />
        {disabled && (
          // Dark scrim marking the card as "not currently tappable" while keeping its art fully
          // visible underneath (richer than dimming the whole card via opacity). A plain local
          // View rather than @world-cards/ui's AbsoluteOverlay: the scrim needs the card's
          // rounded corners on the colored layer itself, which AbsoluteOverlay (a transparent
          // square fill wrapper) would only add as a second nested view. style.pointerEvents
          // (not the deprecated prop form) guarantees it never swallows touches, even though the
          // Pressable above is disabled anyway whenever the scrim shows.
          <View
            testID="selectable-card-disabled-scrim"
            style={[styles.disabledScrim, { borderRadius: cardProps.cardRadius ?? DEFAULT_CARD_RADIUS }]}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disabledScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    pointerEvents: 'none',
  },
});
