import { createZone, createTable, moveCard, dealToZones, allCards } from './table';
import { createDeck } from './deck';
import { Card } from './types';

const card = (id: string): Card => ({ id, suit: 'hearts', rank: 'A' });

describe('table operations', () => {
  it('creates a table from zones', () => {
    const table = createTable([createZone('stock', false, [card('c1')]), createZone('hand', true)]);
    expect(table.zones['stock'].cards).toEqual([card('c1')]);
    expect(table.zones['hand'].cards).toEqual([]);
  });

  it('moves a card between zones', () => {
    const table = createTable([createZone('stock', false, [card('c1'), card('c2')]), createZone('hand', true)]);
    const next = moveCard(table, 'c1', 'stock', 'hand');
    expect(next.zones['stock'].cards.map((c) => c.id)).toEqual(['c2']);
    expect(next.zones['hand'].cards.map((c) => c.id)).toEqual(['c1']);
  });

  it('throws when moving a card that is not in the source zone', () => {
    const table = createTable([createZone('stock', false, [card('c1')]), createZone('hand', true)]);
    expect(() => moveCard(table, 'missing', 'stock', 'hand')).toThrow();
  });

  it('throws when the zone does not exist', () => {
    const table = createTable([createZone('stock', false, [card('c1')])]);
    expect(() => moveCard(table, 'c1', 'stock', 'nonexistent')).toThrow();
  });

  it('deals cards from a deck into zones and returns the remaining deck', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    const table = createTable([createZone('hand-a', true), createZone('hand-b', true)]);
    const { table: dealt, remainingDeck } = dealToZones(deck, table, [
      { zoneId: 'hand-a', count: 3 },
      { zoneId: 'hand-b', count: 3 },
    ]);
    expect(dealt.zones['hand-a'].cards).toHaveLength(3);
    expect(dealt.zones['hand-b'].cards).toHaveLength(3);
    expect(remainingDeck).toHaveLength(deck.length - 6);
  });

  it('flattens all cards across all zones', () => {
    const table = createTable([
      createZone('stock', false, [card('c1'), card('c2')]),
      createZone('hand', true, [card('c3')]),
    ]);
    expect(allCards(table).map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });
});
