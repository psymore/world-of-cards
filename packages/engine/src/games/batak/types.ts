import { GameState, PlayerId } from '../../rules/types';
import { Suit } from '../../core/types';

export interface BatakState extends GameState {
  phase: 'bidding' | 'trump-selection' | 'kitty-exchange' | 'playing' | 'finished';
  bids: Record<PlayerId, number | 'pass' | null>;
  highestBid: number;
  contract: number | null;
  bidWinner: PlayerId | null;
  trumpSuit: Suit | null;
  trumpBroken: boolean;
  currentTrick: Array<{ playerId: PlayerId; cardId: string }>;
  trickLeader: PlayerId | null;
  tricksWon: Record<PlayerId, number>;
  kittyCardIds: string[] | null;
}

export type BatakMove =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }
  | { type: 'bury'; cardIds: [string, string, string, string] }
  | { type: 'play'; cardId: string };

export interface BatakSetupOptions {
  players: PlayerId[];
}
