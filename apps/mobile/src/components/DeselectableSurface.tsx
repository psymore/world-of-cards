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
      {/* collapsable={false}: this View has no rendering-relevant properties of its own (flex/
          padding only, no backgroundColor/border), so Android's view-flattening optimizer is free
          to drop it from the real native tree — but GestureDetector attaches its native recognizer
          to this exact View instance, so if Android removes it, gesture recognition on the whole
          table becomes undefined. Required per RNGH's own GestureDetector docs. */}
      <View style={style} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}
