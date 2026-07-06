import { GameState, PlayerId } from '../rules/types';
import { RNG } from '../core/rng';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AIStrategy<TState extends GameState, TMove> {
  difficulty: Difficulty;
  chooseMove(state: TState, playerId: PlayerId, legalMoves: TMove[], rng: RNG): TMove;
}
