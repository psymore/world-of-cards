import { GameDescriptor } from '../../registry/types';
import { registerGame } from '../../registry/registry';
import { PistiState, PistiMove } from './types';
import { pistiGame } from './rules';
import { pistiEasyAI } from './ai/easy';
import { pistiMediumAI } from './ai/medium';
import { pistiHardAI } from './ai/hard';

export * from './types';

export const pistiDescriptor: GameDescriptor<PistiState, PistiMove> = {
  id: 'pisti',
  displayName: 'Pişti',
  category: 'fishing',
  minPlayers: 2,
  maxPlayers: 2,
  ruleEngine: pistiGame,
  aiStrategies: {
    easy: pistiEasyAI,
    medium: pistiMediumAI,
    hard: pistiHardAI,
  },
};

registerGame(pistiDescriptor);
