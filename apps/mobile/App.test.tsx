import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import App from './App';
import { clearRegistry, registerGame } from '@world-of-cards/engine';
import { pistiDescriptor } from '@world-of-cards/engine/games/pisti';

describe('App', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('renders the Home screen inside the navigator', async () => {
    await render(<App />);
    expect(screen.getByText('World of Cards')).toBeTruthy();
  });

  it('navigates from Home to the Pişti setup screen when Pişti is tapped', async () => {
    registerGame(pistiDescriptor);
    await render(<App />);
    fireEvent.press(screen.getByText('Pişti'));
    expect(await screen.findByText('Choose a difficulty')).toBeTruthy();
  });
});
