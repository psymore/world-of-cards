import { AIStrategy } from '../../ai/types';
import { pickRandom } from '../../ai/weightedRandom';
import { CardDraftState, CardDraftMove, cardValue } from './cardDraftGame';

function cardById(state: CardDraftState, cardId: string) {
  const card = state.table.zones['row'].cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`cardById: card "${cardId}" not found in row`);
  return card;
}

export const cardDraftEasyAI: AIStrategy<CardDraftState, CardDraftMove> = {
  difficulty: 'easy',
  chooseMove(_state, _playerId, legalMoves, rng) {
    return pickRandom(legalMoves, rng);
  },
};

export const cardDraftMediumAI: AIStrategy<CardDraftState, CardDraftMove> = {
  difficulty: 'medium',
  chooseMove(state, _playerId, legalMoves, _rng) {
    return legalMoves.reduce((best, move) => {
      const bestValue = cardValue(cardById(state, best.cardId).rank);
      const moveValue = cardValue(cardById(state, move.cardId).rank);
      return moveValue > bestValue ? move : best;
    });
  },
};
