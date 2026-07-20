import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { BatakState, BatakMove } from '../types';
import { trickWinnerIndex, ruleConstants } from '../rules';
import { compareRanks } from '../ranking';
import { chooseTrumpSuit, estimateBidDecision, chooseCardsToBury } from './handStrength';

type PlayMove = Extract<BatakMove, { type: 'play' }>;

export const batakMediumAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'medium',
  chooseMove(state, playerId, legalMoves, rng) {
    const hand = state.table.zones[`hand-${playerId}`].cards;

    if (state.phase === 'bidding') {
      return estimateBidDecision(hand, state.highestBid, state.players.length);
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

    const trick = state.table.zones['trick'].cards;
    const playMoves = legalMoves.filter((m): m is PlayMove => m.type === 'play');
    const cardFor = (move: PlayMove) => hand.find((c) => c.id === move.cardId)!;

    const winningMoves =
      trick.length === 0
        ? []
        : playMoves.filter((move) => {
            const candidateTrick = [...trick, cardFor(move)];
            return trickWinnerIndex(candidateTrick, state.trumpSuit!) === candidateTrick.length - 1;
          });

    const pool = winningMoves.length > 0 ? winningMoves : playMoves;
    const lowest = pool.reduce((best, move) => (compareRanks(cardFor(move).rank, cardFor(best).rank) < 0 ? move : best));
    const lowestMoves = pool.filter((move) => compareRanks(cardFor(move).rank, cardFor(lowest).rank) === 0);
    return pickRandom(lowestMoves, rng);
  },
};
