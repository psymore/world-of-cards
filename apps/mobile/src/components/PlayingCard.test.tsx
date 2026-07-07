import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PlayingCard } from './PlayingCard';
import type { Card } from '@world-cards/engine';

const heartsAce: Card = { id: 'h-A', suit: 'hearts', rank: 'A' };
const clubsTen: Card = { id: 'c-10', suit: 'clubs', rank: '10' };

describe('PlayingCard', () => {
  it('renders rank and a red suit glyph for hearts', async () => {
    await render(<PlayingCard card={heartsAce} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('♥')).toBeTruthy();
    expect(screen.getByTestId('playing-card-face')).toBeTruthy();
  });

  it('renders rank and a black suit glyph for clubs', async () => {
    await render(<PlayingCard card={clubsTen} />);
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('♣')).toBeTruthy();
  });

  it('renders a face-down back with no rank or suit text when faceDown is set', async () => {
    await render(<PlayingCard card={heartsAce} faceDown />);
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('♥')).toBeNull();
    expect(screen.getByTestId('playing-card-back')).toBeTruthy();
  });

  it('renders a face-down back when no card is given', async () => {
    await render(<PlayingCard />);
    expect(screen.getByTestId('playing-card-back')).toBeTruthy();
  });
});
