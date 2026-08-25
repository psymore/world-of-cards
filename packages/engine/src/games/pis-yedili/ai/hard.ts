import { AIStrategy } from '../../../ai/types';
import { minimaxChooseMove } from '../../../ai/minimax';
import { PisYedeliState, PisYedeliMove } from '../types';
import { pisYedeliGame } from '../rules';

export const pisYedeliHardAI: AIStrategy<PisYedeliState, PisYedeliMove> = {
  difficulty: 'hard',
  chooseMove(state, playerId, legalMoves) {
    return minimaxChooseMove(state, playerId, legalMoves, {
      ruleEngine: pisYedeliGame,
      maximizingPlayer: playerId,
      evaluate: (s) => {
        const ownHandSize = s.table.zones[`hand-${playerId}`].cards.length;
        const opponentsHandSize = s.players
          .filter((p) => p !== playerId)
          .reduce((sum, p) => sum + s.table.zones[`hand-${p}`].cards.length, 0);
        return opponentsHandSize - ownHandSize;
      },
      maxDepth: 5,
    });
  },
};
