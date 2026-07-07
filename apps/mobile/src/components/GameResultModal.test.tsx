import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { GameResultModal } from './GameResultModal';

const playerNames = { human: 'You', ai: 'Computer' };

describe('GameResultModal', () => {
  it('shows a win headline and both scores when the human wins outright', async () => {
    await render(
      <GameResultModal
        scores={{ human: 42, ai: 30 }}
        winners={['human']}
        playerNames={playerNames}
        humanPlayerId="human"
        onPlayAgain={() => {}}
        onBackHome={() => {}}
      />
    );
    expect(screen.getByText('You win!')).toBeTruthy();
    expect(screen.getByText('You: 42')).toBeTruthy();
    expect(screen.getByText('Computer: 30')).toBeTruthy();
  });

  it('shows a lose headline when the ai wins outright', async () => {
    await render(
      <GameResultModal
        scores={{ human: 20, ai: 35 }}
        winners={['ai']}
        playerNames={playerNames}
        humanPlayerId="human"
        onPlayAgain={() => {}}
        onBackHome={() => {}}
      />
    );
    expect(screen.getByText('You lose')).toBeTruthy();
  });

  it("shows a tie headline when both players are winners", async () => {
    await render(
      <GameResultModal
        scores={{ human: 25, ai: 25 }}
        winners={['human', 'ai']}
        playerNames={playerNames}
        humanPlayerId="human"
        onPlayAgain={() => {}}
        onBackHome={() => {}}
      />
    );
    expect(screen.getByText("It's a tie!")).toBeTruthy();
  });

  it('fires onPlayAgain and onBackHome', async () => {
    const onPlayAgain = jest.fn();
    const onBackHome = jest.fn();
    await render(
      <GameResultModal
        scores={{ human: 42, ai: 30 }}
        winners={['human']}
        playerNames={playerNames}
        humanPlayerId="human"
        onPlayAgain={onPlayAgain}
        onBackHome={onBackHome}
      />
    );
    fireEvent.press(screen.getByText('Play Again'));
    fireEvent.press(screen.getByText('Back to Home'));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });
});
