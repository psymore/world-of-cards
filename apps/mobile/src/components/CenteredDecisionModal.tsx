import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

export interface CenteredDecisionModalProps {
  visible: boolean;
  children: React.ReactNode;
  // Shifts the centered content up by this many dp (0 = today's dead-center behavior, unchanged
  // for every existing caller). An opt-in prop rather than a hardcoded shift since this component
  // is shared/general-purpose, not tied to any one caller's composition needs.
  raiseBy?: number;
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
}: CenteredDecisionModalProps) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const reducedMotion = useReducedMotion();

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

  return (
    <Modal transparent animationType="none" visible={visible}>
      <View style={styles.backdrop}>
        <Animated.View
          style={{
            opacity: progress,
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [ENTRANCE_SCALE_FROM, 1],
                }),
              },
              { translateY: -raiseBy },
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
