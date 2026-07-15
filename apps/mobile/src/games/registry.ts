import type { ComponentType } from 'react';
import { PistiScreen } from './pisti/PistiScreen';
import { BatakScreen } from './batak/BatakScreen';

export interface GameScreenProps {
  onExitToHome: () => void;
}

export const gameScreens: Record<string, ComponentType<GameScreenProps>> = {
  pisti: PistiScreen,
  batak: BatakScreen,
};
