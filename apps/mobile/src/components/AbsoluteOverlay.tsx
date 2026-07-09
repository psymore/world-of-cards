import React from 'react';
import { StyleSheet, View } from 'react-native';

export interface AbsoluteOverlayProps {
  children: React.ReactNode;
}

// A pointer-events-none layer that fills its parent — the shared shape behind every purely
// decorative overlay (felt texture, card back pattern) so they don't each hand-roll the same
// wrapper and style object.
export function AbsoluteOverlay({ children }: AbsoluteOverlayProps) {
  return <View style={[StyleSheet.absoluteFill, styles.noPointerEvents]}>{children}</View>;
}

const styles = StyleSheet.create({
  noPointerEvents: { pointerEvents: 'none' },
});
