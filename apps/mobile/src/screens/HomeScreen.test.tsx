import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { clearRegistry } from '@world-cards/engine';

describe('HomeScreen', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('shows the app title and an empty state when no games are registered', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('World Cards')).toBeTruthy();
    expect(screen.getByText('No games installed yet')).toBeTruthy();
  });
});
