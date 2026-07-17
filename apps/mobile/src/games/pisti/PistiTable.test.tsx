import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { PistiTable } from './PistiTable';
import type { PistiState } from '@world-cards/engine/games/pisti';

const PLAYER_NAMES = { human: 'You', ai: 'Computer' };

function makeState(currentPlayerIndex: number): PistiState {
  return {
    gameId: 'pisti',
    players: ['human', 'ai'],
    currentPlayerIndex,
    status: 'in-progress',
    rngState: { seed: 0 },
    lastCapturedBy: null,
    pistiBonusPoints: { human: 0, ai: 0 },
    teams: null,
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
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={() => {}} dealPhase="revealing" />);
    expect(screen.getAllByText('7')).toHaveLength(2);
    expect(screen.getByText('1 card')).toBeTruthy();
  });

  it('renders the opponent hand as face-down cards only', async () => {
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={() => {}} dealPhase="revealing" />);
    expect(within(screen.getByTestId('opponent-hand-ai')).getAllByTestId('playing-card-back')).toHaveLength(2);
    expect(screen.queryByText('3')).toBeNull();
  });

  it('does not call onPlayCard on the first tap, only selects the card', async () => {
    const onPlayCard = jest.fn();
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={onPlayCard} dealPhase="revealing" />);
    await fireEvent.press(screen.getAllByText('9')[0]);
    expect(onPlayCard).not.toHaveBeenCalled();
  });

  it('calls onPlayCard when the already-selected card is tapped again', async () => {
    const onPlayCard = jest.fn();
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={onPlayCard} dealPhase="revealing" />);
    await fireEvent.press(screen.getAllByText('9')[0]);
    await fireEvent.press(screen.getAllByText('9')[0]);
    expect(onPlayCard).toHaveBeenCalledWith('h1');
  });

  it('selecting a different card deselects the previous one instead of playing it', async () => {
    const onPlayCard = jest.fn();
    await render(<PistiTable state={makeState(0)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={onPlayCard} dealPhase="revealing" />);
    await fireEvent.press(screen.getAllByText('9')[0]);
    await fireEvent.press(screen.getAllByText('K')[0]);
    expect(onPlayCard).not.toHaveBeenCalled();
    await fireEvent.press(screen.getAllByText('K')[0]);
    expect(onPlayCard).toHaveBeenCalledWith('h2');
  });

  it('does not call onPlayCard when tapped during the AI turn', async () => {
    const onPlayCard = jest.fn();
    await render(<PistiTable state={makeState(1)} humanPlayerId="human" opponentPlayerIds={['ai']} playerNames={PLAYER_NAMES}onPlayCard={onPlayCard} dealPhase="revealing" />);
    await fireEvent.press(screen.getAllByText('9')[0]);
    await fireEvent.press(screen.getAllByText('9')[0]);
    expect(onPlayCard).not.toHaveBeenCalled();
  });

  it('shows the banner text when provided', async () => {
    await render(
      <PistiTable
        state={makeState(0)}
        humanPlayerId="human"
        opponentPlayerIds={['ai']}
        playerNames={PLAYER_NAMES}
        onPlayCard={() => {}}
        bannerText="Pişti! +10"
        dealPhase="revealing"
      />
    );
    expect(screen.getByText('Pişti! +10')).toBeTruthy();
  });
});
