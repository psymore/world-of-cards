import { TableState } from '../core/table';
import { RngState } from '../core/rng';

export type PlayerId = string;

export interface GameState {
  gameId: string;
  players: PlayerId[];
  currentPlayerIndex: number;
  table: TableState;
  rngState: RngState;
  status: 'setup' | 'in-progress' | 'finished';
}

export interface ScoreBoard {
  [playerId: string]: number;
}

export interface RuleEngine<TState extends GameState, TMove, TOptions = unknown> {
  setup(options: TOptions, rng: import('../core/rng').RNG): TState;
  validateMove(state: TState, move: TMove, playerId: PlayerId): boolean;
  performMove(state: TState, move: TMove): TState;
  getLegalMoves(state: TState, playerId: PlayerId): TMove[];
  calculateScore(state: TState): ScoreBoard;
  determineWinner(state: TState): PlayerId[] | null;
  gameOver(state: TState): boolean;
}
