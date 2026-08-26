import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Suit } from '@world-of-cards/engine';
import { DISPLAY_BOLD, SUIT_COLOR, SuitIcon } from '@world-of-cards/ui';
import { CenteredDecisionModal } from '../../components/CenteredDecisionModal';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RED_SUITS: Suit[] = ['hearts', 'diamonds'];

function suitColor(suit: Suit): string {
  return RED_SUITS.includes(suit) ? SUIT_COLOR.red : SUIT_COLOR.black;
}

export interface PisYedeliSuitPickerModalProps {
  visible: boolean;
  onSelect: (suit: Suit) => void;
}

// No cancel affordance — same as Batak's own trump-suit picker (see BatakTable.tsx's
// TrumpSuitPicker usage): once a Jack is played, a suit must be declared, so there's nothing to
// cancel back to.
export function PisYedeliSuitPickerModal({ visible, onSelect }: PisYedeliSuitPickerModalProps) {
  return (
    <CenteredDecisionModal visible={visible}>
      <View style={styles.card}>
        <Text style={styles.title}>Choose a suit</Text>
        <View style={styles.suitRow}>
          {SUITS.map((suit) => (
            <Pressable
              key={suit}
              onPress={() => onSelect(suit)}
              style={styles.suitOption}
              testID={`pis-yedili-suit-${suit}`}>
              <SuitIcon suit={suit} size={32} color={suitColor(suit)} />
            </Pressable>
          ))}
        </View>
      </View>
    </CenteredDecisionModal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a2e1f',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: { fontFamily: DISPLAY_BOLD, fontSize: 18, color: '#f4c542', textAlign: 'center', marginBottom: 16 },
  suitRow: { flexDirection: 'row', gap: 16 },
  suitOption: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 12 },
});
