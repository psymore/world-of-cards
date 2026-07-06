import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from './App';
import { clearRegistry } from '@world-cards/engine';

describe('App', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('renders the Home screen inside the navigator', async () => {
    await render(<App />);
    expect(screen.getByText('World Cards')).toBeTruthy();
  });
});
