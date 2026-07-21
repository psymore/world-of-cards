import { AIStrategy } from '../../../ai/types';
import { minimaxChooseMove } from '../../../ai/minimax';
import { BatakState, BatakMove } from '../types';
import { batakGame, buriableCards, fourCardCombinations } from '../rules';
import { chooseTrumpSuit, estimateBidDecision, scoreHandForBury } from './handStrength';

const BURY_SHORTLIST_SIZE = 8;
// 1 bury move (the top-level minimaxChooseMove decision, not itself a trick-play ply) + 3
// card-play plies to fully read out one complete 3-player trick (p1 leads, p2 responds, p3
// responds) = 4 total plies. See this task's "Depth-accounting note" for why this differs from
// the design spec's original maxDepth: 3.
const BURY_LOOKAHEAD_DEPTH = 4;
// Deep enough to fully read out the rest of the current trick (up to 4 remaining plays in a
// 4-player game) but not beyond it, since Batak's card-play branching factor is far larger than
// Pişti's and searching multiple tricks ahead is not computationally justified without profiling.
const PLAY_SEARCH_DEPTH = 4;

// "Everyone else is my adversary" — the same simplification Pişti's 4-player Hard AI evaluate
// already uses. Used by the card-play search only (see trickMarginEvaluate below for why the
// bury search needs a different signal).
function marginEvaluate(playerId: string) {
  return (s: BatakState) => {
    const score = batakGame.calculateScore(s);
    const opponentTotal = s.players.filter((p) => p !== playerId).reduce((sum, p) => sum + score[p], 0);
    return score[playerId] - opponentTotal;
  };
}

// Distinct from marginEvaluate: a 1-trick-deep bury lookahead resolves at most a single trick,
// and calculateScore's contract/bust-threshold logic is quantized at a coarser grain than that —
// with a real 8+ contract and a 2-trick non-bidder bust floor, winning or losing one simulated
// trick usually doesn't change anyone's score at all (everyone is still "busted" either way),
// giving marginEvaluate no signal to compare bury candidates by. Counting tricks won directly
// gives a signal at exactly the granularity this shallow search can resolve.
function trickMarginEvaluate(playerId: string) {
  return (s: BatakState) => {
    const opponentTricks = s.players.filter((p) => p !== playerId).reduce((sum, p) => sum + s.tricksWon[p], 0);
    return s.tricksWon[playerId] - opponentTricks;
  };
}

export const batakHardAI: AIStrategy<BatakState, BatakMove> = {
  difficulty: 'hard',
  chooseMove(state, playerId, legalMoves) {
    const hand = state.table.zones[`hand-${playerId}`].cards;

    if (state.phase === 'bidding') {
      return estimateBidDecision(hand, state.highestBid, state.players.length);
    }

    if (state.phase === 'trump-selection') {
      return { type: 'selectTrump', suit: chooseTrumpSuit(hand) };
    }

    if (state.phase === 'kitty-exchange') {
      const trumpSuit = state.trumpSuit!;
      const scoredCombos = fourCardCombinations(buriableCards(state, playerId))
        .map((combo) => {
          const buriedIds = new Set(combo.map((c) => c.id));
          const resultingHand = hand.filter((c) => !buriedIds.has(c.id));
          return { combo, score: scoreHandForBury(resultingHand, trumpSuit) };
        })
        .sort((a, b) => b.score - a.score);
      const shortlist: BatakMove[] = scoredCombos.slice(0, BURY_SHORTLIST_SIZE).map(({ combo }) => ({
        type: 'bury',
        cardIds: combo.map((c) => c.id) as [string, string, string, string],
      }));
      return minimaxChooseMove(state, playerId, shortlist, {
        ruleEngine: batakGame,
        maximizingPlayer: playerId,
        evaluate: trickMarginEvaluate(playerId),
        maxDepth: BURY_LOOKAHEAD_DEPTH,
      });
    }

    return minimaxChooseMove(state, playerId, legalMoves, {
      ruleEngine: batakGame,
      maximizingPlayer: playerId,
      evaluate: marginEvaluate(playerId),
      maxDepth: PLAY_SEARCH_DEPTH,
    });
  },
};
