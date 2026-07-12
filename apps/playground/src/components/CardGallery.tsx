import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card, Suit } from '@world-cards/engine';
import { usePlaygroundStore } from '../state/playgroundStore';
import { getCardGroup } from '../utils/cardGroups';
import { PlaygroundCard } from './PlaygroundCard';
import { TableBackdrop } from './TableBackdrop';

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
    <TableBackdrop table={table} style={styles.backdrop}>
      {SUIT_ORDER.map((suit) => (
        <View key={suit} style={styles.suitSection}>
          <Text style={styles.suitLabel}>{SUIT_LABELS[suit]}</Text>
          <View style={styles.row}>
            {cardsBySuit(suit).map((card) => (
              <PlaygroundCard
                key={card.id}
                card={card}
                template={templates[getCardGroup(card.rank)]}
                size="grid"
              />
            ))}
          </View>
        </View>
      ))}
    </TableBackdrop>
  );
}

const styles = StyleSheet.create({
  backdrop: { padding: 14 },
  suitSection: { marginBottom: 16 },
  suitLabel: { color: '#ffffff', fontWeight: 'bold', marginBottom: 8 },
  // columnGap is deliberately small (not the shared `gap`) — the grid card's 22% width in
  // PlaygroundCard.tsx already assumes a tight, fixed column gap so exactly 4 fit per row
  // even on a narrow phone viewport; a larger gap here would push the 4th card to wrap.
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 12 },
});
