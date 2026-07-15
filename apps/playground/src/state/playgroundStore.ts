import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BorderPreset, CardGroup, CardImage, CardTemplate, TableTemplate } from '../types';
import {
  DEFAULT_CARD_BORDER,
  DEFAULT_CARD_TEMPLATE,
  DEFAULT_TABLE_TEMPLATE,
  DEFAULT_TEMPLATES,
  MAX_CARD_BORDERS,
  defaultBorderPresets,
} from '../types';

interface PlaygroundState {
  templates: Record<CardGroup, CardTemplate>;
  table: TableTemplate;
  borderPresets: BorderPreset[];
  setBorderRadius: (group: CardGroup, radius: number) => void;
  setBorderWidth: (group: CardGroup, index: number, width: number) => void;
  setBorderColor: (group: CardGroup, index: number, color: string) => void;
  addBorder: (group: CardGroup) => void;
  removeBorder: (group: CardGroup, index: number) => void;
  setCardImage: (group: CardGroup, image: CardImage) => void;
  updateCardImage: (group: CardGroup, patch: Partial<Pick<CardImage, 'scale' | 'offsetX' | 'offsetY'>>) => void;
  clearCardImage: (group: CardGroup) => void;
  resetCardTemplate: (group: CardGroup) => void;
  saveBorderPreset: (group: CardGroup, name: string) => void;
  applyBorderPreset: (group: CardGroup, presetId: string) => void;
  deleteBorderPreset: (presetId: string) => void;
  setFeltColor: (color: string) => void;
  setWoodColor: (color: string) => void;
  resetTableTemplate: () => void;
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set) => ({
      templates: DEFAULT_TEMPLATES,
      table: DEFAULT_TABLE_TEMPLATE,
      borderPresets: defaultBorderPresets(),

      setBorderRadius: (group, radius) =>
        set((state) => ({
          templates: { ...state.templates, [group]: { ...state.templates[group], borderRadius: radius } },
        })),

      setBorderWidth: (group, index, width) =>
        set((state) => {
          const borders = state.templates[group].borders.map((border, i) =>
            i === index ? { ...border, width } : border
          );
          return { templates: { ...state.templates, [group]: { ...state.templates[group], borders } } };
        }),

      setBorderColor: (group, index, color) =>
        set((state) => {
          const borders = state.templates[group].borders.map((border, i) =>
            i === index ? { ...border, color } : border
          );
          return { templates: { ...state.templates, [group]: { ...state.templates[group], borders } } };
        }),

      addBorder: (group) =>
        set((state) => {
          const current = state.templates[group].borders;
          if (current.length >= MAX_CARD_BORDERS) return state;
          const borders = [...current, { ...DEFAULT_CARD_BORDER }];
          return { templates: { ...state.templates, [group]: { ...state.templates[group], borders } } };
        }),

      removeBorder: (group, index) =>
        set((state) => {
          const current = state.templates[group].borders;
          if (current.length <= 1) return state;
          const borders = current.filter((_, i) => i !== index);
          return { templates: { ...state.templates, [group]: { ...state.templates[group], borders } } };
        }),

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

      saveBorderPreset: (group, name) =>
        set((state) => {
          const template = state.templates[group];
          const preset: BorderPreset = {
            id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            borderRadius: template.borderRadius,
            borders: template.borders.map((border) => ({ ...border })),
          };
          return { borderPresets: [...state.borderPresets, preset] };
        }),

      applyBorderPreset: (group, presetId) =>
        set((state) => {
          const preset = state.borderPresets.find((p) => p.id === presetId);
          if (preset == null) return state;
          return {
            templates: {
              ...state.templates,
              [group]: {
                ...state.templates[group],
                borderRadius: preset.borderRadius,
                borders: preset.borders.map((border) => ({ ...border })),
              },
            },
          };
        }),

      deleteBorderPreset: (presetId) =>
        set((state) => ({
          // Built-in presets (e.g. "Current Game") are not deletable; the UI hides their
          // delete button too — this is just defense in depth.
          borderPresets: state.borderPresets.filter((preset) => preset.builtIn === true || preset.id !== presetId),
        })),

      setFeltColor: (color) => set((state) => ({ table: { ...state.table, feltColor: color } })),
      setWoodColor: (color) => set((state) => ({ table: { ...state.table, woodColor: color } })),
      resetTableTemplate: () => set({ table: { ...DEFAULT_TABLE_TEMPLATE } }),
    }),
    {
      name: 'card-playground-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // v2 replaced CardTemplate.borderColor (a single string) with borders: CardBorder[].
      // Local saves from before that change would otherwise rehydrate with no `borders`
      // array at all and crash the card renderer, so upgrade them in place here.
      // v3 added borderPresets; older saves are seeded with the built-in defaults.
      version: 3,
      migrate: (persistedState) => {
        const state = persistedState as
          | { templates?: Record<string, Record<string, unknown>>; borderPresets?: unknown }
          | undefined;
        const templates = state?.templates;
        if (templates != null) {
          for (const group of Object.keys(templates)) {
            const template = templates[group];
            if (template != null && !Array.isArray(template.borders)) {
              const legacyColor = template.borderColor;
              delete template.borderColor;
              template.borders = [
                { ...DEFAULT_CARD_BORDER, ...(typeof legacyColor === 'string' ? { color: legacyColor } : {}) },
              ];
            }
          }
        }
        if (state != null && !Array.isArray(state.borderPresets)) {
          state.borderPresets = defaultBorderPresets();
        }
        return state as unknown as PlaygroundState;
      },
    }
  )
);
