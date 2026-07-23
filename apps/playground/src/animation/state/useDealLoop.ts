import { useCallback, useState } from 'react';
import { createDeck, createRng, shuffle } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';

export const SEAT_COUNT = 4;
export const HAND_SIZE = 13;

export interface DealLoopState {
  seats: Card[][];
  turnSeat: number;
  currentTrick: { seat: number; card: Card }[];
}

export interface DealLoopApi extends DealLoopState {
  playCard: (seat: number, cardId: string) => Card | null;
  clearTrick: () => void;
}

function dealFreshHands(): Card[][] {
  const rng = createRng(Date.now() & 0xffffffff);
  const deck = shuffle(createDeck({ deckCount: 1, includeJokers: false }), rng);
  const seats: Card[][] = Array.from({ length: SEAT_COUNT }, () => []);
  deck.slice(0, SEAT_COUNT * HAND_SIZE).forEach((card, i) => {
    seats[i % SEAT_COUNT].push(card);
  });
  return seats;
}

// Deliberately excludes trick-winner logic (confirmed with the user, see
// docs/superpowers/specs/2026-07-23-animation-playground-design.md) — turnSeat
// always advances 0 -> 1 -> 2 -> 3 -> 0 regardless of who "wins" a trick, purely to
// generate a continuous stream of realistic play events to animate. Once every
// seat's hand is empty, reshuffles and redeals automatically.
export function useDealLoop(): DealLoopApi {
  const [state, setState] = useState<DealLoopState>(() => ({
    seats: dealFreshHands(),
    turnSeat: 0,
    currentTrick: [],
  }));

  const playCard = useCallback((seat: number, cardId: string): Card | null => {
    let played: Card | null = null;
    setState(prev => {
      if (prev.turnSeat !== seat) return prev;
      const hand = prev.seats[seat];
      const index = hand.findIndex(c => c.id === cardId);
      if (index === -1) return prev;
      played = hand[index];
      const nextSeats = prev.seats.map((h, i) => (i === seat ? h.filter(c => c.id !== cardId) : h));
      return {
        ...prev,
        seats: nextSeats,
        currentTrick: [...prev.currentTrick, { seat, card: played as Card }],
        turnSeat: (seat + 1) % SEAT_COUNT,
      };
    });
    return played;
  }, []);

  const clearTrick = useCallback(() => {
    setState(prev => {
      const allEmpty = prev.seats.every(hand => hand.length === 0);
      if (allEmpty) {
        return { seats: dealFreshHands(), turnSeat: 0, currentTrick: [] };
      }
      return { ...prev, currentTrick: [] };
    });
  }, []);

  return { ...state, playCard, clearTrick };
}
