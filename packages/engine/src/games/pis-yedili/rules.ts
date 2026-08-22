import { RuleEngine, PlayerId, ScoreBoard } from '../../rules/types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, moveCard, TableState } from '../../core/table';
import { Card, Rank, Suit } from '../../core/types';
import { PisYedeliState, PisYedeliMove, PisYedeliSetupOptions } from './types';

// Used only to pick a "lowest club" starting player in setup() — Pis Yedili has no rank-comparison
// rule anywhere else in play, so this ascending order (ace counted high) is a bootstrap-only
// convention, not a reusable general rule.
const ASCENDING_RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

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

  getLegalMoves(state: PisYedeliState, playerId: PlayerId): PisYedeliMove[] {
    if (state.status !== 'in-progress') return [];
    if (state.players[state.currentPlayerIndex] !== playerId) return [];

    const hand = state.table.zones[`hand-${playerId}`].cards;
    const discard = state.table.zones['discard'].cards;
    const drawable = canDraw(state.table);

    if (discard.length === 0) {
      const clubs = hand.filter((c) => c.suit === 'clubs');
      if (clubs.length > 0) {
        return clubs.map((c) => ({ type: 'play' as const, cardId: c.id }));
      }
      return drawable ? [{ type: 'draw' as const }] : [];
    }

    if (state.pendingDraw > 0) {
      const moves: PisYedeliMove[] = hand
        .filter((c) => c.rank === '7')
        .map((c) => ({ type: 'play' as const, cardId: c.id }));
      if (drawable) moves.push({ type: 'draw' });
      if (moves.length === 0) moves.push({ type: 'pass' });
      return moves;
    }

    const topRank = discard[discard.length - 1].rank;
    const moves: PisYedeliMove[] = [];
    for (const c of hand) {
      if (c.rank === 'J') {
        for (const suit of SUITS) {
          moves.push({ type: 'play', cardId: c.id, declaredSuit: suit });
        }
      } else if (c.rank === '7' || c.suit === state.activeSuit || c.rank === topRank) {
        moves.push({ type: 'play', cardId: c.id });
      }
    }
    if (drawable) moves.push({ type: 'draw' });
    if (!moves.some((m) => m.type === 'play')) moves.push({ type: 'pass' });
    return moves;
  },

  validateMove(state: PisYedeliState, move: PisYedeliMove, playerId: PlayerId): boolean {
    if (state.status !== 'in-progress') return false;
    if (state.players[state.currentPlayerIndex] !== playerId) return false;
    const legal = pisYedeliGame.getLegalMoves(state, playerId);
    if (move.type === 'play') {
      return legal.some(
        (m) => m.type === 'play' && m.cardId === move.cardId && m.declaredSuit === move.declaredSuit
      );
    }
    return legal.some((m) => m.type === move.type);
  },

  performMove(state: PisYedeliState, move: PisYedeliMove): PisYedeliState {
    const playerId = state.players[state.currentPlayerIndex];
    const playerCount = state.players.length;

    if (move.type === 'pass') {
      return { ...state, currentPlayerIndex: (state.currentPlayerIndex + 1) % playerCount };
    }

    if (move.type === 'draw') {
      let table = state.table;
      if (table.zones['stock'].cards.length === 0) {
        const discardCards = table.zones['discard'].cards;
        const top = discardCards[discardCards.length - 1];
        const rest = discardCards.slice(0, -1).reverse();
        table = {
          zones: {
            ...table.zones,
            discard: { ...table.zones['discard'], cards: [top] },
            stock: { ...table.zones['stock'], cards: rest },
          },
        };
      }
      const stockCards = table.zones['stock'].cards;
      const drawnCard = stockCards[stockCards.length - 1];
      table = moveCard(table, drawnCard.id, 'stock', `hand-${playerId}`);
      return { ...state, table, pendingDraw: state.pendingDraw > 0 ? state.pendingDraw - 1 : 0 };
    }

    const handZone = `hand-${playerId}`;
    const playedCard = state.table.zones[handZone].cards.find((c) => c.id === move.cardId)!;
    const table = moveCard(state.table, move.cardId, handZone, 'discard');
    const activeSuit = playedCard.rank === 'J' ? move.declaredSuit! : playedCard.suit!;
    const pendingDraw = playedCard.rank === '7' ? state.pendingDraw + 2 : 0;
    const advance = playedCard.rank === 'J' ? 2 : 1;
    const nextIndex = (state.currentPlayerIndex + advance) % playerCount;
    const handEmpty = table.zones[handZone].cards.length === 0;

    return {
      ...state,
      table,
      activeSuit,
      pendingDraw,
      currentPlayerIndex: nextIndex,
      status: handEmpty ? 'finished' : 'in-progress',
    };
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
