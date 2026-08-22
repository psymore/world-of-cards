import { GameState, PlayerId } from '../../rules/types';
import { Suit } from '../../core/types';

export interface PisYedeliState extends GameState {
  activeSuit: Suit | null; // suit that must be matched next; null only before the game opens
  pendingDraw: number;     // cards the current player owes from stacked 7s; 0 = no penalty active
}

export type PisYedeliMove =
  | { type: 'play'; cardId: string; declaredSuit?: Suit } // declaredSuit required iff cardId is a Jack
  | { type: 'draw' }
  | { type: 'pass' };

export interface PisYedeliSetupOptions {
  players: PlayerId[]; // 2-4
}
