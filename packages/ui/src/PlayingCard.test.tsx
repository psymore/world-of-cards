import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PlayingCard } from './PlayingCard';
import { useCardFaceStyleStore } from './cardFaceStyleStore';
import type { Card } from '@world-cards/engine';

const heartsAce: Card = { id: 'h-A', suit: 'hearts', rank: 'A' };
const clubsTen: Card = { id: 'c-10', suit: 'clubs', rank: '10' };
const spadesKing: Card = { id: 's-K', suit: 'spades', rank: 'K' };
const clubsJack: Card = { id: 'c-J', suit: 'clubs', rank: 'J' };

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

  describe('cardFaceStyle v2', () => {
    afterEach(() => {
      useCardFaceStyleStore.setState({ cardFaceStyle: 'v1' });
    });

    it('renders the v2 background and suppresses center art for a King, keeping its real corner index', async () => {
      useCardFaceStyleStore.setState({ cardFaceStyle: 'v2' });
      await render(<PlayingCard card={spadesKing} />);
      expect(screen.getByTestId('playing-card-face-background')).toBeTruthy();
      expect(screen.queryByTestId('playing-card-center-art')).toBeNull();
      expect(screen.getAllByText('K')).toHaveLength(2);
      expect(screen.getByTestId('corner-suit-spades')).toBeTruthy();
    });

    it('falls back to v1 court art for a suit with no v2 art yet (Jack of clubs)', async () => {
      useCardFaceStyleStore.setState({ cardFaceStyle: 'v2' });
      await render(<PlayingCard card={clubsJack} />);
      expect(screen.getByTestId('playing-card-face-background')).toBeTruthy();
      expect(screen.getByTestId('court-card-art')).toBeTruthy();
    });

    it('keeps the plain suit watermark (no v1 court art) for non-face ranks', async () => {
      useCardFaceStyleStore.setState({ cardFaceStyle: 'v2' });
      await render(<PlayingCard card={heartsAce} />);
      expect(screen.getByTestId('playing-card-face-background')).toBeTruthy();
      expect(screen.queryByTestId('court-card-art')).toBeNull();
    });
  });

  describe('cardFaceStyle v3', () => {
    afterEach(() => {
      useCardFaceStyleStore.setState({ cardFaceStyle: 'v1' });
    });

    it('shows the same v2 art small and centered instead of full-bleed, keeping the corner index', async () => {
      useCardFaceStyleStore.setState({ cardFaceStyle: 'v3' });
      await render(<PlayingCard card={spadesKing} />);
      expect(screen.getByTestId('playing-card-face-background')).toBeTruthy();
      expect(screen.getByTestId('playing-card-center-art')).toBeTruthy();
      expect(screen.getByTestId('court-card-art-v3')).toBeTruthy();
      expect(screen.getAllByText('K')).toHaveLength(2);
    });

    it('falls back to v1 court art for a suit with no v2/v3 art yet (Jack of clubs)', async () => {
      useCardFaceStyleStore.setState({ cardFaceStyle: 'v3' });
      await render(<PlayingCard card={clubsJack} />);
      expect(screen.getByTestId('playing-card-face-background')).toBeTruthy();
      expect(screen.getByTestId('court-card-art')).toBeTruthy();
      expect(screen.queryByTestId('court-card-art-v3')).toBeNull();
    });
  });
});
