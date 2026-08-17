import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DISPLAY_BOLD } from '@world-cards/ui';

export const HomeWordmark = React.memo(function HomeWordmark() {
  return (
    <View style={styles.container}>
      <Text style={styles.word}>World Cards</Text>
      <View style={styles.rule} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 12 },
  word: {
    // Cinzel, matching typography.png's own "WORLD OF CARDS" display-font example almost
    // verbatim — this app's actual wordmark, replacing the pre-typography-system PTSerif-Regular.
    fontFamily: DISPLAY_BOLD,
    fontSize: 26,
    color: '#f4c542',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  rule: { width: 60, height: 1, backgroundColor: '#f4c54266', marginTop: 12 },
});
