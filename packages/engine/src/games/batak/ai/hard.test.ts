import { createRng } from '../../../core/rng';
import { createTable, createZone, TableState } from '../../../core/table';
import { Card, Suit } from '../../../core/types';
import { batakGame, buriableCards } from '../rules';
import { BatakState } from '../types';
import { batakHardAI } from './hard';
import { batakMediumAI } from './medium';
import { chooseCardsToBury } from './handStrength';

const card = (id: string, rank: Card['rank'], suit: Suit): Card => ({ id, suit, rank });

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function makeState(overrides: Partial<BatakState> & { table: TableState }): BatakState {
  return {
    gameId: 'batak',
    players: PLAYERS,
    currentPlayerIndex: 0,
    rngState: { seed: 1 },
    status: 'in-progress',
    phase: 'bidding',
    bids: { p1: null, p2: null, p3: null, p4: null },
    highestBid: 0,
    contract: null,
    bidWinner: null,
    trumpSuit: null,
    trumpBroken: false,
    currentTrick: [],
    trickLeader: null,
    tricksWon: { p1: 0, p2: 0, p3: 0, p4: 0 },
    kittyCardIds: null,
    ...overrides,
  };
}

describe('batakHardAI', () => {
  it('bids the same as medium AI on the same hand, sharing the bid heuristic', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('s1', 'A', 'spades'),
        card('s2', 'K', 'spades'),
        card('s3', 'Q', 'spades'),
        card('s4', 'J', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({ table });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(hardMove).toEqual(mediumMove);
    expect(hardMove).toEqual({ type: 'bid', amount: 7 });
  });

  it('selects the same trump suit as medium AI on the same hand, sharing the trump heuristic', () => {
    const table = createTable([
      createZone('hand-p1', true, [
        card('h1', 'A', 'hearts'),
        card('h2', 'J', 'hearts'),
        card('s1', '2', 'spades'),
        card('s2', '3', 'spades'),
        card('s3', '4', 'spades'),
        card('s4', '5', 'spades'),
        card('s5', '6', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('hand-p4', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({
      table,
      phase: 'trump-selection',
      bids: { p1: 5, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 5,
      contract: 5,
      bidWinner: 'p1',
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(hardMove).toEqual(mediumMove);
    expect(hardMove).toEqual({ type: 'selectTrump', suit: 'spades' });
  });

  it('leads the card that wins the trick within its depth-4 search window, where a greedy one-ply heuristic leads low and loses it', () => {
    const table = createTable([
      createZone('hand-p1', true, [card('low', '2', 'hearts'), card('trump', 'A', 'spades')]),
      createZone('hand-p2', true, [card('p2c', '9', 'hearts')]),
      createZone('hand-p3', true, [card('p3c', '8', 'diamonds')]),
      createZone('hand-p4', true, [card('p4c', '7', 'clubs')]),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('won-p4', true),
    ]);
    const state = makeState({
      table,
      phase: 'playing',
      bids: { p1: 1, p2: 'pass', p3: 'pass', p4: 'pass' },
      highestBid: 1,
      contract: 1,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      trumpBroken: true,
      trickLeader: 'p1',
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    // Medium always leads its lowest legal card (nothing "currently wins" an empty trick by
    // definition) - here that loses the trick to p2's 9 of hearts. Hard's depth-4 search reads
    // out the whole trick (a full 4-ply lead-to-resolution window) and sees that leading the
    // spade Ace wins outright, since none of p2/p3/p4 hold any spades.
    expect(mediumMove).toEqual({ type: 'play', cardId: 'low' });
    expect(hardMove).toEqual({ type: 'play', cardId: 'trump' });
  });

  it('bids using the 3-player gömmeli floor, matching medium AI', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('s1', 'A', 'spades'),
        card('s2', 'K', 'spades'),
        card('s3', 'Q', 'spades'),
        card('s4', 'J', 'spades'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'bidding',
      bids: { p1: null, p2: null, p3: null },
      highestBid: 0,
      contract: null,
      bidWinner: null,
      trumpSuit: null,
      tricksWon: { p1: 0, p2: 0, p3: 0 },
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    const hardMove = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    const mediumMove = batakMediumAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(hardMove).toEqual(mediumMove);
    expect(hardMove).toEqual({ type: 'pass' });
  });

  it('discards a valid bury during kitty-exchange for a 3-player gömmeli game, never burying a kitty card', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('keepHeart', 'A', 'hearts'),
        card('keepSpade', '2', 'spades'),
        card('filler1', '2', 'clubs'),
        card('filler2', '3', 'diamonds'),
        card('filler3', '4', 'diamonds'),
        card('kitty1', '5', 'clubs'),
        card('kitty2', '6', 'clubs'),
        card('kitty3', '7', 'clubs'),
        card('kitty4', '8', 'clubs'),
      ]),
      createZone('hand-p2', true, []),
      createZone('hand-p3', true, []),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['kitty1', 'kitty2', 'kitty3', 'kitty4'],
    });
    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    expect(legalMoves).toHaveLength(5); // C(5,4) — 5 non-kitty cards remain buriable
    const move = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(batakGame.validateMove(state, move, 'p1')).toBe(true);
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      expect(move.cardIds.some((id) => id.startsWith('kitty'))).toBe(false);
    }
  });

  it('picks the bury that wins the first trick over one that loses it, where the naive chooseCardsToBury heuristic keeps the losing (weak-trump) card instead, never burying a kitty card', () => {
    const players = ['p1', 'p2', 'p3'];
    const table = createTable([
      createZone('hand-p1', true, [
        card('keepHeart', 'A', 'hearts'),
        card('keepSpade', '2', 'spades'),
        card('filler1', '2', 'clubs'),
        card('filler2', '3', 'diamonds'),
        card('filler3', '4', 'diamonds'),
        card('kitty1', '5', 'clubs'),
        card('kitty2', '6', 'clubs'),
        card('kitty3', '7', 'clubs'),
        card('kitty4', '8', 'clubs'),
      ]),
      createZone('hand-p2', true, [card('p2spade', '3', 'spades'), card('p2heart', '5', 'hearts')]),
      createZone('hand-p3', true, [card('p3club', '9', 'clubs')]),
      createZone('trick', true),
      createZone('won-p1', true),
      createZone('won-p2', true),
      createZone('won-p3', true),
      createZone('kitty', false),
      createZone('buried', false),
    ]);
    const state = makeState({
      table,
      players,
      phase: 'kitty-exchange',
      bids: { p1: 8, p2: 'pass', p3: 'pass' },
      highestBid: 8,
      contract: 8,
      bidWinner: 'p1',
      trumpSuit: 'spades',
      tricksWon: { p1: 0, p2: 0, p3: 0 },
      kittyCardIds: ['kitty1', 'kitty2', 'kitty3', 'kitty4'],
    });
    // Same trick-outcome logic as before this fix, just among 5 non-kitty candidates instead of 5
    // total cards: if p1 leads keepSpade (2♠), p2 holds a higher spade (3♠) and must follow suit
    // with it (mandatory raise), beating p1 outright. If p1 leads keepHeart (A♥) instead, p2 is
    // forced to follow with their only heart (5♥), which loses to the Ace; p3 has neither hearts
    // nor spades and plays their only card (9♣), irrelevant. Only keeping keepHeart wins the trick
    // — verified: the naive heuristic (lowest-non-trump-first, ignoring winnability) keeps
    // keepSpade instead, the losing card.
    const buriable = buriableCards(state, 'p1');
    const naiveBuried = chooseCardsToBury(buriable, 'spades', 4).map((c) => c.id);
    expect(naiveBuried.slice().sort()).toEqual(['filler1', 'filler2', 'filler3', 'keepHeart'].sort()); // naive heuristic keeps keepSpade - the losing card

    const legalMoves = batakGame.getLegalMoves(state, 'p1');
    expect(legalMoves).toHaveLength(5); // C(5,4) — 5 non-kitty cards remain buriable
    const move = batakHardAI.chooseMove(state, 'p1', legalMoves, createRng(1));
    expect(move.type).toBe('bury');
    if (move.type === 'bury') {
      // Verified via direct execution: HARD MOVE = {"type":"bury","cardIds":["keepSpade","filler1","filler2","filler3"]}
      expect(move.cardIds.slice().sort()).toEqual(['filler1', 'filler2', 'filler3', 'keepSpade'].sort());
      expect(move.cardIds.some((id) => id.startsWith('kitty'))).toBe(false);
    }
  });
});
