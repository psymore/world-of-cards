import React, { useEffect, useRef } from 'react';
import { Animated, Easing, EasingFunction, Pressable, StyleSheet, View } from 'react-native';
import { PlayingCard, PlayingCardProps } from '@world-cards/ui';
import { useReducedMotion } from './useReducedMotion';
import { useSettingsStore } from '../state/settingsStore';

export interface SelectableCardHitSlop {
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
}

export interface SelectableCardProps extends PlayingCardProps {
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  rotateDeg?: number;
  // Eases a change to rotateDeg over this many ms instead of snapping to it instantly. Needed by
  // Batak's HumanHandFan: playing a card shrinks the row, which recomputes every remaining card's
  // fan angle (rotateDeg depends on indexInRow/rowCount) — without this, that reflow's position
  // change animates smoothly (the caller's own translateX/Y do) while the rotation snapped in a
  // single frame, visibly desyncing the two. Defaults to 0 (snap), so every pre-existing caller
  // that never varies rotateDeg for an already-mounted card (Pişti's flat hand, every opponent
  // seat) is byte-identical to before this prop existed.
  rotateAnimationDurationMs?: number;
  // Easing for the transition above. Defaults to Animated.timing's own default (inOut ease) —
  // pass the exact curve driving the caller's position reflow (e.g. HumanHandFan's
  // HAND_CARD_REPOSITION_EASING) so rotation and position move in visual lockstep.
  rotateEasing?: EasingFunction;
  marginLeft?: number;
  liftDistance?: number;
  curveOffsetY?: number;
  // Shrinks (negative values) or grows (positive) the Pressable's touchable bounds relative to
  // its visual size. Used by Batak's overlapping fan to shrink the SELECTED card's hit box: once
  // lifted and rotated, its axis-aligned touch rectangle is wider than its rotated visual
  // silhouette and can otherwise catch a tap aimed at a neighbor's clearly-exposed face.
  hitSlop?: SelectableCardHitSlop;
}

// Exported: callers that measure a selected card's on-screen position for a travel-animation
// origin (PistiTable/BatakTable's playWithMeasuredOrigin) need this exact value. Selection lifts
// the card via a transform on an inner Animated.View, which a measureInWindow ref placed outside
// that transform never sees (a child's transform doesn't move its parent's own layout box, and
// Android's location APIs ignore transforms even on the transformed node itself) — since
// selecting snaps the lift instantly rather than animating it, the offset at the moment of the
// confirming second tap is always exactly this constant, so callers subtract it from the measured
// (untransformed) position instead of trying to measure the transformed one.
export const DEFAULT_LIFT_DISTANCE = 16;
const LIFT_ANIM_DURATION_MS = 150;
// Matches PlayingCard's default CARD_RADIUS, used when the caller doesn't override cardRadius.
const DEFAULT_CARD_RADIUS = 6;
// How much a selected card scales up, on top of its lift, to read as moving toward the camera.
// Exported: Batak's played-card travel animation departs from this exact scale (a played card is
// always selected/lifted at the moment of the second tap) — see TrickCenter.tsx.
export const SELECTED_SCALE = 1.05;

export function SelectableCard({
  selected = false,
  disabled,
  onPress,
  rotateDeg = 0,
  rotateAnimationDurationMs = 0,
  rotateEasing,
  marginLeft,
  liftDistance = DEFAULT_LIFT_DISTANCE,
  curveOffsetY = 0,
  hitSlop,
  ...cardProps
}: SelectableCardProps) {
  const lift = useRef(new Animated.Value(selected ? -liftDistance : 0)).current;
  const rotate = useRef(new Animated.Value(rotateDeg)).current;
  const reducedMotion = useReducedMotion();
  const dimUnplayableCards = useSettingsStore((s) => s.dimUnplayableCards);

  // Snaps (rotateAnimationDurationMs === 0, the default, or reduced motion) or eases toward a
  // changed rotateDeg — see its own doc comment. On first mount `rotate` is already initialized
  // to rotateDeg via useRef above, so this effect's initial run is a harmless no-op (animating
  // from the target value to itself).
  useEffect(() => {
    if (!rotateAnimationDurationMs || reducedMotion) {
      rotate.setValue(rotateDeg);
      return;
    }
    Animated.timing(rotate, {
      toValue: rotateDeg,
      duration: rotateAnimationDurationMs,
      easing: rotateEasing ?? Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [rotateDeg, rotateAnimationDurationMs, rotateEasing, reducedMotion, rotate]);

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

  // Reuses the same lift driver (no second Animated.Value): fully lifted (-liftDistance) maps to
  // the max scale, at rest (0) maps to 1 — so the scale-up rides the exact same native-driven
  // animation as the lift, with the same instant-select/animated-deselect timing.
  const scale = lift.interpolate({
    inputRange: [-liftDistance, 0],
    outputRange: [SELECTED_SCALE, 1],
  });

  // The lift/rotate/scale transform above is purely visual: React Native's touch responder
  // system hit-tests against the Pressable's untransformed layout box, not its transformed
  // on-screen position (a native-driven `transform`, in particular, never participates in hit
  // testing). Once selected, the card visually sits `liftDistance` px higher than that box —
  // without compensation, the box (and therefore the only place a tap actually registers) stays
  // behind at the pre-lift position, so a tap on the card's new, visible location falls through
  // to whatever's behind it (in Batak, the table's own tap-to-deselect surface) instead of
  // playing the card. Extending the box upward by liftDistance while selected covers the visible
  // card again; the caller's own hitSlop (e.g. Batak's horizontal shrink, to keep a selected card
  // from stealing a tap meant for an exposed neighbor) is preserved by spreading it last.
  const effectiveHitSlop = selected ? { top: liftDistance, ...hitSlop } : hitSlop;

  return (
    <Animated.View
      style={{
        marginLeft,
        transform: [
          {
            rotate: rotate.interpolate({
              inputRange: [-180, 180],
              outputRange: ['-180deg', '180deg'],
            }),
          },
          { translateY: Animated.add(lift, curveOffsetY) },
          { scale },
        ],
      }}
    >
      <Pressable disabled={disabled} onPress={onPress} hitSlop={effectiveHitSlop}>
        <PlayingCard {...cardProps} highlighted={selected} />
        {disabled && dimUnplayableCards && (
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
