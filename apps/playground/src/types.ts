export type CardGroup = 'number' | 'face' | 'ace';

export interface CardImage {
  uri: string;
  kind: 'png' | 'svg';
  svgXml?: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CardBorder {
  width: number;
  color: string;
}

export interface CardTemplate {
  borderRadius: number;
  borders: CardBorder[];
  image: CardImage | null;
}

export interface TableTemplate {
  feltColor: string;
  woodColor: string;
}

export type PlaygroundTemplates = Record<CardGroup, CardTemplate>;

export const MAX_CARD_BORDERS = 3;

export const DEFAULT_CARD_BORDER: CardBorder = { width: 2, color: '#333333' };

export const DEFAULT_CARD_TEMPLATE: CardTemplate = {
  borderRadius: 6,
  borders: [{ ...DEFAULT_CARD_BORDER }],
  image: null,
};

export const DEFAULT_TABLE_TEMPLATE: TableTemplate = {
  feltColor: '#0b6623',
  woodColor: '#4a2116',
};

export const DEFAULT_TEMPLATES: PlaygroundTemplates = {
  number: { ...DEFAULT_CARD_TEMPLATE },
  face: { ...DEFAULT_CARD_TEMPLATE },
  ace: { ...DEFAULT_CARD_TEMPLATE },
};

export const PRESET_COLORS: string[] = [
  '#f4c542',
  '#c0392b',
  '#0b6623',
  '#1c2451',
  '#4a2116',
  '#ffffff',
  '#111111',
  '#3498db',
];
