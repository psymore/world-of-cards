import { create } from "zustand";

export type Difficulty = "easy" | "medium" | "hard";

export interface Settings {
  theme: "light" | "dark";
  soundEnabled: boolean;
  defaultDifficulty: Difficulty;
  // Controls SelectableCard's disabled-scrim visibility (off-turn/illegal cards). Cards that
  // can't be played always stay untappable either way — this only toggles the visual dimming.
  dimUnplayableCards: boolean;
}

export interface SettingsStore extends Settings {
  setTheme: (theme: Settings["theme"]) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDefaultDifficulty: (difficulty: Difficulty) => void;
  setDimUnplayableCards: (dim: boolean) => void;
}

export const defaultSettings: Settings = {
  theme: "light",
  soundEnabled: true,
  defaultDifficulty: "medium",
  dimUnplayableCards: false,
};

export const useSettingsStore = create<SettingsStore>(set => ({
  ...defaultSettings,
  setTheme: theme => set({ theme }),
  setSoundEnabled: soundEnabled => set({ soundEnabled }),
  setDefaultDifficulty: defaultDifficulty => set({ defaultDifficulty }),
  setDimUnplayableCards: dimUnplayableCards => set({ dimUnplayableCards }),
}));
