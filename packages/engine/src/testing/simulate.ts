import { GameState, PlayerId, RuleEngine } from '../rules/types';
import { AIStrategy } from '../ai/types';
import { createRng } from '../core/rng';
import { allCards } from '../core/table';

export interface SimulateGamesOptions<TState extends GameState, TMove, TOptions = unknown> {
  ruleEngine: RuleEngine<TState, TMove, TOptions>;
  setupOptions: TOptions;
  aiStrategies: Record<PlayerId, AIStrategy<TState, TMove>>;
  count: number;
  seedStart: number;
  maxMoves?: number;
}

export interface SimulateGamesResult<TState extends GameState> {
  finalStates: TState[];
  winCounts: Record<PlayerId, number>;
}

export function assertCardsConserved(before: GameState, after: GameState): void {
  const beforeIds = allCards(before.table).map((c) => c.id).sort();
  const afterIds = allCards(after.table).map((c) => c.id).sort();
  if (beforeIds.length !== afterIds.length) {
    throw new Error(`Card count changed: ${beforeIds.length} before, ${afterIds.length} after`);
  }
  for (let i = 0; i < beforeIds.length; i++) {
    if (beforeIds[i] !== afterIds[i]) {
      throw new Error(`Card set changed between moves: ${beforeIds[i]} vs ${afterIds[i]}`);
    }
  }
  if (new Set(afterIds).size !== afterIds.length) {
    throw new Error('Duplicate card id detected in table state');
  }
}

export function simulateGames<TState extends GameState, TMove, TOptions = unknown>(
  options: SimulateGamesOptions<TState, TMove, TOptions>
): SimulateGamesResult<TState> {
  const { ruleEngine, setupOptions, aiStrategies, count, seedStart, maxMoves = 1000 } = options;
  const finalStates: TState[] = [];
  const winCounts: Record<PlayerId, number> = {};

  for (let i = 0; i < count; i++) {
    const seed = seedStart + i;
    const rng = createRng(seed);
    let state = ruleEngine.setup(setupOptions, rng);
    let moves = 0;

    while (!ruleEngine.gameOver(state) && moves < maxMoves) {
      const playerId = state.players[state.currentPlayerIndex];
      const legalMoves = ruleEngine.getLegalMoves(state, playerId);
      if (legalMoves.length === 0) {
        throw new Error(`No legal moves for player "${playerId}" but game is not over (seed ${seed})`);
      }
      const strategy = aiStrategies[playerId];
      const move = strategy.chooseMove(state, playerId, legalMoves, rng);
      if (!ruleEngine.validateMove(state, move, playerId)) {
        throw new Error(`AI chose an illegal move for player "${playerId}" (seed ${seed})`);
      }
      const nextState = ruleEngine.performMove(state, move);
      assertCardsConserved(state, nextState);
      state = nextState;
      moves++;
    }

    if (!ruleEngine.gameOver(state)) {
      throw new Error(`Game did not terminate within ${maxMoves} moves (seed ${seed})`);
    }

    finalStates.push(state);
    const winners = ruleEngine.determineWinner(state) ?? [];
    for (const winner of winners) {
      winCounts[winner] = (winCounts[winner] ?? 0) + 1;
    }
  }

  return { finalStates, winCounts };
}
