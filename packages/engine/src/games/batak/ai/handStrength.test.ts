import { Card, Suit } from '../../../core/types';
import { chooseTrumpSuit, estimateBidDecision } from './handStrength';

const card = (id: string, rank: Card['rank'], suit: Suit): Card => ({ id, suit, rank });

describe('chooseTrumpSuit', () => {
  it('chooses the longer suit over a shorter suit holding an Ace and a Jack', () => {
    const hand: Card[] = [
      card('h1', 'A', 'hearts'),
      card('h2', 'J', 'hearts'),
      card('s1', '2', 'spades'),
      card('s2', '3', 'spades'),
      card('s3', '4', 'spades'),
      card('s4', '5', 'spades'),
      card('s5', '6', 'spades'),
    ];
    expect(chooseTrumpSuit(hand)).toBe('spades');
  });

  it('chooses the longer suit even over a shorter suit holding all four honors', () => {
    const hand: Card[] = [
      card('h1', 'A', 'hearts'),
      card('h2', 'K', 'hearts'),
      card('h3', 'Q', 'hearts'),
      card('h4', 'J', 'hearts'),
      card('s1', '2', 'spades'),
      card('s2', '3', 'spades'),
      card('s3', '4', 'spades'),
      card('s4', '5', 'spades'),
      card('s5', '6', 'spades'),
    ];
    expect(chooseTrumpSuit(hand)).toBe('spades');
  });

  it('breaks ties between equal-length suits by honor points', () => {
    const hand: Card[] = [
      card('h1', '2', 'hearts'),
      card('h2', '3', 'hearts'),
      card('h3', '4', 'hearts'),
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
    ];
    expect(chooseTrumpSuit(hand)).toBe('spades');
  });
});

describe('estimateBidDecision', () => {
  it('bids the estimated trick count when it clears the minimum', () => {
    const hand: Card[] = [
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
      card('s4', 'J', 'spades'),
    ];
    // trump strength = 4 (length) + 10 (A+K+Q+J honors) = 14 -> estimatedTricks = round(14/2) = 7
    expect(estimateBidDecision(hand, 0)).toEqual({ type: 'bid', amount: 7 });
  });

  it('passes when the estimated trick count does not clear the minimum', () => {
    const hand: Card[] = [card('c1', '2', 'clubs'), card('c2', '3', 'clubs'), card('d1', '4', 'diamonds')];
    expect(estimateBidDecision(hand, 0)).toEqual({ type: 'pass' });
  });

  it('raises its required minimum to beat the current highest bid', () => {
    const hand: Card[] = [
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
      card('s4', 'J', 'spades'),
    ];
    // estimatedTricks is 7 (see above): clears a highest bid of 6 (minimum becomes 7)...
    expect(estimateBidDecision(hand, 6)).toEqual({ type: 'bid', amount: 7 });
    // ...but not a highest bid of 7 (minimum becomes 8, which the hand can't clear)
    expect(estimateBidDecision(hand, 7)).toEqual({ type: 'pass' });
  });

  it('values the same honor cards far more highly when they are in the trump suit', () => {
    const trumpHonorsHand: Card[] = [
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
      card('s4', 'J', 'spades'),
    ];
    const nonTrumpHonorsHand: Card[] = [
      card('h1', 'A', 'hearts'),
      card('h2', 'K', 'hearts'),
      card('h3', 'Q', 'hearts'),
      card('h4', 'J', 'hearts'),
      card('s1', '2', 'spades'),
      card('s2', '3', 'spades'),
      card('s3', '4', 'spades'),
      card('s4', '5', 'spades'),
      card('s5', '6', 'spades'),
    ];
    // Same AKQJ ranks: full trump-honor value drives a bid, discounted non-trump value doesn't.
    expect(estimateBidDecision(trumpHonorsHand, 0)).toEqual({ type: 'bid', amount: 7 });
    expect(estimateBidDecision(nonTrumpHonorsHand, 0)).toEqual({ type: 'pass' });
  });
});
