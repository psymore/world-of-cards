import { useCallback, useState } from 'react';

export interface UseBurySlotsResult {
  // Fixed-length array (length === slotCount); null means that slot is empty.
  slotCardIds: (string | null)[];
  // Convenience view of slotCardIds with the nulls removed, in slot order.
  placedCardIds: string[];
  isPlaced: (cardId: string) => boolean;
  // A single tap toggles a card: if it's already in a slot, it returns to the hand; otherwise
  // it's placed in the next open slot (a no-op if every slot is already full).
  toggleCard: (cardId: string) => void;
  canConfirm: boolean;
  confirm: () => void;
  clear: () => void;
}

// Tracks which cards the human has placed into the kitty-exchange bury slots — a different
// contract than components/useCardSelection.ts's single tap-to-select-then-tap-to-play state,
// so this is a separate hook rather than an overload of that one (see
// docs/superpowers/specs/2026-07-21-batak-gomeli-ui-design.md Section 5).
export function useBurySlots(slotCount: number, onConfirm: (cardIds: string[]) => void): UseBurySlotsResult {
  const [slotCardIds, setSlotCardIds] = useState<(string | null)[]>(() => Array(slotCount).fill(null));

  const isPlaced = useCallback((cardId: string) => slotCardIds.includes(cardId), [slotCardIds]);

  const toggleCard = useCallback((cardId: string) => {
    setSlotCardIds((prev) => {
      const placedIndex = prev.indexOf(cardId);
      if (placedIndex !== -1) {
        const next = [...prev];
        next[placedIndex] = null;
        return next;
      }
      const openIndex = prev.indexOf(null);
      if (openIndex === -1) return prev;
      const next = [...prev];
      next[openIndex] = cardId;
      return next;
    });
  }, []);

  const clear = useCallback(() => setSlotCardIds(Array(slotCount).fill(null)), [slotCount]);

  const placedCardIds = slotCardIds.filter((id): id is string => id != null);
  const canConfirm = placedCardIds.length === slotCount;

  const confirm = useCallback(() => {
    if (placedCardIds.length === slotCount) onConfirm(placedCardIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedCardIds, slotCount, onConfirm]);

  return { slotCardIds, placedCardIds, isPlaced, toggleCard, canConfirm, confirm, clear };
}
