import { create } from 'zustand';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Settings {
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  defaultDifficulty: Difficulty;
}

export interface SettingsStore extends Settings {
  setTheme: (theme: Settings['theme']) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDefaultDifficulty: (difficulty: Difficulty) => void;
}

export const defaultSettings: Settings = {
  theme: 'light',
  soundEnabled: true,
  defaultDifficulty: 'medium',
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...defaultSettings,
  setTheme: (theme) => set({ theme }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setDefaultDifficulty: (defaultDifficulty) => set({ defaultDifficulty }),
}));
