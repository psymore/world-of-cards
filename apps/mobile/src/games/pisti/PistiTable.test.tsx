import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { PistiTable } from './PistiTable';
import type { PistiState } from '@world-cards/engine/games/pisti';

function makeState(currentPlayerIndex: number): PistiState {
  return {
    gameId: 'pisti',
    players: ['human', 'ai'],
    currentPlayerIndex,
    status: 'in-progress',
    rngState: { seed: 0 },
    lastCapturedBy: null,
    pistiBonusPoints: { human: 0, ai: 0 },
    table: {
      zones: {
        stock: { id: 'stock', faceUp: false, cards: [] },
        pile: { id: 'pile', faceUp: 'top-only', cards: [{ id: 'p1', suit: 'hearts', rank: '7' }] },
        'hand-human': {
          id: 'hand-human',
          faceUp: true,
          cards: [
            { id: 'h1', suit: 'clubs', rank: '9' },
            { id: 'h2', suit: 'spades', rank: 'K' },
          ],
        },
        'hand-ai': {
          id: 'hand-ai',
          faceUp: true,
          cards: [
            { id: 'a1', suit: 'diamonds', rank: '3' },
            { id: 'a2', suit: 'hearts', rank: '5' },
          ],
        },
        'captured-human': { id: 'captured-human', faceUp: true, cards: [] },
        'captured-ai': { id: 'captured-ai', faceUp: true, cards: [] },
      },
    },
  };
}

describe('PistiTable', () => {
  it('renders the pile top card and count', async () => {
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" aiPlayerId="ai" onPlayCard={() => {}} />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('1 card')).toBeTruthy();
  });

  it('renders the opponent hand as face-down cards only', async () => {
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" aiPlayerId="ai" onPlayCard={() => {}} />);
    expect(within(screen.getByTestId('opponent-hand')).getAllByTestId('playing-card-back')).toHaveLength(2);
    expect(screen.queryByText('3')).toBeNull();
  });

  it('calls onPlayCard when a hand card is tapped during the human turn', async () => {
    const onPlayCard = jest.fn();
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" aiPlayerId="ai" onPlayCard={onPlayCard} />);
    fireEvent.press(screen.getByText('9'));
    expect(onPlayCard).toHaveBeenCalledWith('h1');
  });

  it('does not call onPlayCard when tapped during the AI turn', async () => {
    const onPlayCard = jest.fn();
    await render(<PistiTable state={makeState(1)} humanPlayerId="human" aiPlayerId="ai" onPlayCard={onPlayCard} />);
    fireEvent.press(screen.getByText('9'));
    expect(onPlayCard).not.toHaveBeenCalled();
  });

  it('shows the banner text when provided', async () => {
    await render(
      <PistiTable
        state={makeState(0)}
        humanPlayerId="human"
        aiPlayerId="ai"
        onPlayCard={() => {}}
        bannerText="Pişti! +10"
      />
    );
    expect(screen.getByText('Pişti! +10')).toBeTruthy();
  });
});
