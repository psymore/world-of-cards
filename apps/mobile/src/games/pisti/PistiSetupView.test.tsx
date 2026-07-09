import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PistiSetupView } from './PistiSetupView';
import { useSettingsStore, defaultSettings } from '../../state/settingsStore';

describe('PistiSetupView', () => {
  beforeEach(() => {
    useSettingsStore.setState(defaultSettings);
  });

  it('renders all three difficulty options', async () => {
    await render(<PistiSetupView defaultDifficulty="medium" onStart={() => {}} onBack={() => {}} />);
    expect(screen.getByText('Easy')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('Hard')).toBeTruthy();
  });

  it('marks the default difficulty as last played', async () => {
    await render(<PistiSetupView defaultDifficulty="hard" onStart={() => {}} onBack={() => {}} />);
    expect(screen.getByText('Last played')).toBeTruthy();
  });

  it('updates the default difficulty and calls onStart when a difficulty is tapped', async () => {
    const onStart = jest.fn();
    await render(<PistiSetupView defaultDifficulty="medium" onStart={onStart} onBack={() => {}} />);
    fireEvent.press(screen.getByText('Hard'));
    expect(onStart).toHaveBeenCalledWith('hard', 2, 'ffa');
    expect(useSettingsStore.getState().defaultDifficulty).toBe('hard');
  });
});
