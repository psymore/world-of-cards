import { Card, Suit, Rank } from './types';
import { RNG } from './rng';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface DeckConfig {
  deckCount: number;
  includeJokers: boolean;
}

export function createDeck(config: DeckConfig): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < config.deckCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${d}-${suit}-${rank}`, suit, rank });
      }
    }
    if (config.includeJokers) {
      cards.push({ id: `${d}-joker-1`, suit: null, rank: 'joker' });
      cards.push({ id: `${d}-joker-2`, suit: null, rank: 'joker' });
    }
  }
  return cards;
}

export function shuffle(cards: Card[], rng: RNG): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
