import React from 'react';
import { Pressable, PressableProps, StyleSheet, View } from 'react-native';

export interface PressableFeedbackProps extends PressableProps {
  // Matches the caller's own button corner radius so the press overlay's edges align with it.
  // Defaults to 0 (square) for callers with no rounding.
  overlayBorderRadius?: number;
}

// Drop-in Pressable replacement adding a shared press-feedback "blacken" cue: while pressed, a
// semi-transparent black layer overlays `children`, giving every button in the app the same
// tactile click confirmation instead of each one inventing its own (or having none at all).
// Does NOT force `overflow: 'hidden'` on the wrapping Pressable itself — an earlier draft did,
// which clipped BidControls.tsx's BidButton drop shadow (a same-size sibling view). The overlay
// carries its own borderRadius instead, so it never needs to touch the caller's own overflow.
export function PressableFeedback({
  style,
  children,
  overlayBorderRadius = 0,
  ...rest
}: PressableFeedbackProps) {
  return (
    <Pressable style={style} {...rest}>
      {(state) => (
        <>
          {typeof children === 'function' ? children(state) : children}
          {state.pressed && (
            <View
              style={[styles.overlay, { borderRadius: overlayBorderRadius }]}
              pointerEvents="none"
            />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
});
