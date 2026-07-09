import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PlayingCard } from './PlayingCard';
import type { Card } from '@world-cards/engine';

const heartsAce: Card = { id: 'h-A', suit: 'hearts', rank: 'A' };
const clubsTen: Card = { id: 'c-10', suit: 'clubs', rank: '10' };

describe('PlayingCard', () => {
  it('renders rank and a red suit icon for hearts', async () => {
    await render(<PlayingCard card={heartsAce} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByTestId('corner-suit-hearts')).toBeTruthy();
    expect(screen.getByTestId('playing-card-face')).toBeTruthy();
  });

  it('renders rank and a black suit icon for clubs', async () => {
    await render(<PlayingCard card={clubsTen} />);
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByTestId('corner-suit-clubs')).toBeTruthy();
  });

  it('renders a face-down back with no rank or suit icon when faceDown is set', async () => {
    await render(<PlayingCard card={heartsAce} faceDown />);
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByTestId('corner-suit-hearts')).toBeNull();
    expect(screen.getByTestId('playing-card-back')).toBeTruthy();
  });

  it('renders a face-down back when no card is given', async () => {
    await render(<PlayingCard />);
    expect(screen.getByTestId('playing-card-back')).toBeTruthy();
  });
});
