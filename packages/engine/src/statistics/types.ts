export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  highScore: number;
}

export interface GameResult {
  won: boolean;
  score: number;
}

export const emptyStats: GameStats = { gamesPlayed: 0, wins: 0, losses: 0, highScore: 0 };

export function recordGameResult(current: GameStats, result: GameResult): GameStats {
  return {
    gamesPlayed: current.gamesPlayed + 1,
    wins: current.wins + (result.won ? 1 : 0),
    losses: current.losses + (result.won ? 0 : 1),
    highScore: Math.max(current.highScore, result.score),
  };
}
