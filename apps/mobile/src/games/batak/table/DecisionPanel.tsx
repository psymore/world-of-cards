import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PlatformWoodBackground } from './PlatformWoodBackground';

// WOOD_TRIM_COLOR (#ffd966) at 85% opacity, as an rgba literal since this is a plain View
// borderColor (not an SVG stroke, which takes strokeOpacity as a separate prop elsewhere).
const PLATFORM_TRIM_COLOR = 'rgba(255, 217, 102, 0.85)';

// Raises the panel above CenteredDecisionModal's default dead-center resting spot, per the
// approved mockup — pass to CenteredDecisionModal's own `raiseBy` prop alongside a DecisionPanel.
export const PLATFORM_RAISE_BY = 40;

// The shared wooden decision-panel shell for Batak's bid grid and trump-suit picker — both wrap
// their own content in the same modalCard + PlatformWoodBackground pairing, so they read as one
// cohesive wooden-table identity instead of two separately-styled cards.
export function DecisionPanel({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return (
    <View style={styles.modalCard} testID={testID}>
      <PlatformWoodBackground />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The wood-grain fill (PlatformWoodBackground, rendered as this View's first child) needs
  // overflow:'hidden' to clip to the rounded corners.
  modalCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PLATFORM_TRIM_COLOR,
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxWidth: 320,
    alignItems: 'center',
    overflow: 'hidden',
  },
});
