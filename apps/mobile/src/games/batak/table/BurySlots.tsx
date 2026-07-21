import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Card } from '@world-cards/engine';
import { PlayingCard } from '@world-cards/ui';
import { TravelCard } from '../../../table/TravelCard';

const BURY_SLOT_SIZE = 56;
// The bury slots render in the table's center panel — roughly halfway between the human's hand
// (bottom) and the vacant top slot, a smaller vertical travel distance than the ~195px
// REVEAL_ORIGIN_OFFSETS.bottom other animations use for a full hand<->seat trip. First-pass
// value; tune once running live.
const HAND_TO_SLOT_OFFSET = { x: 0, y: 140 };

export function BurySlots({
  slotCardIds,
  cardsById,
  onTapCard,
}: {
  slotCardIds: (string | null)[];
  cardsById: Map<string, Card>;
  onTapCard: (cardId: string) => void;
}) {
  return (
    <View style={styles.slotRow} testID="bury-slots">
      {slotCardIds.map((cardId, i) => {
        const card = cardId ? cardsById.get(cardId) : undefined;
        return (
          <View key={i} style={[styles.slot, card && styles.slotFilled]}>
            {card && (
              <TravelCard originOffset={HAND_TO_SLOT_OFFSET} resetKey={card.id}>
                <Pressable onPress={() => onTapCard(card.id)} accessibilityRole="button">
                  <PlayingCard card={card} size="small" />
                </Pressable>
              </TravelCard>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  slotRow: { flexDirection: 'row', gap: 10 },
  slot: {
    width: BURY_SLOT_SIZE,
    height: BURY_SLOT_SIZE,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  slotFilled: { backgroundColor: 'rgba(0, 0, 0, 0.15)', borderColor: 'rgba(255, 255, 255, 0.45)' },
});
