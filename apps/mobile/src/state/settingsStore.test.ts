import { useSettingsStore, defaultSettings } from './settingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState(defaultSettings);
  });

  it('starts with the default settings', () => {
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('light');
    expect(state.soundEnabled).toBe(true);
    expect(state.defaultDifficulty).toBe('medium');
  });

  it('updates the theme', () => {
    useSettingsStore.getState().setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('updates the default difficulty', () => {
    useSettingsStore.getState().setDefaultDifficulty('hard');
    expect(useSettingsStore.getState().defaultDifficulty).toBe('hard');
  });
});
