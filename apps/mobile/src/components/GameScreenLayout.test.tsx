import React from 'react';
import { Alert, Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { GameScreenLayout } from './GameScreenLayout';

describe('GameScreenLayout', () => {
  it('renders the title and children', async () => {
    await render(
      <GameScreenLayout title="Pişti" onExit={() => {}}>
        <Text>board</Text>
      </GameScreenLayout>
    );
    expect(screen.getByText('Pişti')).toBeTruthy();
    expect(screen.getByText('board')).toBeTruthy();
  });

  it('shows a confirm alert on Exit and only calls onExit if the user confirms', async () => {
    const onExit = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const cancelButton = buttons?.find((b) => b.text === 'Cancel');
      cancelButton?.onPress?.();
    });

    await render(
      <GameScreenLayout title="Pişti" onExit={onExit}>
        <Text>board</Text>
      </GameScreenLayout>
    );
    fireEvent.press(screen.getByTestId('game-exit-button'));

    expect(alertSpy).toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('calls onExit after the user confirms discard', async () => {
    const onExit = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const discardButton = buttons?.find((b) => b.text === 'Discard');
      discardButton?.onPress?.();
    });

    await render(
      <GameScreenLayout title="Pişti" onExit={onExit}>
        <Text>board</Text>
      </GameScreenLayout>
    );
    fireEvent.press(screen.getByTestId('game-exit-button'));

    expect(onExit).toHaveBeenCalledTimes(1);

    alertSpy.mockRestore();
  });
});
