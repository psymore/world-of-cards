import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { clearRegistry, registerGame } from '@world-of-cards/engine';
import type { GameDescriptor } from '@world-of-cards/engine';

const fakeGame: GameDescriptor = {
  id: 'fake-game',
  displayName: 'Fake Game',
  category: 'other',
  minPlayers: 2,
  maxPlayers: 2,
  ruleEngine: {
    setup: () => ({
      gameId: 'fake-game',
      players: [],
      currentPlayerIndex: 0,
      table: { zones: {} },
      rngState: { seed: 0 },
      status: 'in-progress',
    }),
    validateMove: () => true,
    performMove: (state) => state,
    getLegalMoves: () => [],
    calculateScore: () => ({}),
    determineWinner: () => null,
    gameOver: () => false,
  },
  aiStrategies: {
    easy: { difficulty: 'easy', chooseMove: (_s, _p, moves) => moves[0] },
    medium: { difficulty: 'medium', chooseMove: (_s, _p, moves) => moves[0] },
    hard: { difficulty: 'hard', chooseMove: (_s, _p, moves) => moves[0] },
  },
};

describe('HomeScreen', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('shows the app title and an empty state when no games are registered', async () => {
    await render(<HomeScreen onSelectGame={() => {}} />);
    expect(screen.getByText('World of Cards')).toBeTruthy();
    expect(screen.getByText('No games installed yet')).toBeTruthy();
  });

  it('calls onSelectGame with the tapped game id', async () => {
    registerGame(fakeGame);
    const onSelectGame = jest.fn();
    await render(<HomeScreen onSelectGame={onSelectGame} />);
    fireEvent.press(screen.getByText('Fake Game'));
    expect(onSelectGame).toHaveBeenCalledWith('fake-game');
  });
});
