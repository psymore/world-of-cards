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

function makeEmptyTable(players: PlayerId[]): TableState {
  return createTable([
    createZone('stock', false),
    createZone('pile', 'top-only'),
    ...players.map((p) => createZone(`hand-${p}`, true)),
    ...players.map((p) => createZone(`captured-${p}`, true)),
  ]);
}

function handDealTargets(players: PlayerId[]): { zoneId: string; count: number }[] {
  return players.map((p) => ({ zoneId: `hand-${p}`, count: 4 }));
}

function withStock(table: TableState, remainingDeck: Card[]): TableState {
  return {
    ...table,
    zones: { ...table.zones, stock: { ...table.zones['stock'], cards: remainingDeck } },
  };
}

export const pistiGame: RuleEngine<PistiState, PistiMove, PistiSetupOptions> = {
  setup(options: PistiSetupOptions, rng: RNG): PistiState {
    const { players } = options;

    let deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
    let dealt = dealToZones(deck, makeEmptyTable(players), [{ zoneId: 'pile', count: 4 }]);
    while (dealt.table.zones['pile'].cards.some((c) => c.rank === 'J')) {
      deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
      dealt = dealToZones(deck, makeEmptyTable(players), [{ zoneId: 'pile', count: 4 }]);
    }

    const { table: tableWithHands, remainingDeck } = dealToZones(
      dealt.remainingDeck,
      dealt.table,
      handDealTargets(players)
    );

    const table: TableState = withStock(tableWithHands, remainingDeck);

    return {
      gameId: 'pisti',
      players,
      currentPlayerIndex: 0,
      table,
      rngState: rng.getState(),
      status: 'in-progress',
      lastCapturedBy: null,
      pistiBonusPoints: Object.fromEntries(players.map((p) => [p, 0])),
      teams: options.teams ?? null,
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
    const allHandsEmpty = state.players.every((p) => table.zones[`hand-${p}`].cards.length === 0);

    let status = state.status;
    if (allHandsEmpty) {
      const stock = table.zones['stock'].cards;
      if (stock.length > 0) {
        const dealt = dealToZones(stock, table, handDealTargets(state.players));
        table = withStock(dealt.table, dealt.remainingDeck);
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
    // Scoring is computed per "unit" — a team's pooled members in partnership mode, or a lone
    // player in free-for-all — so both modes share one code path. For free-for-all, each unit
    // is a single-player array, which reduces to exactly the old per-player computation.
    const units: PlayerId[][] = state.teams ?? state.players.map((p) => [p]);

    const unitCapturedCounts = units.map((unit) =>
      unit.reduce((sum, p) => sum + state.table.zones[`captured-${p}`].cards.length, 0)
    );
    const unitTotals = units.map((unit) =>
      unit.reduce((sum, p) => {
        const captured = state.table.zones[`captured-${p}`].cards;
        return sum + captured.reduce((s, c) => s + cardPoints(c), 0) + state.pistiBonusPoints[p];
      }, 0)
    );

    // Majority-capture bonus: only awarded when exactly one unit holds the most cards,
    // matching the original 2-player rule of no bonus on a tie.
    const maxCaptured = Math.max(...unitCapturedCounts);
    const leaderCount = unitCapturedCounts.filter((count) => count === maxCaptured).length;
    if (leaderCount === 1) {
      unitTotals[unitCapturedCounts.indexOf(maxCaptured)] += 3;
    }

    const score: ScoreBoard = {};
    units.forEach((unit, i) => {
      for (const p of unit) {
        score[p] = unitTotals[i];
      }
    });

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
