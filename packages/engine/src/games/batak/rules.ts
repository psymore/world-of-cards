import { RuleEngine, PlayerId, ScoreBoard } from '../../rules/types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, TableState } from '../../core/table';
import { RNG } from '../../core/rng';
import { Suit } from '../../core/types';
import { BatakState, BatakMove, BatakSetupOptions } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function makeEmptyTable(players: PlayerId[]): TableState {
  return createTable([
    ...players.map((p) => createZone(`hand-${p}`, true)),
    createZone('trick', true),
    ...players.map((p) => createZone(`won-${p}`, true)),
  ]);
}

function biddingLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (state.bids[playerId] === 'pass') return [];
  const moves: BatakMove[] = [{ type: 'pass' }];
  const minBid = Math.max(5, state.highestBid + 1);
  for (let amount = minBid; amount <= 13; amount++) {
    moves.push({ type: 'bid', amount });
  }
  return moves;
}

function trumpSelectionLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  if (playerId !== state.bidWinner) return [];
  return SUITS.map((suit) => ({ type: 'selectTrump', suit }));
}

function nextActivePlayerIndex(state: BatakState, fromIndex: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (state.bids[state.players[idx]] !== 'pass') return idx;
  }
  return fromIndex;
}

export const batakGame: RuleEngine<BatakState, BatakMove> = {
  setup(options: unknown, rng: RNG): BatakState {
    const opts = options as BatakSetupOptions;
    const { players } = opts;

    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const { table } = dealToZones(
      deck,
      makeEmptyTable(players),
      players.map((p) => ({ zoneId: `hand-${p}`, count: 13 }))
    );

    return {
      gameId: 'batak',
      players,
      currentPlayerIndex: 0,
      table,
      rngState: rng.getState(),
      status: 'in-progress',
      phase: 'bidding',
      bids: Object.fromEntries(players.map((p) => [p, null])),
      highestBid: 0,
      contract: null,
      bidWinner: null,
      trumpSuit: null,
      trumpBroken: false,
      currentTrick: [],
      trickLeader: null,
      tricksWon: Object.fromEntries(players.map((p) => [p, 0])),
    };
  },

  validateMove(state: BatakState, move: BatakMove, playerId: PlayerId): boolean {
    if (state.status !== 'in-progress') return false;
    if (state.players[state.currentPlayerIndex] !== playerId) return false;

    switch (move.type) {
      case 'bid':
        return (
          state.phase === 'bidding' &&
          state.bids[playerId] !== 'pass' &&
          move.amount >= Math.max(5, state.highestBid + 1) &&
          move.amount <= 13
        );
      case 'pass':
        return state.phase === 'bidding' && state.bids[playerId] !== 'pass';
      case 'selectTrump':
        return state.phase === 'trump-selection' && playerId === state.bidWinner;
      case 'play':
        return (
          state.phase === 'playing' &&
          batakGame.getLegalMoves(state, playerId).some((m) => m.type === 'play' && m.cardId === move.cardId)
        );
    }
  },

  performMove(state: BatakState, move: BatakMove): BatakState {
    const playerId = state.players[state.currentPlayerIndex];

    if (move.type === 'bid' || move.type === 'pass') {
      const bids = { ...state.bids, [playerId]: move.type === 'bid' ? move.amount : ('pass' as const) };
      const highestBid = move.type === 'bid' ? move.amount : state.highestBid;
      const activePlayers = state.players.filter((p) => bids[p] !== 'pass');

      // Closing early (activePlayers.length === 1) is only correct once that sole remaining
      // player has actually placed a bid. If they haven't acted yet (bids[player] === null),
      // they still need their own turn — falling through to the "advance turn" branch below
      // gives it to them, rather than crowning them winner on a bid of 0 they never made.
      if (activePlayers.length === 1 && typeof bids[activePlayers[0]] === 'number') {
        const winner = activePlayers[0];
        const contract = bids[winner] as number;
        return {
          ...state,
          bids,
          highestBid,
          contract,
          bidWinner: winner,
          phase: 'trump-selection',
          currentPlayerIndex: state.players.indexOf(winner),
        };
      }

      if (activePlayers.length === 0) {
        return {
          ...state,
          bids,
          highestBid,
          contract: 4,
          bidWinner: state.players[0],
          phase: 'trump-selection',
          currentPlayerIndex: 0,
        };
      }

      return {
        ...state,
        bids,
        highestBid,
        currentPlayerIndex: nextActivePlayerIndex({ ...state, bids }, state.currentPlayerIndex),
      };
    }

    if (move.type === 'selectTrump') {
      const winner = state.bidWinner!;
      return {
        ...state,
        trumpSuit: move.suit,
        phase: 'playing',
        trickLeader: winner,
        currentPlayerIndex: state.players.indexOf(winner),
      };
    }

    throw new Error('batakGame.performMove: play not yet implemented');
  },

  getLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
    if (state.players[state.currentPlayerIndex] !== playerId) return [];
    switch (state.phase) {
      case 'bidding':
        return biddingLegalMoves(state, playerId);
      case 'trump-selection':
        return trumpSelectionLegalMoves(state, playerId);
      case 'playing':
        throw new Error('batakGame.getLegalMoves: playing phase not yet implemented');
      case 'finished':
        return [];
    }
  },

  calculateScore(state: BatakState): ScoreBoard {
    const score: ScoreBoard = {};
    const contract = state.contract!;
    for (const p of state.players) {
      const tricks = state.tricksWon[p];
      if (p === state.bidWinner) {
        score[p] = tricks >= contract ? tricks : -contract;
      } else {
        score[p] = tricks === 0 ? -contract : tricks;
      }
    }
    return score;
  },

  determineWinner(state: BatakState): PlayerId[] | null {
    if (state.status !== 'finished') return null;
    const score = batakGame.calculateScore(state);
    const maxScore = Math.max(...state.players.map((p) => score[p]));
    return state.players.filter((p) => score[p] === maxScore);
  },

  gameOver(state: BatakState): boolean {
    return state.status === 'finished';
  },
};
