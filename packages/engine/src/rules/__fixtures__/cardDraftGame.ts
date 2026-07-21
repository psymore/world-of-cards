import { RuleEngine, GameState, PlayerId, ScoreBoard } from '../types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, moveCard } from '../../core/table';
import { RNG } from '../../core/rng';
import { Rank } from '../../core/types';

export interface CardDraftState extends GameState {}

export type CardDraftMove = { type: 'pick'; cardId: string };

export interface CardDraftSetupOptions {
  players: [PlayerId, PlayerId];
  seed: number;
  rowSize: number;
}

const RANK_VALUES: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, joker: 0,
};

export function cardValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

export const cardDraftGame: RuleEngine<CardDraftState, CardDraftMove, CardDraftSetupOptions> = {
  setup(options: CardDraftSetupOptions, rng: RNG): CardDraftState {
    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const zoneIds = ['row', ...options.players.map((p) => `hand-${p}`)];
    const emptyTable = createTable(zoneIds.map((id) => createZone(id, true)));
    const { table } = dealToZones(deck, emptyTable, [{ zoneId: 'row', count: options.rowSize }]);
    return {
      gameId: 'card-draft-fixture',
      players: options.players,
      currentPlayerIndex: 0,
      table,
      rngState: rng.getState(),
      status: 'in-progress',
    };
  },

  validateMove(state, move, playerId) {
    if (state.status !== 'in-progress') return false;
    if (state.players[state.currentPlayerIndex] !== playerId) return false;
    return state.table.zones['row'].cards.some((c) => c.id === move.cardId);
  },

  getLegalMoves(state, playerId) {
    if (state.players[state.currentPlayerIndex] !== playerId) return [];
    return state.table.zones['row'].cards.map((card) => ({ type: 'pick', cardId: card.id }));
  },

  performMove(state, move) {
    const playerId = state.players[state.currentPlayerIndex];
    const table = moveCard(state.table, move.cardId, 'row', `hand-${playerId}`);
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const rowEmpty = table.zones['row'].cards.length === 0;
    return {
      ...state,
      table,
      currentPlayerIndex: nextIndex,
      status: rowEmpty ? 'finished' : 'in-progress',
    };
  },

  calculateScore(state) {
    const score: ScoreBoard = {};
    for (const playerId of state.players) {
      const hand = state.table.zones[`hand-${playerId}`];
      score[playerId] = hand.cards.reduce((sum, card) => sum + cardValue(card.rank), 0);
    }
    return score;
  },

  determineWinner(state) {
    if (state.status !== 'finished') return null;
    const score = cardDraftGame.calculateScore(state);
    const maxScore = Math.max(...state.players.map((p) => score[p]));
    return state.players.filter((p) => score[p] === maxScore);
  },

  gameOver(state) {
    return state.status === 'finished';
  },
};
