import { GameState, PlayerId, RuleEngine } from '../rules/types';

export interface MinimaxOptions<TState extends GameState, TMove> {
  ruleEngine: RuleEngine<TState, TMove>;
  maximizingPlayer: PlayerId;
  evaluate: (state: TState) => number;
  maxDepth: number;
}

export function minimaxChooseMove<TState extends GameState, TMove>(
  state: TState,
  _playerId: PlayerId,
  legalMoves: TMove[],
  options: MinimaxOptions<TState, TMove>
): TMove {
  let bestMove = legalMoves[0];
  let bestScore = -Infinity;
  for (const move of legalMoves) {
    const nextState = options.ruleEngine.performMove(state, move);
    const score = minimaxValue(nextState, options, options.maxDepth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

function minimaxValue<TState extends GameState, TMove>(
  state: TState,
  options: MinimaxOptions<TState, TMove>,
  depth: number,
  alpha: number,
  beta: number
): number {
  if (options.ruleEngine.gameOver(state) || depth <= 0) {
    return options.evaluate(state);
  }
  const currentPlayer = state.players[state.currentPlayerIndex];
  const legalMoves = options.ruleEngine.getLegalMoves(state, currentPlayer);
  const maximizing = currentPlayer === options.maximizingPlayer;
  let value = maximizing ? -Infinity : Infinity;
  for (const move of legalMoves) {
    const nextState = options.ruleEngine.performMove(state, move);
    const childValue = minimaxValue(nextState, options, depth - 1, alpha, beta);
    if (maximizing) {
      value = Math.max(value, childValue);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, childValue);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  return value;
}
