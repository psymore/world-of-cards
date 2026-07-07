import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Card, Suit } from '@world-cards/engine';

export type PlayingCardSize = 'normal' | 'small';

export interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: PlayingCardSize;
}

const SUIT_GLYPH: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const RED_SUITS: Suit[] = ['hearts', 'diamonds'];

export function PlayingCard({ card, faceDown, size = 'normal' }: PlayingCardProps) {
  const dims = size === 'small' ? styles.small : styles.normal;

  if (faceDown || !card) {
    return <View testID="playing-card-back" style={[styles.card, styles.back, dims]} />;
  }

  const isRed = card.suit != null && RED_SUITS.includes(card.suit);
  const suitGlyph = card.suit != null ? SUIT_GLYPH[card.suit] : '';

  return (
    <View testID="playing-card-face" style={[styles.card, dims]}>
      <Text style={[styles.rank, isRed && styles.red]}>{card.rank}</Text>
      <Text style={[styles.suit, isRed && styles.red]}>{suitGlyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  normal: { width: 56, height: 80 },
  small: { width: 36, height: 52 },
  back: { backgroundColor: '#2f5fa8', borderColor: '#1c3a68' },
  rank: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  suit: { fontSize: 18, color: '#111' },
  red: { color: '#c0392b' },
});
