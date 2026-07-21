import { getGame } from '../../registry/registry';
import { batakDescriptor } from './index';

describe('batak registration', () => {
  it('registers batak in the game registry with the expected shape', () => {
    expect(getGame('batak')).toBe(batakDescriptor);
    expect(batakDescriptor.displayName).toBe('Batak');
    expect(batakDescriptor.category).toBe('trick-taking');
    expect(batakDescriptor.minPlayers).toBe(3);
    expect(batakDescriptor.maxPlayers).toBe(4);
    expect(batakDescriptor.aiStrategies.easy.difficulty).toBe('easy');
    expect(batakDescriptor.aiStrategies.medium.difficulty).toBe('medium');
    expect(batakDescriptor.aiStrategies.hard.difficulty).toBe('hard');
  });
});
