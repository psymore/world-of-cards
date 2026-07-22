import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

export interface CenteredDecisionModalProps {
  visible: boolean;
  children: React.ReactNode;
  // Shifts the centered content up by this many dp (0 = today's dead-center behavior, unchanged
  // for every existing caller). An opt-in prop rather than a hardcoded shift since this component
  // is shared/general-purpose, not tied to any one caller's composition needs.
  raiseBy?: number;
  // Vertical space to always keep clear at the screen's true bottom (e.g. Batak's hand area,
  // which sits behind this modal) — the actual upward shift is the larger of `raiseBy` and
  // whatever's needed to keep the content's bottom edge clear of this reserve, so a short screen
  // gets extra clearance automatically instead of `raiseBy` alone (a flat dp value that doesn't
  // scale with screen height) letting the panel sink into that space. Defaults to 0 (today's
  // unclamped behavior) so any caller that doesn't pass it is byte-identical to before this prop
  // existed. See docs/superpowers/specs/2026-07-22-batak-decision-modal-short-screen-overlap-design.md.
  avoidBottomHeight?: number;
}

const ENTRANCE_DURATION_MS = 220;
const ENTRANCE_SCALE_FROM = 0.85;

// A centered, transparent-backdrop modal for a single in-the-moment decision (e.g. Batak's bid
// or trump-suit choice) — fades and scales its content in when it becomes visible. Deliberately
// has no dim backdrop: the underlying table stays fully visible, but RN's Modal still intercepts
// all touches to it while open, so it reads as non-interactive without a visible scrim. RN's
// built-in Modal animationType only supports 'fade'/'slide' (no scale), so the entrance is
// hand-rolled here instead of using that prop.
export function CenteredDecisionModal({
  visible,
  children,
  raiseBy = 0,
  avoidBottomHeight = 0,
}: CenteredDecisionModalProps) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: ENTRANCE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, reducedMotion, progress]);

  // How far up the dead-center position would need to shift so the content's bottom edge lands
  // exactly at (windowHeight - avoidBottomHeight) instead of sinking past it. Zero (no extra
  // clamp) whenever the screen is already tall enough for a plain raiseBy to clear it, or before
  // contentHeight's first onLayout fires (measuring a moment late is fine here — see the prop's
  // own doc comment).
  const requiredRaise =
    avoidBottomHeight > 0 ? windowHeight / 2 + contentHeight / 2 - (windowHeight - avoidBottomHeight) : 0;
  const effectiveRaise = Math.max(raiseBy, requiredRaise);

  function handleContentLayout(e: LayoutChangeEvent) {
    setContentHeight(e.nativeEvent.layout.height);
  }

  return (
    <Modal transparent animationType="none" visible={visible}>
      <View style={styles.backdrop}>
        <Animated.View
          onLayout={handleContentLayout}
          style={{
            opacity: progress,
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [ENTRANCE_SCALE_FROM, 1],
                }),
              },
              { translateY: -effectiveRaise },
            ],
          }}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
