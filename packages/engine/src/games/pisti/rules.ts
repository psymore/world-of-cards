import { RuleEngine, PlayerId, ScoreBoard } from '../../rules/types';
import { createDeck, shuffle } from '../../core/deck';
import { createTable, createZone, dealToZones, moveCard, moveAllCards, TableState } from '../../core/table';
import { RNG } from '../../core/rng';
import { Card } from '../../core/types';
import { PistiState, PistiMove, PistiSetupOptions } from './types';

function cardPoints(card: Card): number {
  if (card.rank === 'A' || card.rank === 'J') return 1;
  if (card.suit === 'clubs' && card.rank === '2') return 2;
  if (card.suit === 'diamonds' && card.rank === '10') return 3;
  return 0;
}

function makeEmptyTable(p0: PlayerId, p1: PlayerId): TableState {
  return createTable([
    createZone('stock', false),
    createZone('pile', 'top-only'),
    createZone(`hand-${p0}`, true),
    createZone(`hand-${p1}`, true),
    createZone(`captured-${p0}`, true),
    createZone(`captured-${p1}`, true),
  ]);
}

export const pistiGame: RuleEngine<PistiState, PistiMove> = {
  setup(options: unknown, rng: RNG): PistiState {
    const opts = options as PistiSetupOptions;
    const [p0, p1] = opts.players;

    let deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    let dealt = dealToZones(deck, makeEmptyTable(p0, p1), [{ zoneId: 'pile', count: 4 }]);
    while (dealt.table.zones['pile'].cards.some((c) => c.rank === 'J')) {
      deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
      dealt = dealToZones(deck, makeEmptyTable(p0, p1), [{ zoneId: 'pile', count: 4 }]);
    }

    const { table: tableWithHands, remainingDeck } = dealToZones(dealt.remainingDeck, dealt.table, [
      { zoneId: `hand-${p0}`, count: 4 },
      { zoneId: `hand-${p1}`, count: 4 },
    ]);

    const table: TableState = {
      ...tableWithHands,
      zones: {
        ...tableWithHands.zones,
        stock: { ...tableWithHands.zones['stock'], cards: remainingDeck },
      },
    };

    return {
      gameId: 'pisti',
      players: [p0, p1],
      currentPlayerIndex: 0,
      table,
      rngState: rng.getState(),
      status: 'in-progress',
      lastCapturedBy: null,
      pistiBonusPoints: { [p0]: 0, [p1]: 0 },
    };
  },

  validateMove(state: PistiState, move: PistiMove, playerId: PlayerId): boolean {
    if (state.status !== 'in-progress') return false;
    if (state.players[state.currentPlayerIndex] !== playerId) return false;
    return state.table.zones[`hand-${playerId}`].cards.some((c) => c.id === move.cardId);
  },

  performMove(state: PistiState, move: PistiMove): PistiState {
    const playerId = state.players[state.currentPlayerIndex];
    const handZone = `hand-${playerId}`;
    const playedCard = state.table.zones[handZone].cards.find((c) => c.id === move.cardId)!;
    const pileBefore = state.table.zones['pile'].cards;
    const pileSizeBefore = pileBefore.length;
    const topCardBefore = pileBefore[pileBefore.length - 1];

    let table = moveCard(state.table, move.cardId, handZone, 'pile');

    let captured = false;
    if (topCardBefore) {
      if (topCardBefore.rank === 'J') {
        captured = playedCard.rank === 'J';
      } else {
        captured = playedCard.rank === topCardBefore.rank || playedCard.rank === 'J';
      }
    }

    let lastCapturedBy = state.lastCapturedBy;
    let pistiBonusPoints = state.pistiBonusPoints;

    if (captured) {
      table = moveAllCards(table, 'pile', `captured-${playerId}`);
      lastCapturedBy = playerId;

      if (pileSizeBefore === 1) {
        let bonus = 0;
        if (topCardBefore.rank === 'J') {
          bonus = 20;
        } else if (playedCard.rank === topCardBefore.rank) {
          bonus = 10;
        }
        if (bonus > 0) {
          pistiBonusPoints = { ...pistiBonusPoints, [playerId]: pistiBonusPoints[playerId] + bonus };
        }
      }
    }

    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const [p0, p1] = state.players;
    const bothHandsEmpty =
      table.zones[`hand-${p0}`].cards.length === 0 && table.zones[`hand-${p1}`].cards.length === 0;

    let status = state.status;
    if (bothHandsEmpty) {
      const stock = table.zones['stock'].cards;
      if (stock.length > 0) {
        const dealt = dealToZones(stock, table, [
          { zoneId: `hand-${p0}`, count: 4 },
          { zoneId: `hand-${p1}`, count: 4 },
        ]);
        table = {
          ...dealt.table,
          zones: { ...dealt.table.zones, stock: { ...dealt.table.zones['stock'], cards: dealt.remainingDeck } },
        };
      } else {
        if (table.zones['pile'].cards.length > 0 && lastCapturedBy) {
          table = moveAllCards(table, 'pile', `captured-${lastCapturedBy}`);
        }
        status = 'finished';
      }
    }

    return {
      ...state,
      table,
      currentPlayerIndex: nextIndex,
      lastCapturedBy,
      pistiBonusPoints,
      status,
    };
  },

  getLegalMoves(state: PistiState, playerId: PlayerId): PistiMove[] {
    if (state.players[state.currentPlayerIndex] !== playerId) return [];
    return state.table.zones[`hand-${playerId}`].cards.map((card) => ({ type: 'play', cardId: card.id }));
  },

  calculateScore(state: PistiState): ScoreBoard {
    const score: ScoreBoard = {};
    const [p0, p1] = state.players;
    const captured0 = state.table.zones[`captured-${p0}`].cards;
    const captured1 = state.table.zones[`captured-${p1}`].cards;

    score[p0] = captured0.reduce((sum, c) => sum + cardPoints(c), 0) + state.pistiBonusPoints[p0];
    score[p1] = captured1.reduce((sum, c) => sum + cardPoints(c), 0) + state.pistiBonusPoints[p1];

    if (captured0.length > captured1.length) {
      score[p0] += 3;
    } else if (captured1.length > captured0.length) {
      score[p1] += 3;
    }

    return score;
  },

  determineWinner(state: PistiState): PlayerId[] | null {
    if (state.status !== 'finished') return null;
    const score = pistiGame.calculateScore(state);
    const maxScore = Math.max(...state.players.map((p) => score[p]));
    return state.players.filter((p) => score[p] === maxScore);
  },

  gameOver(state: PistiState): boolean {
    return state.status === 'finished';
  },
};
