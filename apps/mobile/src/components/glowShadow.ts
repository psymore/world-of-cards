import type { ViewStyle } from 'react-native';

// A colored glow used for "this is active/selected" states (highlighted cards, active-turn
// badges). Centralized so every game's glow looks the same and tuning it once affects every
// place it's used, instead of each component hand-rolling the same shadow recipe.
export function glowShadow(color: string, radius: number): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: radius,
    elevation: radius,
  };
}
