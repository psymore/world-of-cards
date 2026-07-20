import { Card, Suit } from '../../../core/types';
import { chooseTrumpSuit, estimateBidDecision, chooseCardsToBury, scoreHandForBury } from './handStrength';

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

  it('uses the 3-player gömmeli bid floor of 8 instead of the 4-player floor of 5, given the same hand', () => {
    const hand: Card[] = [
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
      card('s4', 'J', 'spades'),
    ];
    // trump strength = 4 (length) + 10 (A+K+Q+J honors) = 14 -> estimatedTricks = round(14/2) = 7,
    // the same hand as the very first test in this file. 7 clears the 4-player floor of 5 but not
    // the 3-player gömmeli floor of 8.
    expect(estimateBidDecision(hand, 0, 4)).toEqual({ type: 'bid', amount: 7 });
    expect(estimateBidDecision(hand, 0, 3)).toEqual({ type: 'pass' });
  });

  it('caps the bid at 13 for 4-player games but 16 for 3-player gömmeli games, given the same very strong hand', () => {
    const hand: Card[] = [
      card('s1', 'A', 'spades'),
      card('s2', 'K', 'spades'),
      card('s3', 'Q', 'spades'),
      card('s4', 'J', 'spades'),
      card('s5', '10', 'spades'),
      card('s6', '9', 'spades'),
      card('s7', '8', 'spades'),
      card('s8', '7', 'spades'),
      card('s9', '6', 'spades'),
      card('s10', '5', 'spades'),
      card('s11', '4', 'spades'),
      card('s12', '3', 'spades'),
      card('h1', 'A', 'hearts'),
      card('h2', 'K', 'hearts'),
      card('d1', 'A', 'diamonds'),
      card('d2', 'K', 'diamonds'),
    ];
    // trump (12 spades incl. AKQJ): strength = 12 (length) + 10 (honors) = 22
    // non-trump: hearts A+K = 2+1 = 3, diamonds A+K = 2+1 = 3 -> +6
    // totalStrength = 28 -> uncapped estimatedTricks = round(28/2) = 14
    expect(estimateBidDecision(hand, 0, 4)).toEqual({ type: 'bid', amount: 13 }); // 4-player cap
    expect(estimateBidDecision(hand, 0, 3)).toEqual({ type: 'bid', amount: 14 }); // 3-player, uncapped by the old 13-limit
    expect(estimateBidDecision(hand, 0)).toEqual({ type: 'bid', amount: 13 }); // default playerCount is still 4
  });
});

describe('chooseCardsToBury', () => {
  it('discards the lowest-rank non-trump cards before touching any trump card', () => {
    const hand: Card[] = [
      card('trumpLow', '2', 'spades'),
      card('trumpHigh', 'A', 'spades'),
      card('nt1', '2', 'hearts'),
      card('nt2', '5', 'hearts'),
      card('nt3', '9', 'diamonds'),
      card('nt4', 'K', 'clubs'),
    ];
    const buried = chooseCardsToBury(hand, 'spades', 4);
    expect(buried.map((c) => c.id).sort()).toEqual(['nt1', 'nt2', 'nt3', 'nt4'].sort());
  });

  it('discards non-trump cards in ascending rank order when there are more than buryCount of them', () => {
    const hand: Card[] = [
      card('nt1', '2', 'hearts'),
      card('nt2', '5', 'hearts'),
      card('nt3', '9', 'diamonds'),
      card('nt4', 'K', 'clubs'),
      card('nt5', 'A', 'clubs'),
    ];
    const buried = chooseCardsToBury(hand, 'spades', 4);
    // nt5 (Ace) is the highest-ranked non-trump card and is kept; the 4 lowest are buried.
    expect(buried.map((c) => c.id).sort()).toEqual(['nt1', 'nt2', 'nt3', 'nt4'].sort());
  });

  it('falls back to the lowest-rank trump cards once non-trump cards run out', () => {
    const hand: Card[] = [
      card('nt1', '2', 'hearts'),
      card('nt2', '5', 'diamonds'),
      card('trumpLow', '3', 'spades'),
      card('trumpMid', '9', 'spades'),
      card('trumpHigh1', 'K', 'spades'),
      card('trumpHigh2', 'A', 'spades'),
    ];
    const buried = chooseCardsToBury(hand, 'spades', 4);
    // Only 2 non-trump cards exist; the other 2 buried slots come from trump, lowest rank first
    // (trumpLow, trumpMid), keeping the two trump honors (K, A).
    expect(buried.map((c) => c.id).sort()).toEqual(['nt1', 'nt2', 'trumpLow', 'trumpMid'].sort());
  });
});

describe('scoreHandForBury', () => {
  it('scores a hand with a 5-card suit higher than an otherwise-identical hand with only 4 cards in that suit', () => {
    const trumpSuit: Suit = 'spades';
    const fiveCardSuitHand: Card[] = [
      card('h1', '2', 'hearts'),
      card('h2', '3', 'hearts'),
      card('h3', '4', 'hearts'),
      card('h4', '5', 'hearts'),
      card('h5', '6', 'hearts'),
    ];
    const fourCardSuitHand: Card[] = [
      card('h1', '2', 'hearts'),
      card('h2', '3', 'hearts'),
      card('h3', '4', 'hearts'),
      card('h4', '5', 'hearts'),
    ];
    expect(scoreHandForBury(fiveCardSuitHand, trumpSuit)).toBeGreaterThan(scoreHandForBury(fourCardSuitHand, trumpSuit));
  });

  it('weighs the length bonus below a single honor point, so an extra honor always outscores an extra length card', () => {
    const trumpSuit: Suit = 'spades';
    const handWithHonor: Card[] = [
      card('h1', '2', 'hearts'),
      card('h2', '3', 'hearts'),
      card('h3', '4', 'hearts'),
      card('h4', 'K', 'hearts'),
      card('h5', '5', 'hearts'), // 5th heart -> +0.5 length bonus, plus the King's 1 honor point
    ];
    const handWithLength: Card[] = [
      card('h1', '2', 'hearts'),
      card('h2', '3', 'hearts'),
      card('h3', '4', 'hearts'),
      card('h4', '6', 'hearts'),
      card('h5', '5', 'hearts'),
      card('h6', '7', 'hearts'), // 6th heart -> +1.0 length bonus, but no honor cards at all
    ];
    // handWithHonor: 1 honor point (K) + 0.5 length bonus = 1.5
    // handWithLength: 0 honor points + 1.0 length bonus = 1.0
    expect(scoreHandForBury(handWithHonor, trumpSuit)).toBeGreaterThan(scoreHandForBury(handWithLength, trumpSuit));
  });
});
