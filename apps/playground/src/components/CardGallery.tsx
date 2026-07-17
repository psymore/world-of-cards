import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Card, Suit } from '@world-cards/engine';
import { PlayingCard, TableFelt, TableWoodCorners } from '@world-cards/ui';
import { usePlaygroundStore } from '../state/playgroundStore';
import { getCardGroup, SUIT_LABELS } from '../utils/cardGroups';
import { ORDERED_DECK } from '../utils/orderedDeck';
import { toPlayingCardOverrides } from '../utils/toPlayingCardOverrides';

const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

function cardsBySuit(suit: Suit): Card[] {
  return ORDERED_DECK.filter((card) => card.suit === suit);
}

export function CardGallery() {
  const templates = usePlaygroundStore((state) => state.templates);
  const table = usePlaygroundStore((state) => state.table);

  return (
    <View style={[styles.backdrop, { backgroundColor: table.feltColor }]}>
      <TableFelt />
      <TableWoodCorners woodColor={table.woodColor} />
      {SUIT_ORDER.map((suit) => (
        <View key={suit} style={styles.suitSection}>
          <Text style={styles.suitLabel}>{SUIT_LABELS[suit]}</Text>
          <View style={styles.row}>
            {cardsBySuit(suit).map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="normal"
                {...toPlayingCardOverrides(templates[getCardGroup(card.rank)])}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'relative', overflow: 'hidden', padding: 14 },
  suitSection: { marginBottom: 16 },
  suitLabel: { color: '#ffffff', fontWeight: 'bold', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 12 },
});
