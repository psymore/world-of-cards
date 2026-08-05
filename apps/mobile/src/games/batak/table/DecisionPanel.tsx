import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WOOD_TRIM_COLOR } from '@world-cards/ui';
import { PlatformWoodBackground } from './PlatformWoodBackground';

// WOOD_TRIM_COLOR at 85% opacity (matching WOOD_TRIM_STROKE_OPACITY), as an 8-digit hex-alpha
// string since this is a plain View borderColor (not an SVG stroke, which takes strokeOpacity as
// a separate prop elsewhere). 'D9' = round(0.85 * 255) in hex.
const PLATFORM_TRIM_COLOR = `${WOOD_TRIM_COLOR}D9`;

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
