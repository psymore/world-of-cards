import React, { useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { createDeck } from '@world-cards/engine';
import type { Card } from '@world-cards/engine';
import { SimpleCard, SIMPLE_CARD_HEIGHT } from '../components/SimpleCard';
import { computeFanSlot, computeFanWidth, FanLayoutConfig, FanSlot } from '../components/fanLayout';
import { useCardMotion } from '../engine/useCardMotion';
import { idleKeyframe } from '../types';

const FULL_DECK = createDeck({ deckCount: 1, includeJokers: false });
const HAND_SIZE = 8;
const FAN_CONFIG: FanLayoutConfig = { overlap: 0.6, arcDegrees: 40, maxRotationDeg: 20, spacingPx: 40 };
const SELECT_LIFT_PX = 28;
const SELECT_DURATION_MS = 200;
const HAND_TOP_OFFSET = 30;

function SelectableDemoCard({ card, slot }: { card: Card; slot: FanSlot }) {
  const [selected, setSelected] = useState(false);
  const motion = useCardMotion({
    initial: idleKeyframe({ rotateDeg: slot.rotateDeg }),
    defaultDurationMs: SELECT_DURATION_MS,
    defaultEasing: Easing.out(Easing.cubic),
  });

  function handlePress() {
    const next = !selected;
    setSelected(next);
    // Rotation is carried over unchanged in both keyframes — only y (the lift)
    // differs — satisfying Demo 02's "Rotation must remain unchanged" requirement.
    motion.retarget(idleKeyframe({ rotateDeg: slot.rotateDeg, y: next ? -SELECT_LIFT_PX : 0 }));
  }

  return (
    <Pressable
      testID={`demo02-card-${card.id}`}
      onPress={handlePress}
      style={[styles.cardSlot, { left: slot.x, top: HAND_TOP_OFFSET + slot.y }]}>
      <Animated.View style={{ transform: motion.transform }}>
        <SimpleCard card={card} />
      </Animated.View>
    </Pressable>
  );
}

// Demo 02: tap-to-select lift. Neighbor cards' own slots (computed once from the
// fixed FAN_CONFIG/hand) never change when one card is selected — selection only
// ever affects the tapped card's own motion, never triggers a layout recalculation.
export function Demo02Selection() {
  const cards = useMemo(() => FULL_DECK.slice(0, HAND_SIZE), []);
  const totalWidth = computeFanWidth(cards.length, FAN_CONFIG);

  return (
    <View style={styles.container}>
      <View style={[styles.hand, { width: totalWidth, height: SIMPLE_CARD_HEIGHT + HAND_TOP_OFFSET + 40 }]}>
        {cards.map((card, i) => (
          <SelectableDemoCard key={card.id} card={card} slot={computeFanSlot(i, cards.length, FAN_CONFIG)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hand: { position: 'relative' },
  cardSlot: { position: 'absolute' },
});
