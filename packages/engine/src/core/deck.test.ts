import { createDeck } from './deck';
import { shuffle } from './deck';
import { createRng } from './rng';

describe('createDeck', () => {
  it('creates 52 unique cards for a single deck with no jokers', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('creates 108 unique cards for two decks with jokers', () => {
    const deck = createDeck({ deckCount: 2, includeJokers: true });
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });
});

describe('shuffle', () => {
  it('preserves the same set of cards', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    const shuffled = shuffle(deck, createRng(1));
    expect(shuffled.map((c) => c.id).sort()).toEqual(deck.map((c) => c.id).sort());
  });

  it('is deterministic for a given seed', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    const a = shuffle(deck, createRng(99));
    const b = shuffle(deck, createRng(99));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('reorders the deck for a fixed seed', () => {
    const deck = createDeck({ deckCount: 1, includeJokers: false });
    const shuffled = shuffle(deck, createRng(99));
    expect(shuffled.map((c) => c.id)).not.toEqual(deck.map((c) => c.id));
  });
});
