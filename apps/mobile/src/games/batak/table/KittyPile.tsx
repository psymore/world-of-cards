import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Card } from '@world-of-cards/engine';
import type { BatakState } from '@world-of-cards/engine/games/batak';
import { PlayingCard, CARD_DIMS } from '@world-of-cards/ui';

// The 4-card kitty is dealt face-down into a real 'kitty' zone as part of the initial deal
// (packages/engine/src/games/batak/rules.ts:52,180) and sits there untouched through bidding
// and trump-selection. The moment trump is selected, that same move atomically merges the
// kitty into the bidder's hand and empties the 'kitty' zone (rules.ts:290-291) — so once
// state.phase is 'kitty-exchange', the zone itself is already empty. This function keeps
// returning the same 4 cards throughout the whole kitty-exchange phase (looked up via
// kittyCardIds, which the engine never clears) so the pile visually holds still while the
// staged bury animation runs; once the bury commits and phase becomes 'playing', this
// correctly returns [] — those 4 cards are gone from the table view for good (either buried,
// hidden forever, or now just an ordinary part of the bidder's hand).
export function kittyPileCards(state: BatakState): Card[] {
  if (state.phase === 'kitty-exchange' && state.kittyCardIds && state.bidWinner) {
    const bidderHand = state.table.zones[`hand-${state.bidWinner}`].cards;
    return state.kittyCardIds
      .map((id) => bidderHand.find((c) => c.id === id))
      .filter((c): c is Card => c != null);
  }
  const kittyZone = state.table.zones['kitty'];
  return kittyZone ? kittyZone.cards : [];
}

const PILE_OVERLAP_PX = Math.round(CARD_DIMS.small.height * 0.85);

export function KittyPile({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <View style={styles.pile} testID="kitty-pile">
      {cards.map((card, i) => (
        <View key={card.id} style={i === 0 ? undefined : { marginTop: -PILE_OVERLAP_PX }}>
          <PlayingCard card={card} faceDown size="small" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pile: { alignItems: 'center', justifyContent: 'center', minHeight: 56 },
});
