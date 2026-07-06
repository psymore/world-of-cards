import { GameState, RuleEngine } from '../rules/types';
import { AIStrategy, Difficulty } from '../ai/types';

export type GameCategory = 'trick-taking' | 'patience' | 'betting' | 'draw-and-discard' | 'other';

export interface GameDescriptor<TState extends GameState = GameState, TMove = unknown> {
  id: string;
  displayName: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  ruleEngine: RuleEngine<TState, TMove>;
  aiStrategies: Record<Difficulty, AIStrategy<TState, TMove>>;
}
