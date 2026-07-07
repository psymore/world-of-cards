import type { ComponentType } from 'react';
import { PistiScreen } from './pisti/PistiScreen';

export interface GameScreenProps {
  onExitToHome: () => void;
}

export const gameScreens: Record<string, ComponentType<GameScreenProps>> = {
  pisti: PistiScreen,
};
