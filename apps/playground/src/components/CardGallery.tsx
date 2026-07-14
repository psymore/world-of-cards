import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card, Suit } from '@world-cards/engine';
import { PlayingCard, TableFelt, TableWoodCorners } from '@world-cards/ui';
import { usePlaygroundStore } from '../state/playgroundStore';
import { getCardGroup } from '../utils/cardGroups';
import { toPlayingCardOverrides } from '../utils/toPlayingCardOverrides';

const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const SUIT_LABELS: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  clubs: 'Clubs',
  diamonds: 'Diamonds',
};

const DECK: Card[] = createDeck({ deckCount: 1, includeJokers: false });

function cardsBySuit(suit: Suit): Card[] {
  return DECK.filter((card) => card.suit === suit);
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
                size="small"
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
