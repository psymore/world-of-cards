import { AIStrategy } from '../../../ai/types';
import { pickRandom } from '../../../ai/weightedRandom';
import { PisYedeliState, PisYedeliMove } from '../types';
import { pisYedeliGame } from '../rules';

export const pisYedeliMediumAI: AIStrategy<PisYedeliState, PisYedeliMove> = {
  difficulty: 'medium',
  chooseMove(state, playerId, legalMoves, rng) {
    const hand = state.table.zones[`hand-${playerId}`].cards;
    const scored = legalMoves.map((move) => {
      const next = pisYedeliGame.performMove(state, move);
      const handSize = next.table.zones[`hand-${playerId}`].cards.length;
      const playedCard = move.type === 'play' ? hand.find((c) => c.id === move.cardId) : undefined;
      const isSpecialDump = playedCard !== undefined && (playedCard.rank === '7' || playedCard.rank === 'J');
      return { move, handSize, isSpecialDump };
    });
    const minHandSize = Math.min(...scored.map((s) => s.handSize));
    const bestBySize = scored.filter((s) => s.handSize === minHandSize);
    const hasSpecial = bestBySize.some((s) => s.isSpecialDump);
    const finalists = hasSpecial ? bestBySize.filter((s) => s.isSpecialDump) : bestBySize;
    return pickRandom(finalists.map((s) => s.move), rng);
  },
};
