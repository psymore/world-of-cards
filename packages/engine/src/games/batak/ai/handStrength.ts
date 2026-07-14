import { Card, Suit } from '../../../core/types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

const TRUMP_HONOR_POINTS: Partial<Record<Card['rank'], number>> = { A: 4, K: 3, Q: 2, J: 1 };
const NON_TRUMP_HONOR_POINTS: Partial<Record<Card['rank'], number>> = { A: 2, K: 1, Q: 0, J: 0 };

function honorPoints(cards: Card[], scale: Partial<Record<Card['rank'], number>>): number {
  return cards.reduce((sum, c) => sum + (scale[c.rank] ?? 0), 0);
}

export function chooseTrumpSuit(hand: Card[]): Suit {
  let best = SUITS[0];
  let bestLength = -1;
  let bestHonors = -1;
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const length = cards.length;
    const honors = honorPoints(cards, TRUMP_HONOR_POINTS);
    if (length > bestLength || (length === bestLength && honors > bestHonors)) {
      best = suit;
      bestLength = length;
      bestHonors = honors;
    }
  }
  return best;
}

function estimateHandStrength(hand: Card[], trumpSuit: Suit): number {
  const trumpCards = hand.filter((c) => c.suit === trumpSuit);
  const trumpStrength = trumpCards.length + honorPoints(trumpCards, TRUMP_HONOR_POINTS);
  const nonTrumpStrength = SUITS.filter((suit) => suit !== trumpSuit).reduce(
    (sum, suit) => sum + honorPoints(hand.filter((c) => c.suit === suit), NON_TRUMP_HONOR_POINTS),
    0
  );
  return trumpStrength + nonTrumpStrength;
}

export function estimateBidDecision(
  hand: Card[],
  currentHighestBid: number
): { type: 'bid'; amount: number } | { type: 'pass' } {
  const trumpSuit = chooseTrumpSuit(hand);
  const totalStrength = estimateHandStrength(hand, trumpSuit);
  const estimatedTricks = Math.min(13, Math.max(0, Math.round(totalStrength / 2)));
  const minBid = Math.max(5, currentHighestBid + 1);
  if (estimatedTricks >= minBid) {
    return { type: 'bid', amount: estimatedTricks };
  }
  return { type: 'pass' };
}
