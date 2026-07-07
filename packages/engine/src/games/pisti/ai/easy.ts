import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { PistiState, PistiMove } from '../types';

export const pistiEasyAI: AIStrategy<PistiState, PistiMove> = {
  difficulty: 'easy',
  chooseMove(_state, _playerId, legalMoves, rng) {
    return pickRandom(legalMoves, rng);
  },
};
