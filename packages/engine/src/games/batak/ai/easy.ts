import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { BatakState, BatakMove } from '../types';
import { compareRanks } from '../ranking';
import { ruleConstants } from '../rules';
import { chooseTrumpSuit, chooseCardsToBury } from './handStrength';

type PlayMove = Extract<BatakMove, { type: 'play' }>;

export const batakEasyAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'easy',
  chooseMove(state, playerId, legalMoves, rng) {
    const hand = state.table.zones[`hand-${playerId}`].cards;

    if (state.phase === 'bidding') {
      return { type: 'pass' };
    }

    if (state.phase === 'trump-selection') {
      return { type: 'selectTrump', suit: chooseTrumpSuit(hand) };
    }

    if (state.phase === 'kitty-exchange') {
      const { kittySize } = ruleConstants(state.players.length);
      const cardIds = chooseCardsToBury(hand, state.trumpSuit!, kittySize).map((c) => c.id) as [
        string,
        string,
        string,
        string,
      ];
      return { type: 'bury', cardIds };
    }

    const playMoves = legalMoves.filter((m): m is PlayMove => m.type === 'play');
    const cardFor = (move: PlayMove) => hand.find((c) => c.id === move.cardId)!;
    const lowest = playMoves.reduce((best, move) => (compareRanks(cardFor(move).rank, cardFor(best).rank) < 0 ? move : best));
    const lowestMoves = playMoves.filter((move) => compareRanks(cardFor(move).rank, cardFor(lowest).rank) === 0);
    return pickRandom(lowestMoves, rng);
  },
};
