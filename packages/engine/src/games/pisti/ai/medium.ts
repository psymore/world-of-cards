import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { PistiState, PistiMove } from '../types';
import { pistiGame } from '../rules';

export const pistiMediumAI: AIStrategy<PistiState, PistiMove> = {
  difficulty: 'medium',
  chooseMove(state, playerId, legalMoves, rng) {
    const before = pistiGame.calculateScore(state)[playerId];
    const scores = legalMoves.map((move) => {
      const after = pistiGame.calculateScore(pistiGame.performMove(state, move))[playerId];
      return after - before;
    });
    const maxScore = Math.max(...scores);
    const bestMoves = legalMoves.filter((_, i) => scores[i] === maxScore);
    return pickRandom(bestMoves, rng);
  },
};
