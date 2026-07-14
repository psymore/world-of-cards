import { AIStrategy } from '../../../ai/types';
import { minimaxChooseMove } from '../../../ai/minimax';
import { BatakState, BatakMove } from '../types';
import { batakGame } from '../rules';
import { chooseTrumpSuit, estimateBidDecision } from './handStrength';

export const batakHardAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'hard',
  chooseMove(state, playerId, legalMoves) {
    const hand = state.table.zones[`hand-${playerId}`].cards;

    if (state.phase === 'bidding') {
      return estimateBidDecision(hand, state.highestBid);
    }

    if (state.phase === 'trump-selection') {
      return { type: 'selectTrump', suit: chooseTrumpSuit(hand) };
    }

    return minimaxChooseMove(state, playerId, legalMoves, {
      ruleEngine: batakGame,
      maximizingPlayer: playerId,
      evaluate: (s) => {
        const score = batakGame.calculateScore(s);
        const opponentTotal = s.players
          .filter((p) => p !== playerId)
          .reduce((sum, p) => sum + score[p], 0);
        return score[playerId] - opponentTotal;
      },
      maxDepth: 4,
    });
  },
};
