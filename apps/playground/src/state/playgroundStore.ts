import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CardGroup, CardImage, CardTemplate, TableTemplate } from '../types';
import { DEFAULT_CARD_TEMPLATE, DEFAULT_TABLE_TEMPLATE, DEFAULT_TEMPLATES } from '../types';

interface PlaygroundState {
  templates: Record<CardGroup, CardTemplate>;
  table: TableTemplate;
  setBorderRadius: (group: CardGroup, radius: number) => void;
  setBorderColor: (group: CardGroup, color: string) => void;
  setCardImage: (group: CardGroup, image: CardImage) => void;
  updateCardImage: (group: CardGroup, patch: Partial<Pick<CardImage, 'scale' | 'offsetX' | 'offsetY'>>) => void;
  clearCardImage: (group: CardGroup) => void;
  resetCardTemplate: (group: CardGroup) => void;
  setFeltColor: (color: string) => void;
  setWoodColor: (color: string) => void;
  resetTableTemplate: () => void;
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set) => ({
      templates: DEFAULT_TEMPLATES,
      table: DEFAULT_TABLE_TEMPLATE,

      setBorderRadius: (group, radius) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], borderRadius: radius } },
        })),

      setBorderColor: (group, color) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], borderColor: color } },
        })),

      setCardImage: (group, image) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], image } },
        })),

      updateCardImage: (group, patch) =>
        set((state) => {
          const current = state.templates[group].image;
          if (current == null) return state;
          return {
            templates: {
              ...state.templates,
              [group]: { ...state.templates[group], image: { ...current, ...patch } },
            },
          };
        }),

      clearCardImage: (group) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], image: null } },
        })),

      resetCardTemplate: (group) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...DEFAULT_CARD_TEMPLATE } },
        })),

      setFeltColor: (color) => set((state) => ({ table: { ...state.table, feltColor: color } })),
      setWoodColor: (color) => set((state) => ({ table: { ...state.table, woodColor: color } })),
      resetTableTemplate: () => set({ table: { ...DEFAULT_TABLE_TEMPLATE } }),
    }),
    {
      name: 'card-playground-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
