import { Card, Suit } from '../../../core/types';
import { ruleConstants } from '../rules';
import { compareRanks } from '../ranking';

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
  currentHighestBid: number,
  playerCount: number = 4
): { type: 'bid'; amount: number } | { type: 'pass' } {
  const trumpSuit = chooseTrumpSuit(hand);
  const totalStrength = estimateHandStrength(hand, trumpSuit);
  const { bidFloor, maxBid } = ruleConstants(playerCount);
  const estimatedTricks = Math.min(maxBid, Math.max(0, Math.round(totalStrength / 2)));
  const minBid = Math.max(bidFloor, currentHighestBid + 1);
  if (estimatedTricks >= minBid) {
    return { type: 'bid', amount: estimatedTricks };
  }
  return { type: 'pass' };
}

export function chooseCardsToBury(hand: Card[], trumpSuit: Suit, buryCount: number): Card[] {
  const sorted = [...hand].sort((a, b) => {
    const aIsTrump = a.suit === trumpSuit;
    const bIsTrump = b.suit === trumpSuit;
    if (aIsTrump !== bIsTrump) return aIsTrump ? 1 : -1; // non-trump sorts first (bury priority)
    return compareRanks(a.rank, b.rank); // ascending: lowest rank first within each group
  });
  return sorted.slice(0, buryCount);
}

// Deliberately subordinate to honor points (a trump Ace is worth 4, one extra length card is
// worth 0.5) — "length points": a suit held 5+ deep has latent late-trick-winning potential once
// opponents run out of it, even without honors, but it's a secondary signal, not a primary one.
const LENGTH_BONUS_WEIGHT = 0.5;

export function scoreHandForBury(hand: Card[], trumpSuit: Suit): number {
  const lengthBonus = SUITS.reduce((sum, suit) => {
    const suitLength = hand.filter((c) => c.suit === suit).length;
    return sum + Math.max(0, suitLength - 4) * LENGTH_BONUS_WEIGHT;
  }, 0);
  return estimateHandStrength(hand, trumpSuit) + lengthBonus;
}
