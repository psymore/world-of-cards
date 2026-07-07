import { AIStrategy } from '../../../ai/types';
import { minimaxChooseMove } from '../../../ai/minimax';
import { PistiState, PistiMove } from '../types';
import { pistiGame } from '../rules';

export const pistiHardAI: AIStrategy<PistiState, PistiMove> = {
  difficulty: 'hard',
  chooseMove(state, playerId, legalMoves) {
    return minimaxChooseMove(state, playerId, legalMoves, {
      ruleEngine: pistiGame,
      maximizingPlayer: playerId,
      evaluate: (s) => {
        const score = pistiGame.calculateScore(s);
        const opponentTotal = s.players
          .filter((p) => p !== playerId)
          .reduce((sum, p) => sum + score[p], 0);
        return score[playerId] - opponentTotal;
      },
      maxDepth: 8,
    });
  },
};
