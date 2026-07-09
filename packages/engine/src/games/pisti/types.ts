import { GameState, PlayerId } from '../../rules/types';

export interface PistiState extends GameState {
  lastCapturedBy: PlayerId | null;
  pistiBonusPoints: Record<PlayerId, number>;
  // A partition of `players` into partnerships (e.g. 4-player "with a partner" mode), or null
  // for free-for-all scoring. Turn order and card play are unaffected either way — teams only
  // change how calculateScore pools captured cards and bonus points.
  teams: PlayerId[][] | null;
}

export type PistiMove = { type: 'play'; cardId: string };

export interface PistiSetupOptions {
  // 2 or 4 players. Free-for-all: every player has their own hand, captured pile, and score.
  players: PlayerId[];
  // Optional partnerships, each an array of PlayerIds from `players`. Every player must appear
  // in exactly one team if provided. Omit for free-for-all scoring.
  teams?: PlayerId[][];
}
