import { RuleEngine, PlayerId, ScoreBoard } from '../../rules/types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, moveCard, TableState } from '../../core/table';
import { Card, Rank } from '../../core/types';
import { PisYedeliState, PisYedeliMove, PisYedeliSetupOptions } from './types';

// Used only to pick a "lowest club" starting player in setup() — Pis Yedili has no rank-comparison
// rule anywhere else in play, so this ascending order (ace counted high) is a bootstrap-only
// convention, not a reusable general rule.
const ASCENDING_RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function makeEmptyTable(players: PlayerId[]): TableState {
  return createTable([
    createZone('stock', false),
    createZone('discard', true),
    ...players.map((p) => createZone(`hand-${p}`, true)),
  ]);
}

export function findStartingPlayerIndex(players: PlayerId[], table: TableState): number {
  let bestIndex = 0;
  let bestRankValue = Infinity;
  players.forEach((p, i) => {
    for (const c of table.zones[`hand-${p}`].cards) {
      if (c.suit === 'clubs') {
        const value = ASCENDING_RANK_ORDER.indexOf(c.rank);
        if (value < bestRankValue) {
          bestRankValue = value;
          bestIndex = i;
        }
      }
    }
  });
  return bestIndex;
}

export function canDraw(table: TableState): boolean {
  if (table.zones['stock'].cards.length > 0) return true;
  return table.zones['discard'].cards.length > 1;
}

export const pisYedeliGame: RuleEngine<PisYedeliState, PisYedeliMove, PisYedeliSetupOptions> = {
  setup(options: PisYedeliSetupOptions, rng): PisYedeliState {
    const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    const { table, remainingDeck } = dealToZones(
      deck,
      makeEmptyTable(options.players),
      options.players.map((p) => ({ zoneId: `hand-${p}`, count: 7 }))
    );
    const finalTable: TableState = {
      zones: { ...table.zones, stock: { ...table.zones['stock'], cards: remainingDeck } },
    };
    return {
      gameId: 'pis-yedili',
      players: options.players,
      currentPlayerIndex: findStartingPlayerIndex(options.players, finalTable),
      table: finalTable,
      rngState: rng.getState(),
      status: 'in-progress',
      activeSuit: null,
      pendingDraw: 0,
    };
  },

  getLegalMoves(): PisYedeliMove[] {
    throw new Error('not implemented');
  },

  validateMove(): boolean {
    throw new Error('not implemented');
  },

  performMove(): PisYedeliState {
    throw new Error('not implemented');
  },

  calculateScore(state: PisYedeliState): ScoreBoard {
    const score: ScoreBoard = {};
    const winner = state.players.find((p) => state.table.zones[`hand-${p}`].cards.length === 0);
    for (const p of state.players) {
      score[p] = p === winner ? 1 : 0;
    }
    return score;
  },

  determineWinner(state: PisYedeliState): PlayerId[] | null {
    if (state.status !== 'finished') return null;
    const winner = state.players.find((p) => state.table.zones[`hand-${p}`].cards.length === 0);
    return winner ? [winner] : null;
  },

  gameOver(state: PisYedeliState): boolean {
    return state.status === 'finished';
  },
};
