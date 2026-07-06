import { GameState, PlayerId } from '../../rules/types';

export interface PistiState extends GameState {
  lastCapturedBy: PlayerId | null;
  pistiBonusPoints: Record<PlayerId, number>;
}

export type PistiMove = { type: 'play'; cardId: string };

export interface PistiSetupOptions {
  players: [PlayerId, PlayerId];
}
