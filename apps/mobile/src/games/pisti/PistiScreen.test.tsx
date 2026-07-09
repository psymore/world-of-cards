import React, { act } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { PistiScreen } from './PistiScreen';
import { useSettingsStore, defaultSettings } from '../../state/settingsStore';

describe('PistiScreen', () => {
  beforeEach(() => {
    useSettingsStore.setState(defaultSettings);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows a difficulty picker, then the table with 4 cards in each hand after a difficulty is chosen', async () => {
    await render(<PistiScreen onExitToHome={() => {}} />);
    expect(screen.getByText('Choose a difficulty')).toBeTruthy();

    await fireEvent.press(screen.getByText('Medium'));

    expect(await screen.findByText('Pişti')).toBeTruthy();
    const humanHand = within(screen.getByTestId('human-hand')).getAllByTestId('playing-card-face');
    expect(humanHand).toHaveLength(4);
  });

  it('plays a human card, then automatically lets the AI take its turn', async () => {
    await render(<PistiScreen onExitToHome={() => {}} />);
    await fireEvent.press(screen.getByText('Easy'));
    await screen.findByText('Pişti');

    const humanHand = () => within(screen.getByTestId('human-hand')).getAllByTestId('playing-card-face');
    expect(humanHand()).toHaveLength(4);

    await fireEvent.press(humanHand()[0]);
    expect(humanHand()).toHaveLength(4); // first tap only selects the card
    await fireEvent.press(humanHand()[0]);
    expect(humanHand()).toHaveLength(3); // second tap on the same card plays it

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    await fireEvent.press(humanHand()[0]);
    await fireEvent.press(humanHand()[0]);
    expect(humanHand()).toHaveLength(2);
  });
});
