import { asyncStorageAdapter } from './asyncStorageAdapter';

describe('asyncStorageAdapter', () => {
  it('round-trips a value through save/load', async () => {
    await asyncStorageAdapter.save('test-key', { count: 3 });
    const loaded = await asyncStorageAdapter.load<{ count: number }>('test-key');
    expect(loaded).toEqual({ count: 3 });
  });

  it('returns null for a key that was never saved', async () => {
    const loaded = await asyncStorageAdapter.load('never-saved');
    expect(loaded).toBeNull();
  });

  it('removes a saved value', async () => {
    await asyncStorageAdapter.save('to-remove', { value: 1 });
    await asyncStorageAdapter.remove('to-remove');
    const loaded = await asyncStorageAdapter.load('to-remove');
    expect(loaded).toBeNull();
  });
});
