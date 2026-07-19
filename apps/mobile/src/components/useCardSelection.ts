import { useCallback, useState } from 'react';

// Generic tap-to-select-then-tap-to-play state for a hand of cards. First tap on a card selects
// it (deselecting any other); tapping the already-selected card plays it. Reusable across any
// game whose hand UI wants this two-step interaction, not just Pişti.
export function useCardSelection(onPlay: (cardId: string) => void) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const selectCard = useCallback(
    (cardId: string) => {
      if (selectedCardId === cardId) {
        // Deliberately don't clear selection here. Doing so would flip the card's `selected`
        // prop to false on the next render, which triggers SelectableCard's animated (not
        // instant) "drop back to rest" — and callers that measure a real travel-origin via an
        // async measureInWindow (see playWithMeasuredOrigin in BatakTable/PistiTable) would then
        // often measure the card mid-drop instead of still lifted, producing a visible shake
        // before the travel animation starts from the wrong position. Leaving selectedCardId
        // as-is keeps the card visually static until the caller's own "turn ended" effect clears
        // selection once the play has actually committed — by then this card has already been
        // filtered out of the hand and unmounted, so the clear has nothing left to animate.
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
