import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { PisYedeliState, PisYedeliMove } from '../types';

export const pisYedeliEasyAI: AIStrategy<PisYedeliState, PisYedeliMove> = {
  difficulty: 'easy',
  chooseMove(_state, _playerId, legalMoves, rng) {
    return pickRandom(legalMoves, rng);
  },
};
