import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { AbsoluteOverlay } from './AbsoluteOverlay';

const GEMINI_TABLE_IMAGE = require('../assets/table/gemini-table-design.jpeg');

// A dev-tuning alternative to TableFelt's green photo texture, for on-device A/B comparison via
// Batak's __DEV__-gated tuning panel (apps/mobile/src/games/batak/BatakDevTuningModal.tsx). Same
// shape as TableFelt: pure decoration, no props, painted once.
function GeminiTableBackgroundComponent() {
  return (
    <AbsoluteOverlay>
      <Image source={GEMINI_TABLE_IMAGE} style={styles.image} resizeMode="cover" />
    </AbsoluteOverlay>
  );
}

export const GeminiTableBackground = React.memo(GeminiTableBackgroundComponent);

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});
