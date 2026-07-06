import { Card } from './types';

export interface Zone {
  id: string;
  cards: Card[];
  faceUp: boolean | 'top-only';
}

export interface TableState {
  zones: Record<string, Zone>;
}

export function createZone(id: string, faceUp: boolean | 'top-only', cards: Card[] = []): Zone {
  return { id, faceUp, cards };
}

export function createTable(zones: Zone[]): TableState {
  const zoneMap: Record<string, Zone> = {};
  for (const zone of zones) {
    zoneMap[zone.id] = zone;
  }
  return { zones: zoneMap };
}

export function moveCard(table: TableState, cardId: string, fromZoneId: string, toZoneId: string): TableState {
  const fromZone = table.zones[fromZoneId];
  const toZone = table.zones[toZoneId];
  if (!fromZone || !toZone) {
    throw new Error(`moveCard: unknown zone "${!fromZone ? fromZoneId : toZoneId}"`);
  }
  const cardIndex = fromZone.cards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`moveCard: card "${cardId}" not found in zone "${fromZoneId}"`);
  }
  const card = fromZone.cards[cardIndex];
  const newFromCards = [...fromZone.cards.slice(0, cardIndex), ...fromZone.cards.slice(cardIndex + 1)];
  const newToCards = [...toZone.cards, card];
  return {
    zones: {
      ...table.zones,
      [fromZoneId]: { ...fromZone, cards: newFromCards },
      [toZoneId]: { ...toZone, cards: newToCards },
    },
  };
}

export function moveAllCards(table: TableState, fromZoneId: string, toZoneId: string): TableState {
  const fromZone = table.zones[fromZoneId];
  const toZone = table.zones[toZoneId];
  if (!fromZone || !toZone) {
    throw new Error(`moveAllCards: unknown zone "${!fromZone ? fromZoneId : toZoneId}"`);
  }
  return {
    zones: {
      ...table.zones,
      [fromZoneId]: { ...fromZone, cards: [] },
      [toZoneId]: { ...toZone, cards: [...toZone.cards, ...fromZone.cards] },
    },
  };
}

export function dealToZones(
  deck: Card[],
  table: TableState,
  assignments: Array<{ zoneId: string; count: number }>
): { table: TableState; remainingDeck: Card[] } {
  let cursor = 0;
  const zones = { ...table.zones };
  for (const { zoneId, count } of assignments) {
    const zone = zones[zoneId];
    if (!zone) {
      throw new Error(`dealToZones: unknown zone "${zoneId}"`);
    }
    const dealtCards = deck.slice(cursor, cursor + count);
    cursor += count;
    zones[zoneId] = { ...zone, cards: [...zone.cards, ...dealtCards] };
  }
  return { table: { zones }, remainingDeck: deck.slice(cursor) };
}

export function allCards(table: TableState): Card[] {
  return Object.values(table.zones).flatMap((zone) => zone.cards);
}
