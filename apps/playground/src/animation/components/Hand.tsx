import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Card } from '@world-of-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from './SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig } from './fanLayout';

export interface HandProps extends FanLayoutConfig {
  cards: Card[];
}

// Pure layout only — no taps, no animation (Demo 01's own scope). Every card's
// position/rotation comes from computeFanSlot alone.
export function Hand({ cards, overlap, arcDegrees, maxRotationDeg, spacingPx }: HandProps) {
  const config: FanLayoutConfig = { overlap, arcDegrees, maxRotationDeg, spacingPx };
  const totalWidth = computeFanWidth(cards.length, config);

  return (
    <View style={[styles.hand, { width: totalWidth, height: SIMPLE_CARD_HEIGHT + 40 }]}>
      {cards.map((card, i) => {
        const slot = computeFanSlot(i, cards.length, config);
        return (
          <View
            key={card.id}
            style={[
              styles.cardSlot,
              { left: slot.x, top: slot.y, transform: [{ rotate: `${slot.rotateDeg}deg` }] },
            ]}>
            <SimpleCard card={card} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hand: { alignSelf: 'center', marginTop: 20 },
  cardSlot: { position: 'absolute' },
});
