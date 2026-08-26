import type { ComponentType } from 'react';
import { PistiScreen } from './pisti/PistiScreen';
import { BatakScreen } from './batak/BatakScreen';
import { PisYedeliScreen } from './pis-yedili/PisYedeliScreen';

export interface GameScreenProps {
  onExitToHome: () => void;
}

export const gameScreens: Record<string, ComponentType<GameScreenProps>> = {
  pisti: PistiScreen,
  batak: BatakScreen,
  'pis-yedili': PisYedeliScreen,
};
