import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';

export interface DeselectableSurfaceProps {
  onDeselect: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Wraps a game table's root content so tapping anywhere without a more specific Pressable
// (a card, a bid button, a suit picker) clears the current card selection. Nested Pressables
// claim their own taps first via RN's normal touch-responder negotiation, so this only fires
// on genuinely empty table space.
export function DeselectableSurface({ onDeselect, style, children }: DeselectableSurfaceProps) {
  return (
    <Pressable style={style} onPress={onDeselect}>
      {children}
    </Pressable>
  );
}
