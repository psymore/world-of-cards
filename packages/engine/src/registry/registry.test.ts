import { registerGame, getGames, getGame, clearRegistry } from './registry';
import { cardDraftGame } from '../rules/__fixtures__/cardDraftGame';
import { cardDraftEasyAI, cardDraftMediumAI, cardDraftHardAI } from '../rules/__fixtures__/cardDraftGame.ai';

const descriptor = {
  id: 'card-draft-fixture',
  displayName: 'Card Draft (fixture)',
  category: 'other' as const,
  minPlayers: 2,
  maxPlayers: 2,
  ruleEngine: cardDraftGame,
  aiStrategies: { easy: cardDraftEasyAI, medium: cardDraftMediumAI, hard: cardDraftHardAI },
};

describe('game registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers and retrieves a game by id', () => {
    registerGame(descriptor);
    expect(getGame('card-draft-fixture')).toBe(descriptor);
  });

  it('lists all registered games', () => {
    registerGame(descriptor);
    expect(getGames()).toEqual([descriptor]);
  });

  it('throws when registering a duplicate id', () => {
    registerGame(descriptor);
    expect(() => registerGame(descriptor)).toThrow();
  });

  it('returns undefined for an unknown id', () => {
    expect(getGame('nonexistent')).toBeUndefined();
  });
});
