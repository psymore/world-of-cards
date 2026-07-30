import type { GameCategory } from '@world-cards/engine';

const CATEGORY_LABEL: Record<GameCategory, string> = {
  fishing: 'Fishing',
  'trick-taking': 'Trick-taking',
  patience: 'Solitaire',
  betting: 'Betting',
  'draw-and-discard': 'Draw & Discard',
  other: 'Card Game',
};

const CATEGORY_ACCENT: Record<GameCategory, string> = {
  fishing: '#4ac9a0',
  'trick-taking': '#d9b34a',
  patience: '#7aa2f7',
  betting: '#e08a3c',
  'draw-and-discard': '#c77dff',
  other: '#9a8fb0',
};

export function categoryLabel(category: GameCategory): string {
  return CATEGORY_LABEL[category];
}

export function accentColorForCategory(category: GameCategory): string {
  return CATEGORY_ACCENT[category];
}

export function playerRangeLabel(minPlayers: number, maxPlayers: number): string {
  if (minPlayers === maxPlayers) {
    return minPlayers === 1 ? '1 player' : `${minPlayers} players`;
  }
  return `${minPlayers}-${maxPlayers} players`;
}
