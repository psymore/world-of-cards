import React from 'react';
import { render, screen, within } from '@testing-library/react-native';
import { PistiTable, turnStateForPlayer } from './PistiTable';
import type { PistiState } from '@world-of-cards/engine/games/pisti';

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

  // Card select/play (tap-to-select, tap-again-to-play) has no automated coverage here — as of
  // the Reanimated + Gesture.Tap() hand-fan migration (see
  // docs/superpowers/specs/2026-08-06-pisti-hand-fan-gesture-migration-design.md §6),
  // PistiHandCard's touch handling is a react-native-gesture-handler GestureDetector, which RNTL's
  // fireEvent.press (a synthetic React event, not a real native touch) cannot trigger. This
  // mirrors Batak's own hand-fan cards, which have had zero equivalent test coverage since their
  // own migration for the same reason — there's no established RNGH-gesture-firing test utility
  // in this codebase. The 4 tests previously here (first-tap-selects, second-tap-plays,
  // switching-selection-deselects, no-play-during-AI-turn) are gone, not rewritten; on-device
  // verification is the only current way to confirm this interaction.

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

describe('turnStateForPlayer', () => {
  const state = makeState(0); // players: ['human', 'ai'], currentPlayerIndex: 0

  it('marks the current player active', () => {
    expect(turnStateForPlayer('human', state)).toBe('active');
  });

  it('marks everyone else idle', () => {
    expect(turnStateForPlayer('ai', state)).toBe('idle');
    const threePlayerState = { ...state, players: ['human', 'ai', 'ai2'], currentPlayerIndex: 0 };
    expect(turnStateForPlayer('ai2', threePlayerState)).toBe('idle');
  });

  it('follows the current player when it wraps around to the first seat', () => {
    const lastPlayerState = { ...state, players: ['human', 'ai'], currentPlayerIndex: 1 };
    expect(turnStateForPlayer('ai', lastPlayerState)).toBe('active');
    expect(turnStateForPlayer('human', lastPlayerState)).toBe('idle');
  });
});
