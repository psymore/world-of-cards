import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export interface DeselectableSurfaceProps {
  onDeselect: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Wraps a game table's root content so tapping anywhere without a more specific tappable child
// (a card, a bid button, a suit picker) clears the current card selection.
//
// Uses react-native-gesture-handler's Gesture.Tap(), not a plain Pressable — a plain Pressable
// ancestor racing against a react-native-gesture-handler GestureDetector descendant (e.g. Batak's
// BatakHandCard, migrated to Gesture.Tap() for its rail-fan reflow) is an unsupported combination:
// RN's classic touch-responder negotiation and RNGH's native gesture recognizers don't arbitrate
// against each other, so the outer Pressable can unpredictably win the touch before the
// descendant's gesture ever fires — the observed symptom was cards needing several taps before a
// play registered. RNGH gesture ancestors correctly defer to nested Pressable/Touchable
// descendants (still true for Pişti's Pressable-based SelectableCard), so this direction is safe
// for both games.
export function DeselectableSurface({ onDeselect, style, children }: DeselectableSurfaceProps) {
  const tap = Gesture.Tap().onEnd((_event, success) => {
    if (success) runOnJS(onDeselect)();
  });

  return (
    <GestureDetector gesture={tap}>
      <View style={style}>{children}</View>
    </GestureDetector>
  );
}
