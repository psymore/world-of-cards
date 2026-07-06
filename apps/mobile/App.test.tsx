import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from './App';

describe('App', () => {
  it('renders the placeholder screen', async () => {
    await render(<App />);
    expect(screen.getByText('Open up App.tsx to start working on your app!')).toBeTruthy();
  });
});
