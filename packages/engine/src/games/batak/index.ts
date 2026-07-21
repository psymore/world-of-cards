import { GameDescriptor } from '../../registry/types';
import { registerGame } from '../../registry/registry';
import { BatakState, BatakMove } from './types';
import { batakGame } from './rules';
import { batakEasyAI } from './ai/easy';
import { batakMediumAI } from './ai/medium';
import { batakHardAI } from './ai/hard';

export * from './types';
export { compareRanks } from './ranking';
export { trickWinnerIndex, ruleConstants } from './rules';
export type { RuleConstants } from './rules';

export const batakDescriptor: GameDescriptor<BatakState, BatakMove> = {
  id: 'batak',
  displayName: 'Batak',
  category: 'trick-taking',
  minPlayers: 3,
  maxPlayers: 4,
  ruleEngine: batakGame,
  aiStrategies: {
    easy: batakEasyAI,
    medium: batakMediumAI,
    hard: batakHardAI,
  },
};

registerGame(batakDescriptor);
