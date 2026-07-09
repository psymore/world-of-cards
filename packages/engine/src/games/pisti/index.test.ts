import { getGame } from '../../registry/registry';
import { pistiDescriptor } from './index';

describe('pisti registration', () => {
  it('registers pisti in the game registry with the expected shape', () => {
    expect(getGame('pisti')).toBe(pistiDescriptor);
    expect(pistiDescriptor.displayName).toBe('Pişti');
    expect(pistiDescriptor.category).toBe('fishing');
    expect(pistiDescriptor.minPlayers).toBe(2);
    expect(pistiDescriptor.maxPlayers).toBe(4);
    expect(pistiDescriptor.aiStrategies.easy.difficulty).toBe('easy');
    expect(pistiDescriptor.aiStrategies.medium.difficulty).toBe('medium');
    expect(pistiDescriptor.aiStrategies.hard.difficulty).toBe('hard');
  });
});
