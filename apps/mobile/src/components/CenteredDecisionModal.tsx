import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
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

// A centered, transparent-backdrop overlay for a single in-the-moment decision (e.g. Batak's bid
// or trump-suit choice) — fades and scales its content in when it becomes visible. Deliberately
// has no dim backdrop: the underlying table stays fully visible, but this backdrop still
// intercepts every touch within its own bounds while visible, so the table reads as
// non-interactive without a visible scrim.
//
// A plain absolutely-positioned View, not RN's native `Modal` component (an earlier version used
// Modal, with a hand-rolled scale+fade entrance since Modal's own animationType only supports
// 'fade'/'slide'). Modal spawns a separate, full-screen native window above EVERYTHING else in
// the app, including this component's own ancestors — which meant it also intercepted taps on
// GameScreenLayout's header (the Exit/Settings buttons), a screen region this component was never
// meant to cover. This component is only ever rendered nested inside BatakTable's own content
// area (below the header, its only consumer — see BatakTable.tsx), so a plain absolutely-
// positioned View naturally stays scoped to that area instead — no header coverage, no
// pointerEvents workaround needed. One measurable side effect: `avoidBottomHeight`'s clearance
// math below still uses the full window height (not this backdrop's own, slightly smaller,
// below-header height) as its reference, so `effectiveRaise` is very slightly more generous than
// strictly necessary — errs toward extra clearance, never toward new overlap.
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

  if (!visible) return null;

  return (
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
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
