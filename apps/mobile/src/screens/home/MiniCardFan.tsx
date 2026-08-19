import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SuitIcon, SUIT_COLOR } from '@world-of-cards/ui';
import type { Suit } from '@world-of-cards/engine';

const FAN_SUITS: Array<{ suit: Suit; color: string }> = [
  { suit: 'spades', color: SUIT_COLOR.black },
  { suit: 'hearts', color: SUIT_COLOR.red },
  { suit: 'clubs', color: SUIT_COLOR.black },
];

export const MiniCardFan = React.memo(function MiniCardFan() {
  return (
    <View style={styles.fan}>
      {FAN_SUITS.map(({ suit, color }, index) => (
        <View key={suit} style={[styles.card, index > 0 && styles.overlap]}>
          <SuitIcon suit={suit} size={11} color={color} />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  fan: { flexDirection: 'row' },
  card: {
    width: 20,
    height: 29,
    borderRadius: 3,
    backgroundColor: '#fdfaf3',
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  overlap: { marginLeft: -11 },
});
