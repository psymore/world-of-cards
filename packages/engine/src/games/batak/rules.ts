import { RuleEngine, PlayerId, ScoreBoard } from '../../rules/types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, moveCard, moveAllCards, TableState } from '../../core/table';
import { RNG } from '../../core/rng';
import { Card, Suit } from '../../core/types';
import { BatakState, BatakMove, BatakSetupOptions } from './types';
import { compareRanks } from './ranking';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

interface RuleConstants {
  handSize: number;
  kittySize: number;
  bidFloor: number;
  maxBid: number;
  forcedContract: number;
  bustThreshold: number;
}

function ruleConstants(playerCount: number): RuleConstants {
  return playerCount === 3
    ? { handSize: 16, kittySize: 4, bidFloor: 8, maxBid: 16, forcedContract: 7, bustThreshold: 2 }
    : { handSize: 13, kittySize: 0, bidFloor: 5, maxBid: 13, forcedContract: 4, bustThreshold: 1 };
}

function makeEmptyTable(players: PlayerId[]): TableState {
  const { kittySize } = ruleConstants(players.length);
  return createTable([
    ...players.map((p) => createZone(`hand-${p}`, true)),
    createZone('trick', true),
    ...players.map((p) => createZone(`won-${p}`, true)),
    ...(kittySize > 0 ? [createZone('kitty', false), createZone('buried', false)] : []),
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

function playingLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
  const hand = state.table.zones[`hand-${playerId}`].cards;
  const trick = state.table.zones['trick'].cards;
  const trumpSuit = state.trumpSuit!;

  if (trick.length === 0) {
    const nonTrump = hand.filter((c) => c.suit !== trumpSuit);
    const canLeadTrump = state.trumpBroken || nonTrump.length === 0;
    const eligible = canLeadTrump ? hand : nonTrump;
    return eligible.map((c) => ({ type: 'play', cardId: c.id }));
  }

  const ledSuit = trick[0].suit;
  const ofLedSuit = hand.filter((c) => c.suit === ledSuit);

  if (ofLedSuit.length > 0) {
    const highestInTrick = trick
      .filter((c) => c.suit === ledSuit)
      .reduce((best, c) => (compareRanks(c.rank, best.rank) > 0 ? c : best));
    const higher = ofLedSuit.filter((c) => compareRanks(c.rank, highestInTrick.rank) > 0);
    const eligible = higher.length > 0 ? higher : ofLedSuit;
    return eligible.map((c) => ({ type: 'play', cardId: c.id }));
  }

  return hand.map((c) => ({ type: 'play', cardId: c.id }));
}

export function trickWinnerIndex(trick: Card[], trumpSuit: Suit): number {
  const ledSuit = trick[0].suit;
  const trumps = trick.filter((c) => c.suit === trumpSuit);
  const candidates = trumps.length > 0 ? trumps : trick.filter((c) => c.suit === ledSuit);
  const winningCard = candidates.reduce((best, c) => (compareRanks(c.rank, best.rank) > 0 ? c : best));
  return trick.indexOf(winningCard);
}

export const batakGame: RuleEngine<BatakState, BatakMove> = {
  setup(options: unknown, rng: RNG): BatakState {
    const opts = options as BatakSetupOptions;
    const { players } = opts;
    const { handSize, kittySize } = ruleConstants(players.length);

    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const { table } = dealToZones(deck, makeEmptyTable(players), [
      ...players.map((p) => ({ zoneId: `hand-${p}`, count: handSize })),
      ...(kittySize > 0 ? [{ zoneId: 'kitty', count: kittySize }] : []),
    ]);

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
      kittyCardIds: null,
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

    const handZone = `hand-${playerId}`;
    const playedCard = state.table.zones[handZone].cards.find((c) => c.id === move.cardId)!;
    let table = moveCard(state.table, move.cardId, handZone, 'trick');
    const currentTrick = [...state.currentTrick, { playerId, cardId: move.cardId }];
    const trumpBroken = state.trumpBroken || playedCard.suit === state.trumpSuit;

    if (currentTrick.length < state.players.length) {
      return {
        ...state,
        table,
        currentTrick,
        trumpBroken,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
      };
    }

    const trickCards = table.zones['trick'].cards;
    const winnerPos = trickWinnerIndex(trickCards, state.trumpSuit!);
    const winner = currentTrick[winnerPos].playerId;

    table = moveAllCards(table, 'trick', `won-${winner}`);
    const tricksWon = { ...state.tricksWon, [winner]: state.tricksWon[winner] + 1 };
    const handsEmpty = state.players.every((p) => table.zones[`hand-${p}`].cards.length === 0);

    return {
      ...state,
      table,
      currentTrick: [],
      trumpBroken,
      tricksWon,
      trickLeader: winner,
      currentPlayerIndex: state.players.indexOf(winner),
      phase: handsEmpty ? 'finished' : state.phase,
      status: handsEmpty ? 'finished' : state.status,
    };
  },

  getLegalMoves(state: BatakState, playerId: PlayerId): BatakMove[] {
    if (state.players[state.currentPlayerIndex] !== playerId) return [];
    switch (state.phase) {
      case 'bidding':
        return biddingLegalMoves(state, playerId);
      case 'trump-selection':
        return trumpSelectionLegalMoves(state, playerId);
      case 'playing':
        return playingLegalMoves(state, playerId);
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
