import { useCallback, useState } from 'react';

// Generic tap-to-select-then-tap-to-play state for a hand of cards. First tap on a card selects
// it (deselecting any other); tapping the already-selected card plays it. Reusable across any
// game whose hand UI wants this two-step interaction, not just Pişti.
export function useCardSelection(onPlay: (cardId: string) => void) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const selectCard = useCallback(
    (cardId: string) => {
      if (selectedCardId === cardId) {
        setSelectedCardId(null);
        onPlay(cardId);
      } else {
        setSelectedCardId(cardId);
      }
    },
    [selectedCardId, onPlay]
  );

  const clearSelection = useCallback(() => setSelectedCardId(null), []);

  return { selectedCardId, selectCard, clearSelection };
}
