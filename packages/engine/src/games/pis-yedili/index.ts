import { GameDescriptor } from '../../registry/types';
import { registerGame } from '../../registry/registry';
import { PisYedeliState, PisYedeliMove } from './types';
import { pisYedeliGame } from './rules';
import { pisYedeliEasyAI } from './ai/easy';
import { pisYedeliMediumAI } from './ai/medium';
import { pisYedeliHardAI } from './ai/hard';

export * from './types';

export const pisYedeliDescriptor: GameDescriptor<PisYedeliState, PisYedeliMove> = {
  id: 'pis-yedili',
  displayName: 'Pis Yedili',
  category: 'draw-and-discard',
  minPlayers: 2,
  maxPlayers: 4,
  ruleEngine: pisYedeliGame,
  aiStrategies: {
    easy: pisYedeliEasyAI,
    medium: pisYedeliMediumAI,
    hard: pisYedeliHardAI,
  },
};

registerGame(pisYedeliDescriptor);
