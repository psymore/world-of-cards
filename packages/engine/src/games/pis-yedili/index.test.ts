import { getGame } from '../../registry/registry';
import { pisYedeliDescriptor } from './index';

describe('pis-yedili registration', () => {
  it('registers pis-yedili in the game registry with the expected shape', () => {
    expect(getGame('pis-yedili')).toBe(pisYedeliDescriptor);
    expect(pisYedeliDescriptor.displayName).toBe('Pis Yedili');
    expect(pisYedeliDescriptor.category).toBe('draw-and-discard');
    expect(pisYedeliDescriptor.minPlayers).toBe(2);
    expect(pisYedeliDescriptor.maxPlayers).toBe(4);
    expect(pisYedeliDescriptor.aiStrategies.easy.difficulty).toBe('easy');
    expect(pisYedeliDescriptor.aiStrategies.medium.difficulty).toBe('medium');
    expect(pisYedeliDescriptor.aiStrategies.hard.difficulty).toBe('hard');
  });
});
