import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PlayingCard } from './PlayingCard';
import type { Card } from '@world-cards/engine';

const heartsAce: Card = { id: 'h-A', suit: 'hearts', rank: 'A' };
const clubsTen: Card = { id: 'c-10', suit: 'clubs', rank: '10' };

describe('PlayingCard', () => {
  it('renders rank and a red suit icon for hearts in both corners', async () => {
    await render(<PlayingCard card={heartsAce} />);
    expect(screen.getAllByText('A')).toHaveLength(2);
    expect(screen.getByTestId('corner-suit-hearts')).toBeTruthy();
    expect(screen.getByTestId('corner-suit-mirror-hearts')).toBeTruthy();
    expect(screen.getByTestId('playing-card-face')).toBeTruthy();
  });

  it('renders rank and a black suit icon for clubs in both corners', async () => {
    await render(<PlayingCard card={clubsTen} />);
    expect(screen.getAllByText('10')).toHaveLength(2);
    expect(screen.getByTestId('corner-suit-clubs')).toBeTruthy();
    expect(screen.getByTestId('corner-suit-mirror-clubs')).toBeTruthy();
  });

  it('renders a face-down back with no rank or suit icon when faceDown is set', async () => {
    await render(<PlayingCard card={heartsAce} faceDown />);
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByTestId('corner-suit-hearts')).toBeNull();
    expect(screen.queryByTestId('corner-suit-mirror-hearts')).toBeNull();
    expect(screen.getByTestId('playing-card-back')).toBeTruthy();
  });

  it('renders a face-down back when no card is given', async () => {
    await render(<PlayingCard />);
    expect(screen.getByTestId('playing-card-back')).toBeTruthy();
  });
});
